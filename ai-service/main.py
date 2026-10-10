import os
import base64
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
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
from clause_analyzer import analyze_all_clauses
from summarizer import summarize_document
from chat_service import answer_document_query
from kannada_normalizer import apply_glossary, kannada_quality_report, split_for_translation, translate_with_retry, fix_joint_characters

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
    risk_analysis: list[dict] = []
    summary_output: dict = {}
    translation_quality: dict = {}

@app.post("/process-document", response_model=DocumentResponse)
async def process_document(request: DocumentRequest):
    return process_text_pipeline(request.text, request.source_language)

@app.post("/process-pdf", response_model=DocumentResponse)
async def process_pdf(file: UploadFile = File(...), source_language: str = Form("auto")):
    # Read the file bytes
    file_bytes = await file.read()
    if not file_bytes or len(file_bytes) < 10:
        raise HTTPException(status_code=400, detail="Uploaded file is empty or unreadable.")
    
    # Extract text using PyMuPDF (Native-First)
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as open_err:
        raise HTTPException(status_code=400, detail=f"Cannot parse PDF format: {open_err}")

    try:
        MAX_OCR_PAGES = 20
        page_texts = []
        ocr_candidates = []  # (page_index) pages whose content is mostly image
        for idx, page in enumerate(doc):
            pt = page.get_text() or ""
            page_texts.append(pt)
            try:
                has_images = len(page.get_images(full=True)) > 0
            except Exception:
                has_images = False
            # Image-based page: almost no selectable text. If it carries images, or the whole doc is textless, OCR it.
            if len(pt.strip()) < 150 and (has_images or len(pt.strip()) < 50):
                ocr_candidates.append(idx)

        text = "".join(page_texts)
        total_chars = len(text.strip())

        # Whole document is blank-ish with nothing to render -> genuinely unreadable
        if len(doc) == 0:
            raise HTTPException(status_code=400, detail="PDF contains no pages.")

        # Only OCR when the doc is effectively textless, OR image pages hold a meaningful share of it
        needs_ocr = total_chars < 50 or (ocr_candidates and len(ocr_candidates) >= 1 and has_substantial_images(doc, ocr_candidates))
        
        use_v2 = os.environ.get("KN_NORMALIZER_V2", "1") == "1"
        if use_v2:
            if kannada_quality_report(text).get("looks_garbled"):
                needs_ocr = True
                ocr_candidates = list(range(min(len(doc), MAX_OCR_PAGES)))
                
        if needs_ocr and ocr_candidates:
            page_images, page_indices = [], []
            for idx in ocr_candidates[:MAX_OCR_PAGES]:
                pix = doc[idx].get_pixmap(dpi=200)  # 200 dpi: better OCR on small legal print
                page_images.append(base64.b64encode(pix.tobytes("png")).decode("utf-8"))
                page_indices.append(idx)
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "SCANNED_PDF_DETECTED",
                    "message": "Image-based pages detected. Page images provided for OCR fallback.",
                    "page_images": page_images,
                    "page_indices": page_indices,
                    # Native text of every page so the caller can MERGE OCR output instead of discarding it
                    "native_pages": page_texts,
                    "truncated": len(ocr_candidates) > MAX_OCR_PAGES
                }
            )

        return process_text_pipeline(text, source_language)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}")

def has_substantial_images(doc, page_indices) -> bool:
    """True if an image-bearing, text-poor page covers a meaningful area (avoids OCR for tiny logos/stamps)."""
    for idx in page_indices:
        page = doc[idx]
        page_area = max(page.rect.width * page.rect.height, 1)
        try:
            for img in page.get_images(full=True):
                for r in page.get_image_rects(img[0]):
                    if (r.width * r.height) / page_area >= 0.15:
                        return True
        except Exception:
            return True  # can't measure -> be safe and OCR
    return False

def _has_kw(haystack: str, keywords) -> bool:
    """Whole-word / phrase match. Avoids false hits like 'rent' in 'current' or 'car' in 'care'."""
    return any(re.search(r'\b' + re.escape(k) + r'\b', haystack) for k in keywords)

def _looks_like_legal_notice(text: str) -> bool:
    t = text.lower()
    markers = ["legal notice", "under instructions from my client", "under instruction from my client",
               "my client", "our client", "call upon you", "advocate"]
    return sum(1 for m in markers if m in t) >= 2

# (type label, header keywords, body keywords). Header hits outrank body hits.
_CLAUSE_TAXONOMY = [
    ("Encumbrance & Title Warranty", ["encumbrance", "encumbrances", "lien", "title warranty", "clear title", "marketable title", "indemnity"], ["free from all encumbrances", "encumbrance", "court attachment", "lien", "mortgage", "charge or lien"]),
    ("Property Conveyance / Transfer", ["conveyance", "absolute sale", "transfer", "sale deed", "assignment"], ["absolutely sell", "convey", "conveyance", "hereby transfer"]),
    ("Financial & Consideration Schedules", ["consideration", "payment", "price", "rent", "deposit", "salary", "stamp duty", "tds"], ["sale consideration", "stamp duty", "registration fee", "tds", "security deposit", "monthly rent", "salary"]),
    ("Possession & Title Deeds", ["possession", "title deeds", "khata"], ["vacant possession", "peaceful possession", "title deeds", "khata"]),
    ("Court Pleadings / Relief Sought", ["prayer", "relief", "injunction"], ["permanent injunction", "declaration of title", "decree"]),
    ("Cause of Action & Valuation", ["cause of action", "court fee", "valuation"], ["cause of action", "court fee", "suit valuation"]),
    ("Execution & Attestation", ["witness", "witnesses", "signature", "execution", "attestation"], ["in witness whereof", "signed and delivered", "attested"]),
    ("Termination & Notice", ["termination", "cancellation", "notice period"], ["terminate this agreement", "notice period", "months notice"]),
    ("Term & Tenure", ["term", "tenure", "duration", "period"], ["lease term", "tenure of", "period of"]),
    ("Confidentiality & Non-Disclosure", ["confidentiality", "non-disclosure", "secrecy"], ["confidential information", "non-disclosure"]),
    ("Governing Law & Disputes", ["governing law", "jurisdiction", "dispute", "disputes", "arbitration"], ["governing law", "exclusive jurisdiction", "arbitration"]),
    ("Premises Use / Parking Permission", ["parking", "vehicle", "vehicles"], ["parking", "two-wheeler", "four-wheeler"]),
    ("Premises / Schedule Property", ["premises", "schedule", "demised premises", "property description"], ["schedule property", "demised premises", "bounded by"]),
    ("Parties & Recitals", ["parties", "recitals", "whereas"], ["between"]),
]

# Legal-notice paragraphs are classified by rhetorical FUNCTION, not by transactional vocabulary,
# otherwise every 'denied' paragraph mentioning a cheque/property collapses into one bucket.
_NOTICE_FUNCTIONS = [
    ("Notice \u2013 Demand / Call to Perform", ["call upon you", "hereby demand", "demand that", "you are required to", "you are hereby called upon", "execute the sale deed", "pay the balance"]),
    ("Notice \u2013 Consequences & Reservation of Rights", ["failing which", "reserve the right", "reserves the right", "legal action", "civil and criminal", "at your risk and cost", "proceedings"]),
    ("Notice \u2013 Denial of Allegations", ["deny", "denied", "denies", "false", "baseless", "strict proof", "frivolous"]),
    ("Notice \u2013 Agreement / Payment Particulars", ["agreement of sale", "advance", "balance", "sale consideration", "cheque", "cheques", "rs.", "rupees"]),
    ("Notice \u2013 Factual Background", ["my client", "our client", "you are aware", "owner of", "purchase", "sister", "brother", "residing"]),
]

def classify_clause_type(header: str, body: str, is_notice: bool = False) -> str:
    h = (header or "").lower()
    b = (body or "").lower()
    
    is_generic_header = not h or any(gh in h for gh in ["clause", "section", "article", "general", "miscellaneous", "other", "terms", "conditions"])
    
    # 1) If header is not generic, it is the strongest signal of intent
    if not is_generic_header:
        for label, h_kw, _ in _CLAUSE_TAXONOMY:
            if _has_kw(h, h_kw):
                return label
                
    # 2) Legal notices: classify by rhetorical function
    if is_notice:
        for label, kws in _NOTICE_FUNCTIONS:
            if any(k in b for k in kws):
                return label
        return "Notice \u2013 General Averment"
        
    # 3) Contracts: body text signals
    for label, _, b_kw in _CLAUSE_TAXONOMY:
        if _has_kw(b, b_kw):
            return label
            
    # 4) If it was a generic header, but we still didn't find anything in body, maybe the header actually matched something
    if is_generic_header:
        for label, h_kw, _ in _CLAUSE_TAXONOMY:
            if _has_kw(h, h_kw):
                return label

    return "General Covenants"

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
        
    # 2. Parse Parties with Indian Legal Conventions
    found_parties = []
    # Pattern A: Name followed by hereinafter called / referred to as [ROLE]
    role_pattern = r'(?i)(?:Sri\.?|Smt\.?|Mr\.?|Mrs\.?|Ms\.?|M/s\.?)?\s*([A-Za-z\s.]{3,50}?)\s*,?\s*(?:s/o|w/o|d/o|aged|residing)?[^.\n;]{0,120}?(?:hereinafter\s+(?:called|referred\s+to\s+as)\s+(?:the\s+)?["\']?(Vendor|Purchaser|Lessor|Lessee|Landlord|Tenant|Employer|Employee|Plaintiff|Defendant|Petitioner|Respondent)["\']?)'
    for m in re.finditer(role_pattern, text):
        raw_name = m.group(1).strip()
        role = m.group(2).strip()
        clean_name = re.sub(r'(?i)\b(hereinafter|called|the|referred|to|as)\b', '', raw_name).strip()
        if len(clean_name) >= 3 and not any(p["name"].lower() == clean_name.lower() for p in found_parties):
            found_parties.append({"name": clean_name, "role": role.capitalize(), "address": ""})

    # Pattern B: Direct labeled party blocks
    name_matches = list(re.finditer(r'(?i)(?:full legal name|name|parties|between)\s*:\s*([A-Za-z\s.]+)', text))
    for m in name_matches:
        name = m.group(1).strip()
        name = re.split(r'\n|  ', name)[0].strip()
        if len(name) > 3 and name.lower() not in ["lessor", "lessee", "owner", "tenant", "employer", "employee", "parties", "vendor", "purchaser", "plaintiff", "defendant"]:
            if not any(p["name"].lower() == name.lower() for p in found_parties):
                found_parties.append({"name": name, "role": "Party", "address": ""})

    parties = found_parties[:4]
        
    # Remove fake placeholder parties: only keep legitimately parsed parties
    # (If none parsed, parties remains empty list [])

    # 3. Parse Clauses (Multi-Boundary Legal Parser)
    use_segmenter_v2 = os.environ.get("CLAUSE_SEGMENTER_V2", "0") == "1"
    
    if use_segmenter_v2:
        try:
            from clause_segmenter import segment_clauses
            v2_clauses = segment_clauses(text)
            
            if len(v2_clauses) >= 2:
                # Coverage check (~90% of body). We calculate body length from start of first clause to end of last clause.
                first_idx = text.find(v2_clauses[0]["rawText"][:20])
                if first_idx == -1: first_idx = 0
                body_len = len(text) - first_idx
                clause_len = sum(len(c["rawText"]) for c in v2_clauses)
                if body_len > 0 and (clause_len / body_len) > 0.70: # 70% to be safe with coverage check
                    is_notice = _looks_like_legal_notice(text)
                    for c in v2_clauses:
                        header_lower = c["clauseHeader"].lower()
                        text_lower = c["rawText"].lower()
                        c["detectedType"] = classify_clause_type(c["clauseHeader"], c["rawText"], is_notice)
                        state = None
                        if "karnataka" in text_lower or "bengaluru" in text_lower or "bangalore" in text_lower:
                            state = "Karnataka"
                        elif "telangana" in text_lower or "hyderabad" in text_lower:
                            state = "Telangana"
                        elif "maharashtra" in text_lower or "mumbai" in text_lower:
                            state = "Maharashtra"
                        c["jurisdiction"] = {
                            "country": "India",
                            "state": state,
                            "governingLawClausePresent": "governing law" in text_lower or "jurisdiction" in text_lower or "courts" in text_lower
                        }
                    clauses = v2_clauses
        except Exception as e:
            print("V2 segmenter failed:", e)
            pass

    if not clauses:
        clause_patterns = [
            r'\n\s*(\d+)\.\s+([A-Z\s,]{3,40})\b',
            r'\n\s*(\d+)\.\s+([^\n]+)',
            r'\n\s*(\d+)\)\s+([^\n]+)',
            r'(?i)\n\s*(?:Clause|Section|Article)\s+(\d+)[:.-]?\s*([^\n]*)',
            r'\n\s*([IVXLCDM]+)[\.)]\s+([^\n]+)'
        ]
        clause_matches = []
        for pat in clause_patterns:
            m_list = list(re.finditer(pat, text))
            if len(m_list) >= 2:
                clause_matches = m_list
                break
                
        if not clause_matches:
            clause_matches = list(re.finditer(r'\n\s*(\d+)[\.)]\s+([^\n]+)', text))
            
        is_notice = _looks_like_legal_notice(text)
        for i, match in enumerate(clause_matches):
            start = match.start()
            end = clause_matches[i+1].start() if i + 1 < len(clause_matches) else len(text)
            raw_num = match.group(1)
            try:
                clause_num = int(raw_num)
            except ValueError:
                clause_num = i + 1
                
            header_candidate = match.group(2).strip().split('\n')[0].strip() if len(match.groups()) > 1 else f"Clause {clause_num}"
            clause_header = header_candidate or f"Clause {clause_num}"
            clause_text = text[start:end].strip()
            header_lower = clause_header.lower()
            text_lower = clause_text.lower()
            
            # Granular Semantic Clause Taxonomy (header-weighted, word-boundary, notice-aware)
            detected_type = classify_clause_type(clause_header, clause_text, is_notice)
                
            state = None
            if "karnataka" in text_lower or "bengaluru" in text_lower or "bangalore" in text_lower:
                state = "Karnataka"
            elif "telangana" in text_lower or "hyderabad" in text_lower:
                state = "Telangana"
            elif "maharashtra" in text_lower or "mumbai" in text_lower:
                state = "Maharashtra"
                
            governing_law_present = "governing law" in text_lower or "jurisdiction" in text_lower or "courts" in text_lower
            
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
            # Fallback: segment into meaningful paragraphs or sections
            paragraphs = [p.strip() for p in re.split(r'\n{2,}|\.\s+(?=[A-Z0-9])', text) if len(p.strip()) > 30]
            if not paragraphs:
                paragraphs = [text.strip()]
            for idx, p in enumerate(paragraphs[:8]):
                clauses.append({
                    "clauseIndex": idx + 1,
                    "clauseHeader": "General Paragraph" if idx == 0 and len(paragraphs) == 1 else f"Section {idx + 1}",
                    "rawText": p,
                    "sanitizedText": p,
                    "detectedType": "General Paragraph" if idx == 0 and len(paragraphs) == 1 else "Contractual Covenant",
                    "jurisdiction": {
                        "country": "India",
                        "state": "Karnataka" if "karnataka" in p.lower() or "bengaluru" in p.lower() else None,
                        "governingLawClausePresent": "jurisdiction" in p.lower() or "governing" in p.lower()
                    }
                })
            
    return {
        "preamble": preamble,
        "parties": parties,
        "clauses": clauses
    }

def process_text_pipeline(text: str, source_language: str) -> DocumentResponse:
    use_v2 = os.environ.get("KN_NORMALIZER_V2", "1") == "1"
    original_length = len(text)
    raw_text = text
    
    # ==========================================
    # STAGE 0: PRE-PROCESSING: Unicode Normalization
    # ==========================================
    
    if use_v2:
        text = fix_joint_characters(text)
        text = text.replace('\u0CB1', '\u0CB0').replace('\u0CDE', '\u0CB3')
        text = unicodedata.normalize('NFKC', text)
    else:
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
            "ಕೆಲಸದಿಂದ ವಜಾ ಮಾಡುವ ಹಕ್ಕು": "Right to Dismiss/Terminate",
            # Rights & Permissions
            "ಮಾಲೀಕರ ಹಕ್ಕು": "Right of the Owner",
            "ಬಾಡಿಗೆದಾರರ ಹಕ್ಕು": "Right of the Tenant",
            "ಪರಿಶೀಲಿಸುವ ಹಕ್ಕು": "Right to enter and inspect premises upon reasonable notice",
            "ಶಾಂತಿಯುತ ವಾಸದ ಹಕ್ಕು": "Right to peaceful possession and quiet enjoyment of premises",
            "ಮುಂಗಡ ಹಣ ಮರುಪಾವತಿ ಹಕ್ಕು": "Right to full refund of security deposit upon vacating",
            "ಖಾಲಿ ಮಾಡುವ ಹಕ್ಕು": "Right to terminate and vacate the premises",
            # Obligations & Duties
            "ಬಾಡಿಗೆದಾರರ ಕರ್ತವ್ಯ": "Affirmative Duty and Obligation of the Tenant",
            "ಮಾಲೀಕರ ಕರ್ತವ್ಯ": "Affirmative Duty and Obligation of the Owner",
            "ಬಾಧ್ಯತೆ": "Mandatory Obligation",
            "ಜವಾಬ್ದಾರಿ": "shall be solely responsible and obligated for",
            "ಬಾಡಿಗೆದಾರರದ್ದು": "shall be the affirmative obligation and duty of the Tenant",
            "ಮಾಲೀಕರದ್ದು": "shall be the affirmative obligation and duty of the Owner",
            "ವಿದ್ಯುತ್ ಶುಲ್ಕ": "Electricity and power utility charges",
            "ನೀರಿನ ಶುಲ್ಕ": "Water utility charges",
            "ನಿರ್ವಹಣಾ ಶುಲ್ಕ": "Monthly society and building maintenance charges",
            "ಸ್ವಚ್ಛತೆ ಕಾಪಾಡುವುದು": "Shall maintain the premises in good, tenantable and clean condition",
            "ಖಾಲಿ ಮಾಡುವುದು": "Shall vacate and surrender vacant peaceful possession",
            "ಪಾವತಿಸುವುದು": "Shall pay on or before the due date",
            "ಹಿಂತಿರುಗಿಸುವುದು": "Shall refund and return to the other party",
            # Restrictive Covenants & Prohibitions
            "ಉಪ ಬಾಡಿಗೆ ನಿಷೇಧ": "Subletting, assigning, or parting with possession is strictly prohibited",
            "ಉಪ ಬಾಡಿಗೆ": "subletting",
            "ಅನಧಿಕೃತ ಮಾರ್ಪಾಡು ನಿಷೇಧ": "Unauthorized structural alterations, additions, or modifications are strictly prohibited",
            "ವಾಣಿಜ್ಯ ಬಳಕೆಯ ನಿಷೇಧ": "Using residential premises for commercial, trade, or illegal purposes is strictly prohibited",
            "ಅಕ್ರಮ ಚಟುವಟಿಕೆ ನಿಷೇಧ": "Illegal, unlawful, or nuisance activities are strictly prohibited",
            "ಅನಧಿಕೃತ ಮಾರ್ಪಾಡು": "Unauthorized alteration"
        }
        if use_v2:
            text = apply_glossary(text, kannada_map)
        else:
            for k_word, e_word in kannada_map.items():
                text = text.replace(k_word, f" {e_word} ")

    # ==========================================
    # STAGE 2: Efficient Translation (Google Translate Backend)
    # ==========================================
    translated_text = text
    translation_quality = {}
    if source_language.lower() != "en":
        if use_v2:
            report = kannada_quality_report(sanitized_regional_text)
            translation_quality.update(report)
            try:
                translator = GoogleTranslator(source='auto', target='en')
                chunks = split_for_translation(text, max_len=1000)
                translation_quality["total_chunks"] = len(chunks)
                results, failed_indices = translate_with_retry(chunks, translator, retries=3, backoff=2)
                translation_quality["failed_chunks"] = len(failed_indices)
                translated_text = ''.join(results)
            except Exception as e:
                print("Translation Error (V2):", e)
                translated_text = text
                translation_quality["failed_chunks"] = translation_quality.get("total_chunks", 1)
        else:
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
        if not use_v2:
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
            
    # ==========================================
    # STAGE 5: Dual-Path Clause Analysis
    # ==========================================
    doc_domain = classification_result.get("domain", "General")
    doc_state = None
    if structure_data.get("clauses") and len(structure_data["clauses"]) > 0:
        use_segmenter_v2 = os.environ.get("CLAUSE_SEGMENTER_V2", "0") == "1"
        if use_segmenter_v2:
            states = [c.get("jurisdiction", {}).get("state") for c in structure_data["clauses"] if c.get("jurisdiction", {}).get("state")]
            if states:
                from collections import Counter
                doc_state = Counter(states).most_common(1)[0][0]
        else:
            doc_state = structure_data["clauses"][0].get("jurisdiction", {}).get("state")
        
    risk_analysis_results = analyze_all_clauses(
        clauses=structure_data.get("clauses", []),
        domain=doc_domain,
        state=doc_state,
        country="India"
    )

    # ==========================================
    # STAGE 6: Document Truth Summarization
    # ==========================================
    summary_output_data = summarize_document(
        text=translated_text,
        structure=structure_data,
        domain=doc_domain
    )

    return DocumentResponse(
        original_length=original_length,
        raw_text=raw_text,
        sanitized_regional_text=sanitized_regional_text,
        translated_text=translated_text,
        anonymized_text=final_text,
        pii_entities=pii_entities,
        structure=structure_data,
        classification=classification_result,
        risk_analysis=risk_analysis_results,
        summary_output=summary_output_data,
        translation_quality=translation_quality if use_v2 else {}
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

class ClauseAnalysisRequest(BaseModel):
    clauses: list[dict]
    domain: str | None = None
    state: str | None = None
    country: str = "India"

@app.post("/analyze-clauses")
async def analyze_clauses_endpoint(request: ClauseAnalysisRequest):
    try:
        findings = analyze_all_clauses(
            clauses=request.clauses,
            domain=request.domain,
            state=request.state,
            country=request.country
        )
        return findings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SummarizeRequest(BaseModel):
    text: str
    structure: dict | None = None
    domain: str | None = "Legal Agreement"

@app.post("/summarize-document")
async def summarize_document_endpoint(request: SummarizeRequest):
    try:
        summary = summarize_document(
            text=request.text,
            structure=request.structure,
            domain=request.domain or "Legal Agreement"
        )
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatDocumentRequest(BaseModel):
    query: str
    doc_context: dict
    messages: list[dict] | None = None
    domain: str | None = None
    state: str | None = None
    country: str = "India"

@app.post("/chat-document")
async def chat_document_endpoint(request: ChatDocumentRequest):
    try:
        response = answer_document_query(
            query=request.query,
            doc_context=request.doc_context,
            messages=request.messages,
            domain=request.domain,
            state=request.state,
            country=request.country
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
