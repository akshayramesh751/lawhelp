"""
make_baseline.py — Generates golden baseline JSON files by running process_text_pipeline()
directly (no HTTP) on known test inputs.

Usage:
    cd ai-service
    python tests/make_baseline.py

Outputs:
    ai-service/tests/golden/baseline_scenario_A.json
    ai-service/tests/golden/baseline_scenario_B.json
    ai-service/tests/golden/baseline_scenario_C.json
    ai-service/tests/golden/baseline_scenario_D.json
    ai-service/tests/golden/baseline_phase5_clauses.json
    ai-service/tests/golden/baseline_kannada_archaic.json
"""
import os
import sys
import json
import copy

# Setup path and env BEFORE importing any ai-service modules
AI_SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, AI_SERVICE_DIR)

# Set placeholder keys so LLM gateway returns None (offline)
os.environ["GROQ_API_KEY"] = "placeholder_test_key"
os.environ["GEMINI_API_KEY"] = "placeholder_test_key"
os.environ["LLM_PROVIDER"] = "auto"

# Ensure legacy behavior for baseline
os.environ["KN_NORMALIZER_V2"] = "0"
os.environ["CLAUSE_SEGMENTER_V2"] = "0"
os.environ["RULE_PACKS_V2"] = "0"

# Monkeypatch GoogleTranslator before importing main
from deep_translator import GoogleTranslator
_original_translate = GoogleTranslator.translate
def fake_translate(self, text=None, **kwargs):
    if text is not None:
        return text
    return ""
GoogleTranslator.translate = fake_translate

# Now import
from main import process_text_pipeline

# ============================================================================
# TEST SCENARIOS (from DOCUMENT_UPLOAD_SPECIFICATIONS_AND_GUIDELINES.md)
# ============================================================================

SCENARIO_A = """EMPLOYMENT AGREEMENT
This Employment Agreement is made on 1st November 2024 between CloudNova Technologies Pvt Ltd ("Employer") and Rohan Verma ("Employee").

1. Engagement & Duties: The Employee is appointed as Senior Software Engineer. The Employee will perform system engineering and backend development.
2. Remuneration: The Employer shall pay a monthly gross salary of ₹1,40,000/-, payable on the 1st of each calendar month. An annual bonus of ₹1,80,000/- is subject to performance review on 31st March.
3. Confidentiality: The Employee agrees to keep all company confidential information and trade secrets strictly secure during and after tenure.
4. Termination & Notice: Either party may terminate this agreement by providing 30 days prior written notice or gross salary in lieu thereof.
5. Governing Law: This agreement shall be governed by the laws of India and subject to the jurisdiction of the courts at Bengaluru, Karnataka."""

SCENARIO_B = """EXECUTIVE EMPLOYMENT AGREEMENT
This Agreement is entered into between Apex Corp Pvt Ltd ("Employer") and Ananya Roy ("Employee").

1. Restrictive Covenants: The Employee strictly agrees that for a period of 24 months following termination of employment for any reason, the Employee shall not directly or indirectly work for, consult with, or engage in any business competing with the Employer across India.
2. Asymmetric Termination: The Employer reserves the absolute right to terminate the Employee immediately without any prior notice or compensation. The Employee must provide a mandatory 90-day prior written notice before resigning.
3. Waiver of Statutory Benefits: The Employee hereby voluntarily forfeits and waives all claims to statutory gratuity and retrenchment compensation under all applicable labour enactments.
4. Bar on Legal Proceedings: Any disputes arising hereunder shall be settled solely by internal company management. The Employee expressly agrees not to institute any legal proceedings, injunctions, or suits in any court of law or judicial tribunal."""

SCENARIO_C = """RESIDENTIAL LEASE AGREEMENT
This Agreement is made on 1st August 2024 between Mr. S. K. Narayana (Lessor) and Ms. Priyanka Sen (Lessee).

1. Demised Premises: Flat No. 402, Green Glen Heights, Bellandur, Bengaluru.
2. Monthly Rent & Maintenance: The Lessee shall pay a monthly rent of ₹45,000/- on or before the 5th of each calendar month.
3. Security Deposit: The Lessee has deposited an interest-free refundable security deposit of ₹3,00,000/- with the Lessor.
4. Lease Tenure & Lock-in: The lease duration is 11 months with a mandatory lock-in period of 6 months.
5. Notice Period: Either party may terminate the tenancy by providing 2 months written notice after the lock-in period.
6. Governing Law: Governed by the Karnataka Rent Control laws and Transfer of Property Act 1882 with jurisdiction in Bengaluru courts."""

SCENARIO_D = """ಬಾಡಿಗೆ ಕರಾರು ಪತ್ರ (Rental Agreement)
ದಿನಾಂಕ 15ನೇ ಜುಲೈ 2024 ರಂದು ಬೆಂಗಳೂರಿನಲ್ಲಿ ಮಾಡಿಕೊಂಡ ಒಪ್ಪಂದ.
ಮಾಲೀಕರು: ರಾಜೇಶ್ ಕುಮಾರ್ ಶರ್ಮಾ. ಬಾಡಿಗೆದಾರರು: ಅನನ್ಯ ಅಯ್ಯರ್.
ತಿಂಗಳ ಬಾಡಿಗೆ: ₹35,000/-. ಮುಂಗಡ ಠೇವಣಿ: ₹2,00,000/-.
ಗಮನಿಸಿ: ಎರಡೂ ಕಡೆಯವರು 1 ತಿಂಗಳ ಲಿಖಿತ ಮುನ್ಸೂಚನೆ (Notice) ನೀಡಿ ಒಪ್ಪಂದವನ್ನು ಕೊನೆಗೊಳಿಸಬಹುದು.
ನ್ಯಾಯವ್ಯಾಪ್ತಿ: ಬೆಂಗಳೂರು ನ್ಯಾಯಾಲಯಗಳು."""

# From scratch/test_phase5_clause_analysis.js - the 6-clause test input
PHASE5_FULL_DOC = """EMPLOYMENT AGREEMENT
This Employment Agreement is entered into between ABC Tech Pvt Ltd and Rahul Sharma (Aadhaar: 1234 5678 9012, PAN: ABCDE1234F).

Clause 1. Post-Employment Non-Compete
The Employee agrees that for a period of 24 months following termination of employment, the Employee shall not work for any competitor across India.

Clause 2. Termination
The Employer may terminate this employment agreement immediately without notice, whereas the Employee is required to provide 90 days prior written notice.

Clause 3. Governing Law
This agreement shall be governed by the laws of India and courts at Bengaluru, Karnataka shall have jurisdiction."""

# From scratch/test_pipeline_features.js - archaic Kannada
KANNADA_ARCHAIC = "ಕ ್ ಷೇತ್ರ ಮತ್ತು ಱಾಮು ೞಾಮು"

# ============================================================================
# Stable serialization: strip non-deterministic fields
# ============================================================================

UNSTABLE_KEYS = {"startIndex", "endIndex"}  # PII entity positions may shift

def stabilize_output(data):
    """Remove or normalize non-deterministic fields from pipeline output."""
    if isinstance(data, dict):
        result = {}
        for k, v in data.items():
            if k in UNSTABLE_KEYS:
                continue
            result[k] = stabilize_output(v)
        return result
    elif isinstance(data, list):
        return [stabilize_output(item) for item in data]
    else:
        return data


def run_and_save(name, text, source_language, output_dir):
    """Run pipeline on input text and save stabilized JSON output."""
    print(f"  Running pipeline for: {name}...")
    try:
        result = process_text_pipeline(text, source_language)
        # Convert Pydantic model to dict
        result_dict = result.model_dump() if hasattr(result, 'model_dump') else result.dict()
        stable = stabilize_output(result_dict)
        
        output_path = os.path.join(output_dir, f"baseline_{name}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(stable, f, indent=2, ensure_ascii=False, sort_keys=True)
        print(f"  [SUCCESS] Saved: {output_path}")
        return True
    except Exception as e:
        print(f"  [FAILED] for {name}: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    output_dir = os.path.join(AI_SERVICE_DIR, "tests", "golden")
    os.makedirs(output_dir, exist_ok=True)
    
    print("=" * 60)
    print("Generating golden baseline outputs...")
    print("=" * 60)
    
    scenarios = [
        ("scenario_A", SCENARIO_A, "en"),
        ("scenario_B", SCENARIO_B, "en"),
        ("scenario_C", SCENARIO_C, "en"),
        ("scenario_D", SCENARIO_D, "auto"),
        ("phase5_clauses", PHASE5_FULL_DOC, "en"),
        ("kannada_archaic", KANNADA_ARCHAIC, "auto"),
    ]
    
    passed = 0
    failed = 0
    for name, text, lang in scenarios:
        if run_and_save(name, text, lang, output_dir):
            passed += 1
        else:
            failed += 1
    
    print(f"\n{'=' * 60}")
    print(f"Baseline generation complete: {passed} passed, {failed} failed")
    print(f"{'=' * 60}")
    
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
