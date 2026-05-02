from fastapi import FastAPI, HTTPException, File, UploadFile
from pydantic import BaseModel
import re
import unicodedata
import fitz  # PyMuPDF
from deep_translator import GoogleTranslator

# Presidio for PII Anonymization
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig
from classifier import legal_classifier

app = FastAPI(title="NyayaConnect AI Engine")

# Initialize Presidio Engines
analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

class DocumentRequest(BaseModel):
    text: str
    source_language: str = "en" # e.g. "hi", "mr", "ta", "en"

class DocumentResponse(BaseModel):
    original_length: int
    anonymized_text: str
    translated_text: str
    classification: dict

@app.post("/process-document", response_model=DocumentResponse)
async def process_document(request: DocumentRequest):
    return process_text_pipeline(request.text, request.source_language)

@app.post("/process-pdf", response_model=DocumentResponse)
async def process_pdf(file: UploadFile = File(...), source_language: str = "auto"):
    # Read the file bytes
    file_bytes = await file.read()
    
    # Extract text using PyMuPDF (Native-First)
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        
        # Calculate density: if text is too short compared to pages, it's likely a scanned image PDF
        if len(text.strip()) < 50:
            raise HTTPException(status_code=422, detail="SCANNED_PDF_DETECTED")
            
        return process_text_pipeline(text, source_language)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

def process_text_pipeline(text: str, source_language: str) -> DocumentResponse:
    original_length = len(text)
    
    # ==========================================
    # PRE-PROCESSING: Unicode Normalization (NFKC)
    # ==========================================
    # Merges Kannada vowel signs into single Unicode points to prevent OCR gibberish
    text = unicodedata.normalize('NFKC', text)

    # ==========================================
    # STAGE 1: OCR Sanity Check & Formatting Fixes
    # ==========================================
    # 1. Fix Indian Currency OCR Blinks (e.g., 1.50.000/- -> 1,50,000/-)
    # Replaces periods with commas in Indian numbering systems
    text = re.sub(r'\b(\d{1,2})\.(\d{2})\.(\d{3})\b', r'\1,\2,\3', text)
    text = re.sub(r'\b(\d{1,2})\.(\d{3})\b(?=/-|\s*rupees|\s*inr)', r'\1,\2', text, flags=re.IGNORECASE)

    # 2. Re-construct Spaced/Broken Pincodes (Bangalore region: 560 034 -> 560034)
    text = re.sub(r'\b(56[0-9])\s+(\d{3})\b', r'\1\2', text)

    # ==========================================
    # STAGE 1.5: Parallel PII Regex & Anchor Mapping (On Raw Text)
    # ==========================================
    # Extract robust numeric PII before translation misinterprets commas or spaces
    text = re.sub(r'\b\d{4}\s?\d{4}\s?\d{4}\b', '[AADHAAR_REDACTED]', text)
    text = re.sub(r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b', '[PAN_REDACTED]', text)
    # Include Kannada keyword for cheque (ಚೆಕ್)
    text = re.sub(r'(?i)(cheque|chq|ಚೆಕ್)\.?\s*(?:no\.?|ಸಂಖ್ಯೆ)?\s*(\d{6})\b', r'\1 [CHEQUE_REDACTED]', text)

    # Honorific & Legal Anchor Mapping (Prevent hallucination on proper nouns/roles)
    if source_language.lower() != "en":
        # The Deterministic Legal Glossary
        # Pre-translation overrides mapping Kannada terms to exact English legal terms
        kannada_map = {
            # Honorifics
            "ಶ್ರೀಮತಿ": "Mrs.",
            "ಶ್ರೀ": "Mr.",
            "ದಿವಂಗತ": "Late",
            
            # Rental & Lease Agreements
            "ಮಾಲೀಕರು": "Owner/Lessor",
            "ಬಾಡಿಗೆದಾರರು": "Tenant/Lessee",
            "ಬಾಡಿಗೆ": "Rent",
            "ಮುಂಗಡ": "Security Deposit",
            "ಗುತ್ತಿಗೆ": "Lease",
            "ಕರಾರು": "Agreement",
            "ಒಪ್ಪಂದ": "Contract",
            "ಷರತ್ತುಗಳು": "Terms and Conditions",
            "ಅವಧಿ": "Tenure",
            
            # General Legal & Notary
            "ಸಾಕ್ಷಿ": "Witness",
            "ಸಹಿ": "Signature",
            "ದಸ್ತಾವೇಜು": "Document",
            "ನ್ಯಾಯಾಲಯ": "Court",
            "ವಕೀಲ": "Advocate",
            "ನೋಟಿಸ್": "Legal Notice",
            
            # Employment & Services
            "ಉದ್ಯೋಗ": "Employment",
            "ವೇತನ": "Salary",
            "ರಾಜೀನಾಮೆ": "Resignation",
            "ಸೇವಾ": "Service"
        }
        for k_word, e_word in kannada_map.items():
            text = text.replace(k_word, f" {e_word} ")

    # ==========================================
    # STAGE 2: Efficient Translation (Google Translate Backend)
    # ==========================================
    translated_text = text
    if source_language.lower() != "en":
        try:
            translator = GoogleTranslator(source='auto', target='en')
            max_len = 1000 
            translated_chunks = []
            text_chunks = [text[i:i+max_len] for i in range(0, len(text), max_len)]
            
            for chunk in text_chunks:
                if chunk.strip():
                    try:
                        res = translator.translate(chunk)
                        translated_chunks.append(res if res else chunk)
                    except Exception as chunk_err:
                        print("Chunk Translation Error:", chunk_err)
                        translated_chunks.append(chunk)
            
            translated_text = ''.join(translated_chunks)
        except Exception as e:
            print("Translation Error:", e)
            translated_text = text

    # ==========================================
    # STAGE 2.5: Domain-Specific Post-Editing & Noise Stripping
    # ==========================================
    if source_language.lower() != "en":
        # 1. Post-editing override to fix hallucinated legal roles
        # Note: using word boundaries to ensure we only replace full words
        translated_text = re.sub(r'(?i)\bFinance Minister\b', 'Owner', translated_text)
        translated_text = re.sub(r'(?i)\bFinancer\b', 'Owner', translated_text)
        translated_text = re.sub(r'(?i)\bSecond Class\b', 'Tenant', translated_text)
        
        # 2. Strip Kannada Vowel Noise
        # Removes any lingering Kannada script characters (\u0C80-\u0CFF) 
        # from the English output to ensure clean layout
        translated_text = re.sub(r'[\u0C80-\u0CFF]+', '', translated_text)

    # ==========================================
    # STAGE 3: NLP Presidio Anonymization (High-Risk PII on English text)
    # ==========================================
    results = analyzer.analyze(
        text=translated_text, 
        entities=["PHONE_NUMBER", "EMAIL_ADDRESS", "IBAN_CODE", "CREDIT_CARD"], 
        language='en'
    )
    
    anonymized_result = anonymizer.anonymize(
        text=translated_text,
        analyzer_results=results,
        operators={
            "DEFAULT": OperatorConfig("replace", {"new_value": "<REDACTED>"}),
            "PHONE_NUMBER": OperatorConfig("replace", {"new_value": "[PHONE_REDACTED]"})
        }
    )
    final_text = anonymized_result.text
    # ==========================================
    # STAGE 4: Domain Classification
    # ==========================================
    # Classify based on the cleaned, translated English text
    classification_result = legal_classifier.classify(translated_text)
            
    return DocumentResponse(
        original_length=original_length,
        anonymized_text=final_text,
        translated_text=translated_text, # Keeping this in case the frontend wants to see the raw translation without masks
        classification=classification_result
    )

@app.get("/health")
async def health_check():
    return {"status": "NyayaConnect AI Microservice is Online!"}
