from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import re
import unicodedata
from deep_translator import GoogleTranslator

# Presidio for PII Anonymization
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

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

@app.post("/process-document", response_model=DocumentResponse)
async def process_document(request: DocumentRequest):
    text = request.text
    
    # ==========================================
    # PRE-PROCESSING: Unicode Normalization (NFKC)
    # ==========================================
    # Merges Kannada vowel signs into single Unicode points to prevent OCR gibberish
    text = unicodedata.normalize('NFKC', text)

    # ==========================================
    # STAGE 1: Parallel PII Regex & Anchor Mapping (On Raw Text)
    # ==========================================
    # Extract robust numeric PII before translation misinterprets commas or spaces
    text = re.sub(r'\b\d{4}\s?\d{4}\s?\d{4}\b', '[AADHAAR_REDACTED]', text)
    text = re.sub(r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b', '[PAN_REDACTED]', text)
    # Include Kannada keyword for cheque (ಚೆಕ್)
    text = re.sub(r'(?i)(cheque|chq|ಚೆಕ್)\.?\s*(?:no\.?|ಸಂಖ್ಯೆ)?\s*(\d{6})\b', r'\1 [CHEQUE_REDACTED]', text)

    # Honorific & Legal Anchor Mapping (Prevent hallucination on proper nouns/roles)
    if request.source_language.lower() != "en":
        kannada_map = {
            "ಮಾಲೀಕರು": "Owner",
            "ಬಾಡಿಗೆದಾರರು": "Tenant",
            "ಶ್ರೀಮತಿ": "Mrs.",
            "ಶ್ರೀ": "Mr.",
            "ದಿವಂಗತ": "Late"
        }
        for k_word, e_word in kannada_map.items():
            text = text.replace(k_word, f" {e_word} ")

    # ==========================================
    # STAGE 2: Efficient Translation (Google Translate Backend)
    # ==========================================
    translated_text = text
    if request.source_language.lower() != "en":
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
    if request.source_language.lower() != "en":
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
            
    return DocumentResponse(
        original_length=len(request.text),
        anonymized_text=final_text,
        translated_text=translated_text # Keeping this in case the frontend wants to see the raw translation without masks
    )

@app.get("/health")
async def health_check():
    return {"status": "NyayaConnect AI Microservice is Online!"}
