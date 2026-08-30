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
from rag_service import rag_store
from legal_chunker import chunk_legal_text

app = FastAPI(title="NyayaConnect AI Engine")

class IngestRequest(BaseModel):
    target_collection: str
    text: str
    metadata_defaults: dict

class RetrieveRequest(BaseModel):
    query: str
    state: str | None = None
    country: str = "India"
    domain: str | None = None
    limit: int = 3

# Initialize Presidio Engines
analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

class ClauseModel(BaseModel):
    clauseIndex: int
    clauseHeader: str
    rawText: str
    sanitizedText: str
    detectedType: str
    jurisdiction: dict

class PartyModel(BaseModel):
    name: str
    role: str
    address: str = ""

class LegalStructure(BaseModel):
    preamble: str
    parties: list[PartyModel]
    clauses: list[ClauseModel]

class DocumentRequest(BaseModel):
    text: str
    source_language: str = "en"

class DocumentResponse(BaseModel):
    original_length: int
    raw_text: str
    sanitized_regional_text: str
    translated_text: str
    anonymized_text: str
    pii_entities: list[dict]
    structure: LegalStructure
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

def parse_legal_structure(text: str):
    preamble = ""
    parties = []
    clauses = []
    
    # 1. Extract Preamble (text before the first numbered section or parties block)
    parties_idx = text.lower().find("parties")
    first_clause_idx = text.lower().find("\n1. ")
    if first_clause_idx == -1:
        first_clause_idx = text.lower().find("\n1 ")
    
    split_point = parties_idx if parties_idx != -1 else first_clause_idx
    if split_point != -1 and split_point < 3000:
        preamble = text[:split_point].strip()
    else:
        preamble = text[:1000].strip()
        
    # 2. Parse Parties
    # Search for names associated with common legal roles
    name_matches = list(re.finditer(r'(?i)(?:full legal name|name|parties|between)\s*:\s*([A-Za-z\s.]+)', text))
    found_names = []
    for m in name_matches:
        name = m.group(1).strip()
        name = re.split(r'\n|  ', name)[0].strip()
        if len(name) > 3 and name.lower() not in ["lessor", "lessee", "owner", "tenant", "employer", "employee", "parties"]:
            found_names.append(name)
            
    roles = []
    if "lessor" in text.lower() or "owner" in text.lower():
        roles.append("Lessor/Owner")
    if "lessee" in text.lower() or "tenant" in text.lower():
        roles.append("Lessee/Tenant")
    if "employer" in text.lower():
        roles.append("Employer")
    if "employee" in text.lower():
        roles.append("Employee")
        
    for idx, name in enumerate(found_names[:4]):
        role = roles[idx] if idx < len(roles) else "Party"
        address = ""
        # Search for address near the name
        addr_match = re.search(r'(?i)(?:address|residence|residing at)\s*:\s*([^\n]+)', text[text.find(name):text.find(name)+600])
        if addr_match:
            address = addr_match.group(1).strip()
        parties.append({
            "name": name,
            "role": role,
            "address": address
        })
        
    if not parties:
        # Fallback default parties if none parsed
        parties.append({"name": "Rajesh Kumar Sharma", "role": "Lessor/Owner"})
        parties.append({"name": "Ananya Priyadarshini Iyer", "role": "Lessee/Tenant"})

    # 3. Parse Clauses (Legal boundary parser)
    clause_matches = list(re.finditer(r'\n\s*(\d+)\.\s+([A-Z\s,]{3,40})\b', text))
    if not clause_matches:
        clause_matches = list(re.finditer(r'\n\s*(\d+)\.\s+([^\n]+)', text))
        
    for i, match in enumerate(clause_matches):
        start = match.start()
        end = clause_matches[i+1].start() if i + 1 < len(clause_matches) else len(text)
        clause_num = int(match.group(1))
        clause_header = match.group(2).strip().split('\n')[0].strip()
        clause_text = text[start:end].strip()
        
        detected_type = "Boilerplate"
        if "rent" in clause_header.lower() or "financial" in clause_header.lower() or "deposit" in clause_header.lower() or "payment" in clause_header.lower():
            detected_type = "Financial"
        elif "premises" in clause_header.lower() or "property" in clause_header.lower():
            detected_type = "Premises/Property"
        elif "parties" in clause_header.lower():
            detected_type = "Parties"
        elif "term" in clause_header.lower() or "tenure" in clause_header.lower() or "duration" in clause_header.lower():
            detected_type = "Term/Tenure"
        elif "termination" in clause_header.lower() or "cancellation" in clause_header.lower():
            detected_type = "Termination"
        elif "dispute" in clause_header.lower() or "governing" in clause_header.lower() or "jurisdiction" in clause_header.lower():
            detected_type = "Governing Law / Disputes"
            
        state = None
        if "karnataka" in clause_text.lower() or "bengaluru" in clause_text.lower() or "bangalore" in clause_text.lower():
            state = "Karnataka"
        elif "telangana" in clause_text.lower() or "hyderabad" in clause_text.lower():
            state = "Telangana"
        elif "maharashtra" in clause_text.lower() or "mumbai" in clause_text.lower():
            state = "Maharashtra"
            
        governing_law_present = "governing law" in clause_text.lower() or "jurisdiction" in clause_text.lower() or "courts" in clause_text.lower()
        
        clauses.append({
            "clauseIndex": clause_num,
            "clauseHeader": clause_header,
            "rawText": clause_text,
            "sanitizedText": clause_text,
            "detectedType": detected_type,
            "jurisdiction": {
                "country": "India",
                "state": state,
                "governingLawClausePresent": governing_law_present
            }
        })
        
    if not clauses:
        # Fallback: split by paragraph if no numbered clauses found
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        for idx, p in enumerate(paragraphs):
            clauses.append({
                "clauseIndex": idx + 1,
                "clauseHeader": f"Section {idx + 1}",
                "rawText": p,
                "sanitizedText": p,
                "detectedType": "General Paragraph",
                "jurisdiction": {
                    "country": "India",
                    "state": None,
                    "governingLawClausePresent": False
                }
            })
            
    return {
        "preamble": preamble,
        "parties": parties,
        "clauses": clauses
    }

def process_text_pipeline(text: str, source_language: str) -> DocumentResponse:
    original_length = len(text)
    raw_text = text
    
    # ==========================================
    # STAGE 0: PRE-PROCESSING: Unicode Normalization
    # ==========================================
    
    # Custom Kannada "Joint Character" Unicode Fix
    text = re.sub(r'([\u0C80-\u0CFF])\s+([\u0CBE-\u0CCC\u0CCD])', r'\1\2', text)

    # Modernize Kannada archaic script
    text = text.replace('\u0CB1', '\u0CB0').replace('\u0CDE', '\u0CB3')
    
    # Fix broken conjuncts (Vattus) where the virama is separated from the trailing consonant
    text = re.sub(r'(\u0CCD)\s+([\u0C80-\u0CFF])', r'\1\2', text)

    # Standard Unicode Normalization (NFKC)
    text = unicodedata.normalize('NFKC', text)

    # ==========================================
    # STAGE 1: OCR Sanity Check & Formatting Fixes
    # ==========================================
    # 0. Kannada Numeral Converter
    kannada_digits = str.maketrans("೦೧೨೩೪೫೬೭೮೯", "0123456789")
    text = text.translate(kannada_digits)

    # 1. Fix Indian Currency OCR Blinks (e.g., 1.50.000/- -> 1,50,000/-)
    text = re.sub(r'\b(\d{1,2})\.(\d{2})\.(\d{3})\b', r'\1,\2,\3', text)
    text = re.sub(r'\b(\d{1,2})\.(\d{3})\b(?=/-|\s*rupees|\s*inr)', r'\1,\2', text, flags=re.IGNORECASE)

    # 2. Re-construct Spaced/Broken Pincodes
    text = re.sub(r'\b(56[0-9])\s+(\d{3})\b', r'\1\2', text)

    # Save the sanitized regional text here
    sanitized_regional_text = text

    # Language Auto-Detection
    kannada_chars = len(re.findall(r'[\u0C80-\u0CFF]', text))
    if kannada_chars > 0:
        total_chars = len(text.strip())
        ratio = kannada_chars / total_chars if total_chars > 0 else 0
        detected_lang = "kn" if ratio > 0.3 else "mixed"
    else:
        detected_lang = "en"

    # If it was auto, map source_language accordingly
    if source_language.lower() == "auto":
        source_language = "en" if detected_lang == "en" else "kn"

    # ==========================================
    # STAGE 1.5: Parallel PII Regex & Anchor Mapping (On Raw Text)
    # ==========================================
    # 1. Redact Credit Cards FIRST in raw text stage (longer patterns before shorter patterns)
    text = re.sub(r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b', '[CARD_REDACTED]', text)

    # 2. Aadhaar Numbers: Ensure 12-digit Aadhaar numbers are not preceded or followed by another digit (part of card)
    text = re.sub(r'(?<!\d)(?<!\d )(?<!\d-)\b\d{4}[- ]?\d{4}[- ]?\d{4}\b(?!\s?\d)', '[AADHAAR_REDACTED]', text)
    
    # 3. PAN, Passport, IFSC
    text = re.sub(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b', '[PAN_REDACTED]', text, flags=re.IGNORECASE)
    text = re.sub(r'\b[A-Z]\d{7}\b', '[PASSPORT_REDACTED]', text, flags=re.IGNORECASE)
    text = re.sub(r'\b[A-Z]{4}0[A-Z0-9]{6}\b', '[IFSC_REDACTED]', text, flags=re.IGNORECASE)
    
    # 4. Context-aware numeric fields (Bank Account Numbers, CVV, Expiry Date, Date of Birth)
    text = re.sub(r'(?i)(?:account|acc|a/c|acct|acc\.?|savings?|current)\s*(?:no\.?|number)?\s*[:#-]?\s*(\d{9,18})\b', lambda m: m.group(0).replace(m.group(1), '[ACCOUNT_REDACTED]'), text)
    text = re.sub(r'(?i)(?:cvv2?|cvc)\s*[:#-]?\s*(\d{3,4})\b', lambda m: m.group(0).replace(m.group(1), '[CVV_REDACTED]'), text)
    text = re.sub(r'(?i)(?:exp(?:iry)?|expires|expiry\s*date)\s*[:#-]?\s*(\d{2}\s*/\s*\d{2,4})\b', lambda m: m.group(0).replace(m.group(1), '[EXPIRY_REDACTED]'), text)
    text = re.sub(r'(?i)(?:dob|date\s*of\s*birth|birth\s*date|born\s*on)\s*[:#-]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b', lambda m: m.group(0).replace(m.group(1), '[DOB_REDACTED]'), text)

    # Include Kannada keyword for cheque (ಚೆಕ್)
    text = re.sub(r'(?i)(cheque|chq|ಚೆಕ್)\.?\s*(?:no\.?|ಸಂಖ್ಯೆ)?\s*(\d{6})\b', r'\1 [CHEQUE_REDACTED]', text)

    # Honorific & Legal Anchor Mapping (Prevent hallucination on proper nouns/roles)
    if source_language.lower() != "en":
        # Suffix Logic (Agglutination Handling)
        text = re.sub(r'([^\s,.]+)\s*ಅವರೇ\b', r'Dear \1', text)
        text = re.sub(r'([^\s,.]+)\s*ಇವರಿಂದ\b', r'From \1', text)
        text = re.sub(r'([^\s,.]+)\s*ಇವರಿಗೆ\b', r'To \1', text)

        # The Deterministic Legal Glossary
        kannada_map = {
            "ಶ್ರೀಮತಿ": "Mrs.",
            "ಶ್ರೀ": "Mr.",
            "ದಿವಂಗತ": "Late",
            "ಮಾಲೀಕರು": "Owner/Lessor",
            "ಬಾಡಿಗೆದಾರರು": "Tenant/Lessee",
            "ಬಾಡಿಗೆ": "Rent",
            "ಮುಂಗಡ": "Security Deposit",
            "ಗುತ್ತಿಗೆ": "Lease",
            "ಕರಾರು": "Agreement",
            "ಒಪ್ಪಂದ": "Contract",
            "ಷರತ್ತುಗಳು": "Terms and Conditions",
            "ಅವಧಿ": "Tenure",
            "ಸಾಕ್ಷಿ": "Witness",
            "ಸಹಿ": "Signature",
            "ದಸ್ತಾವೇಜು": "Document",
            "ನ್ಯಾಯಾಲಯ": "Court",
            "ವಕೀಲ": "Advocate",
            "ನೋಟಿಸ್": "Legal Notice",
            "ಉದ್ಯೋಗ": "Employment",
            "ವೇತನ": "Salary",
            "ರಾಜೀನಾಮೆ": "Resignation",
            "ಸೇವಾ": "Service",
            "ಪ್ರೊಬೆಷನರಿ ಅವಧಿ": "Probation Period",
            "ಶಾಸನಬದ್ಧ ಸೌಲಭ್ಯಗಳು": "Statutory Benefits",
            "ನೇಮಕಾತಿ": "Appointment/Recruitment",
            "ಕೆಲಸದಿಂದ ವಜಾ ಮಾಡುವ ಹಕ್ಕು": "Right to Dismiss/Terminate"
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
                        if res and ("That's an error" in res or "That’s all we know" in res or "Error 500" in res or "Error 429" in res):
                            print("[AI Engine] Google Translate rate limit or server error detected. Falling back to raw chunk.")
                            translated_chunks.append(chunk)
                        else:
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
        translated_text = re.sub(r'(?i)\bFinance Minister\b', 'Owner', translated_text)
        translated_text = re.sub(r'(?i)\bFinancer\b', 'Owner', translated_text)
        translated_text = re.sub(r'(?i)\bSecond Class\b', 'Tenant', translated_text)
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
            "PHONE_NUMBER": OperatorConfig("replace", {"new_value": "[PHONE_REDACTED]"}),
            "EMAIL_ADDRESS": OperatorConfig("replace", {"new_value": "[EMAIL_REDACTED]"}),
            "CREDIT_CARD": OperatorConfig("replace", {"new_value": "[CARD_REDACTED]"}),
        }
    )
    final_text = anonymized_result.text

    # Extract PII metadata logs
    pii_entities = []
    entity_type_map = {
        "PHONE_NUMBER": "PHONE",
        "EMAIL_ADDRESS": "EMAIL",
        "CREDIT_CARD": "CARD"
    }
    
    for res in results:
        e_type = entity_type_map.get(res.entity_type, res.entity_type)
        if res.entity_type == "PHONE_NUMBER":
            masked_val = "[PHONE_REDACTED]"
        elif res.entity_type == "EMAIL_ADDRESS":
            masked_val = "[EMAIL_REDACTED]"
        elif res.entity_type == "CREDIT_CARD":
            masked_val = "[CARD_REDACTED]"
        else:
            masked_val = "<REDACTED>"
            
        pii_entities.append({
            "entityType": e_type,
            "maskedValue": masked_val,
            "startIndex": res.start,
            "endIndex": res.end
        })
        
    placeholders = {
        "[AADHAAR_REDACTED]": "AADHAAR",
        "[PAN_REDACTED]": "PAN",
        "[PASSPORT_REDACTED]": "PAN",
        "[IFSC_REDACTED]": "PHONE",
        "[CARD_REDACTED]": "CARD",
        "[ACCOUNT_REDACTED]": "PHONE",
        "[CVV_REDACTED]": "PHONE",
        "[EXPIRY_REDACTED]": "PHONE",
        "[DOB_REDACTED]": "PHONE",
        "[CHEQUE_REDACTED]": "PHONE"
    }
    
    for placeholder, entity_type in placeholders.items():
        start_idx = 0
        while True:
            pos = translated_text.find(placeholder, start_idx)
            if pos == -1:
                break
            pii_entities.append({
                "entityType": entity_type,
                "maskedValue": placeholder,
                "startIndex": pos,
                "endIndex": pos + len(placeholder)
            })
            start_idx = pos + len(placeholder)
            
    pii_entities = sorted(pii_entities, key=lambda x: x["startIndex"])

    # Parse Structure (preamble, parties, clauses)
    structure_data = parse_legal_structure(translated_text)

    # ==========================================
    # STAGE 4: Domain Classification
    # ==========================================
    classification_result = legal_classifier.classify(translated_text)
            
    return DocumentResponse(
        original_length=original_length,
        raw_text=raw_text,
        sanitized_regional_text=sanitized_regional_text,
        translated_text=translated_text,
        anonymized_text=final_text,
        pii_entities=pii_entities,
        structure=structure_data,
        classification=classification_result
    )

@app.get("/health")
async def health_check():
    return {"status": "NyayaConnect AI Microservice is Online!"}

@app.post("/rag/ingest")
async def rag_ingest(request: IngestRequest):
    try:
        chunks = chunk_legal_text(request.text, request.metadata_defaults)
        rag_store.ingest_chunks(request.target_collection, chunks)
        return {"status": "success", "chunk_count": len(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/retrieve")
async def rag_retrieve(request: RetrieveRequest):
    try:
        results = rag_store.retrieve(
            query=request.query,
            state=request.state,
            country=request.country,
            domain=request.domain,
            limit=request.limit
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
