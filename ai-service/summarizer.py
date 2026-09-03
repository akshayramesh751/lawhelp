import os
import json
import re
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

# Load environment variables from ai-service/.env or server/.env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "server", ".env"))

from llm_gateway import llm_gateway

# Import Groq
try:
    from groq import Groq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False

# Import Google Gemini (Modern google.genai SDK)
try:
    from google import genai
    from google.genai import types
    HAS_NEW_GENAI = True
except ImportError:
    HAS_NEW_GENAI = False

try:
    import google.generativeai as legacy_genai
    HAS_LEGACY_GENAI = True
except ImportError:
    HAS_LEGACY_GENAI = False

HAS_GEMINI = HAS_NEW_GENAI or HAS_LEGACY_GENAI

SYSTEM_SUMMARIZER_PROMPT = """You are CaseCounsel, an expert AI Legal Document Ground Truth Summarizer.
Your mission is to analyze the provided contract and extract a strictly grounded, objective summary of its explicit operational, financial, and legal terms into pure JSON format.

CRITICAL ANTI-HALLUCINATION & GROUNDING DIRECTIVES:
1. Extract ONLY facts, covenants, and terms that are EXPLICITLY STATED in the provided text.
2. DO NOT assume, infer, or hallucinate standard boilerplate clauses (such as confidentiality, intellectual property, 30-day notice, dispute resolution, or governing law) if they are not explicitly written in the contract.
3. If an agreement does not mention confidentiality, DO NOT add a confidentiality obligation.
4. If an agreement does not mention termination notice or material breach, DO NOT add termination conditions. Output an empty array [] for terminationConditions.
5. If an agreement does not contain an explicit governing law or court jurisdiction clause, set governingLaw to "Not specified in the document".

REGIONAL & TRANSLATED INDIAN CONTRACT RECOGNITION:
- For regional Indian and translated contracts (e.g., Rental/Lease, Employment, NDA, Service Agreements), identify explicit covenants, duties, utility payment responsibilities, maintenance burdens, vacating covenants, and subletting/alteration restrictions as 'obligations'.
- Identify permissions (such as peaceful possession, quiet enjoyment, entry/inspection upon prior notice, salary/leave entitlements, and security deposit refund) as 'rights'.

SCHEMA DEFINITION:
{
  "executiveSummary": "Concise 2-3 sentence overview identifying the document type, primary executing parties, and core subject matter.",
  "rights": ["List of explicit legal/operational rights granted in text. Empty array [] if none stated."],
  "obligations": ["List of explicit affirmative duties and covenants stated in text. Empty array [] if none stated."],
  "financialTerms": [
    {
      "description": "Specific payment name (e.g., Monthly Rent, Security Deposit, Base Gross Salary)",
      "amount": "Exact amount with currency (e.g., ₹42,000/-)",
      "deadline": "Payment timing or due date (e.g., On or before 5th of each month)"
    }
  ],
  "terminationConditions": ["Explicit termination notice periods and triggers. Empty array [] if silent."],
  "deadlinesAndMilestones": ["Explicit tenure, lock-in, effective dates, or milestones. Empty array [] if silent."],
  "governingLaw": "Explicit governing statute and court jurisdiction, or 'Not specified in the document'."
}
"""

def summarize_with_groq(text: str, api_key: str) -> Optional[Dict[str, Any]]:
    """Generates document summary using Groq LPU inference with multi-model failover."""
    if not HAS_GROQ or not api_key:
        return None
    models_to_try = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"]
    client = Groq(api_key=api_key)
    for model_name in models_to_try:
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_SUMMARIZER_PROMPT},
                    {"role": "user", "content": f"Analyze and summarize this legal document strictly without hallucinating absent terms:\n\n{text}"}
                ],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            raw = completion.choices[0].message.content
            if raw and raw.strip().startswith("{"):
                return json.loads(raw)
        except Exception as e:
            print(f"[Summarizer] Groq ({model_name}) error: {e}")
            continue
    return None

def summarize_with_gemini(text: str, api_key: str) -> Optional[Dict[str, Any]]:
    """Generates document summary using Google Gemini (google.genai)."""
    if not HAS_GEMINI or not api_key:
        return None
    try:
        if HAS_NEW_GENAI:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=f"Analyze and summarize this legal document strictly without hallucinating absent terms:\n\n{text}",
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_SUMMARIZER_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.0
                )
            )
            if response.text and response.text.strip().startswith("{"):
                return json.loads(response.text)
        elif HAS_LEGACY_GENAI:
            legacy_genai.configure(api_key=api_key)
            model = legacy_genai.GenerativeModel(
                model_name="gemini-3.6-flash",
                system_instruction=SYSTEM_SUMMARIZER_PROMPT,
                generation_config={"response_mime_type": "application/json", "temperature": 0.0}
            )
            response = model.generate_content(f"Analyze and summarize this legal document strictly without hallucinating absent terms:\n\n{text}")
            if response.text and response.text.strip().startswith("{"):
                return json.loads(response.text)
    except Exception as e:
        print(f"[Summarizer] Gemini execution error ({e}), handing over to Groq...")
    return None

def heuristic_fallback_summary(text: str, structure: Dict[str, Any], domain: str) -> Dict[str, Any]:
    """
    Strict deterministic heuristic extraction when external LLM APIs are offline.
    Zero hallucination: Only extracts terms verified via targeted regex.
    """
    parties = structure.get("parties", [])
    parties_str = " and ".join([p.get("name", "Party") for p in parties if p.get("name")]) if parties else "the executing parties"
    
    # 1. Financial Extraction
    financials = []
    # Identify labeled amounts (e.g. rent, deposit, maintenance, salary, bonus)
    labeled_patterns = [
        (r'(?i)(?:monthly\s+)?rent\b[^\n\d₹]*(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{2})?)', "Monthly Rent"),
        (r'(?i)security\s+deposit\b[^\n\d₹]*(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{2})?)', "Security Deposit"),
        (r'(?i)maintenance\b[^\n\d₹]*(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{2})?)', "Maintenance Charges"),
        (r'(?i)(?:salary|compensation)\b[^\n\d₹]*(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{2})?)', "Base Salary / Compensation"),
        (r'(?i)bonus\b[^\n\d₹]*(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{2})?)', "Performance Bonus")
    ]
    
    for pattern, label in labeled_patterns:
        m = re.search(pattern, text)
        if m and m.group(1):
            # Look for payment deadline near the amount
            start_pos = max(0, m.start() - 50)
            end_pos = min(len(text), m.end() + 100)
            window = text[start_pos:end_pos]
            deadline_match = re.search(r'(?i)(?:on\s+or\s+before|payable\s+by|before|by)\s+(?:the\s+)?(\d{1,2}(?:st|nd|rd|th)?(?:\s+of\s+each\s+month|\s+[A-Za-z]+)?)', window)
            deadline = f"Payable {deadline_match.group(0)}" if deadline_match else "As stipulated in agreement schedule"
            financials.append({
                "description": label,
                "amount": f"₹{m.group(1)}",
                "deadline": deadline
            })
            
    # Generic currency fallback if no labeled amounts found
    if not financials:
        currency_matches = re.findall(r'(?:₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{2})?)', text, re.IGNORECASE)
        for idx, amt in enumerate(currency_matches[:4]):
            financials.append({
                "description": f"Contractual Payment Schedule #{idx + 1}",
                "amount": f"₹{amt}",
                "deadline": "As specified in agreement terms"
            })

    # 2. Rights Extraction (Explicit rights, permissions, and entitlements)
    rights = []
    if any(k in text.lower() for k in ["right to", "entitled to", "permitted to", "eligible for", "shall receive", "quiet enjoyment", "peaceful possession", "inspect", "refund"]):
        rights_matches = re.findall(
            r'(?i)(?:shall\s+have\s+the\s+right\s+to|is\s+entitled\s+to|permitted\s+to|eligible\s+for|shall\s+receive|right\s+to\s+(?:enter\s+and\s+)?inspect|right\s+to\s+peaceful|right\s+to\s+full\s+refund|authorized\s+to)\s+([^.\n;]+)',
            text
        )
        for r in rights_matches[:4]:
            rights.append(f"Operational Right / Entitlement: {r.strip()}")

    # 3. Obligations Extraction (Explicit duties, utilities, maintenance, and covenants)
    obligations = []
    duty_matches = re.findall(
        r'(?i)(?:shall\s+(?:pay|maintain|bear|provide|keep|vacate|refund|return|abide|surrender)|must\s+(?:pay|maintain|provide|vacate)|responsible\s+and\s+obligated\s+for|duty\s+and\s+obligation\s+of|strictly\s+prohibited|shall\s+not\s+sublet|subletting\s+is\s+strictly\s+prohibited|is\s+the\s+affirmative\s+obligation)\s+([^.\n;]+)',
        text
    )
    for d in duty_matches[:5]:
        obligations.append(f"Affirmative Duty: {d.strip()}")

    # 4. Termination & Notice Extraction (Strictly if present in text)
    termination_conditions = []
    notice_match = re.search(r'(?i)(\d+)\s*(?:days?|months?)\s+(?:prior\s+)?(?:written\s+)?notice', text)
    if notice_match:
        termination_conditions.append(f"Termination permitted upon {notice_match.group(0)} in writing")
    if "immediate termination" in text.lower() or "terminate immediately" in text.lower():
        termination_conditions.append("Agreement permits immediate termination under specified triggers")

    # 5. Deadlines & Milestones
    deadlines = []
    tenure_match = re.search(r'(?i)(?:tenure|duration|period\s+of)\s*(?:shall\s+be\s+for\s+)?(\d+\s*(?:months?|years?))', text)
    lockin_match = re.search(r'(?i)lock-?in\s*(?:period\s+of\s*)?(\d+\s*(?:months?|years?))', text)
    if tenure_match:
        deadlines.append(f"Tenure: {tenure_match.group(0).strip()}")
    if lockin_match:
        deadlines.append(f"Lock-in Period: {lockin_match.group(0).strip()}")

    # 6. Governing Law & Jurisdiction (Strictly if present)
    gov_str = "Not specified in the document"
    gov_match = re.search(r'(?i)governed\s+by\s+(?:the\s+)?(?:laws\s+of\s+)?([^.\n]+)', text)
    jurisdiction_match = re.search(r'(?i)jurisdiction\s+of\s+(?:the\s+)?courts?\s+(?:at|in)\s+([^.\n]+)', text)
    
    if gov_match and jurisdiction_match:
        gov_str = f"Governed by {gov_match.group(1).strip()} with jurisdiction of courts at {jurisdiction_match.group(1).strip()}"
    elif gov_match:
        gov_str = f"Governed by {gov_match.group(1).strip()}"
    elif jurisdiction_match:
        gov_str = f"Jurisdiction of courts at {jurisdiction_match.group(1).strip()}"

    return {
        "executiveSummary": f"This is a {domain or 'legal agreement'} entered into between {parties_str} regarding the designated contractual covenants.",
        "rights": rights,
        "obligations": obligations,
        "financialTerms": financials,
        "terminationConditions": termination_conditions,
        "deadlinesAndMilestones": deadlines,
        "governingLaw": gov_str
    }

def validate_and_format_summary(data: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures the summary dictionary strictly satisfies all schema types without injecting fake defaults."""
    return {
        "executiveSummary": str(data.get("executiveSummary", "Legal agreement between the executing parties.")),
        "rights": [str(r) for r in data.get("rights", [])],
        "obligations": [str(o) for o in data.get("obligations", [])],
        "financialTerms": [
            {
                "description": str(f.get("description", "Payment")),
                "amount": str(f.get("amount", "As stated")),
                "deadline": str(f.get("deadline", "As stipulated"))
            }
            for f in data.get("financialTerms", [])
        ],
        "terminationConditions": [str(t) for t in data.get("terminationConditions", [])],
        "deadlinesAndMilestones": [str(m) for m in data.get("deadlinesAndMilestones", [])],
        "governingLaw": str(data.get("governingLaw", "Not specified in the document"))
    }

def summarize_document(text: str, structure: Optional[Dict[str, Any]] = None, domain: str = "Legal Agreement") -> Dict[str, Any]:
    """
    Main entry point for Phase 6 Document Truth Summarization.
    Routes through centralized LLMGateway with automatic failover and deterministic fallback.
    """
    structure = structure or {}
    user_prompt = f"Analyze and summarize this legal document strictly without hallucinating absent terms:\n\n{text}"
    summary_result = llm_gateway.generate_json(SYSTEM_SUMMARIZER_PROMPT, user_prompt)

    # Fallback to zero-hallucination deterministic extraction
    if not summary_result:
        summary_result = heuristic_fallback_summary(text, structure, domain)

    return validate_and_format_summary(summary_result)
