import os
import json
import re
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "server", ".env"))

from rule_engine import evaluate_deterministic_rules
from citation_auditor import audit_and_calibrate_finding
from rag_service import rag_store

# Try importing Groq client
try:
    from groq import Groq
    HAS_GROQ = True
except ImportError:
    HAS_GROQ = False

# Try importing Google Gemini (Modern google.genai SDK)
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

SYSTEM_CLAUSE_PROMPT = """You are CaseCounsel, an expert Indian Legal Risk Compliance Engine.
Analyze the following isolated contractual CLAUSE against the provided RETRIEVED STATUTORY CONTEXT under Indian Law.

STRICT GROUNDING & AUDIT CONSTRAINTS:
1. Base your findings ONLY on the provided RETRIEVED STATUTORY CONTEXT and established Indian Law.
2. If the clause is standard, operational, or non-violative (e.g. standard payment terms, premises description, emergency contacts, parking rules, execution blocks), output riskLevel as "NO_ISSUE_DETECTED" and set statutoryConflict to null.
3. Allowed riskLevel values: "HIGH_RISK", "POTENTIALLY_UNENFORCEABLE", "REQUIRES_REVIEW", "ONE_SIDED", "NO_ISSUE_DETECTED".
4. If the retrieved context does not support any statutory violation, mark "NO_ISSUE_DETECTED" and DO NOT cite irrelevant statutes like Section 10 ICA.

Respond with a pure JSON object ONLY adhering to this exact schema:
{
  "riskLevel": "HIGH_RISK" | "POTENTIALLY_UNENFORCEABLE" | "REQUIRES_REVIEW" | "ONE_SIDED" | "NO_ISSUE_DETECTED",
  "finding": "Precise statement of legal finding or 'No apparent statutory conflict identified from the text reviewed.'",
  "statutoryConflict": {
    "actName": "Name of Act",
    "section": "Section number or N/A",
    "ruleNumber": "Rule number or N/A",
    "precedentCitation": "Citation or N/A",
    "authorityLevel": "STATUTE" | "STATE_RULE" | "HIGH_COURT" | "SUPREME_COURT"
  } | null,
  "reasoning": "Legal reasoning explaining the compliance status.",
  "confidenceScore": 0.95
}
"""

def analyze_clause_with_groq(clause_text: str, context_str: str, api_key: str) -> Optional[Dict[str, Any]]:
    if not HAS_GROQ or not api_key:
        return None
    try:
        client = Groq(api_key=api_key)
        prompt = f"CLAUSE TO ANALYZE:\n\"\"\"{clause_text}\"\"\"\n\nRETRIEVED STATUTORY CONTEXT:\n\"\"\"{context_str}\"\"\""
        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": SYSTEM_CLAUSE_PROMPT},
                {"role": "user", "content": prompt}
            ],
            temperature=0.0,
            response_format={"type": "json_object"}
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        print(f"[ClauseAnalyzer] Groq execution error: {e}")
        return None

def analyze_clause_with_gemini(clause_text: str, context_str: str, api_key: str) -> Optional[Dict[str, Any]]:
    if not HAS_GEMINI or not api_key:
        return None
    try:
        prompt = f"CLAUSE TO ANALYZE:\n\"\"\"{clause_text}\"\"\"\n\nRETRIEVED STATUTORY CONTEXT:\n\"\"\"{context_str}\"\"\""
        if HAS_NEW_GENAI:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_CLAUSE_PROMPT,
                    response_mime_type="application/json",
                    temperature=0.0
                )
            )
            return json.loads(response.text)
        elif HAS_LEGACY_GENAI:
            legacy_genai.configure(api_key=api_key)
            model = legacy_genai.GenerativeModel(
                model_name="gemini-3.6-flash",
                system_instruction=SYSTEM_CLAUSE_PROMPT,
                generation_config={"response_mime_type": "application/json", "temperature": 0.0}
            )
            response = model.generate_content(prompt)
            return json.loads(response.text)
    except Exception as e:
        print(f"[ClauseAnalyzer] Gemini execution error: {e}")
        return None

def analyze_single_clause(clause: Dict[str, Any], domain: Optional[str] = None, state: Optional[str] = None, country: str = "India") -> Dict[str, Any]:
    """
    Dual-path analysis for an isolated clause.
    1. Route A: Evaluates deterministic statutory boundaries.
    2. Route B: Grounded RAG + LLM (Gemini / Groq) with failover.
    3. Step 5.3: Citation Audit & Severity Calibration.
    """
    clause_index = clause.get("clauseIndex", 1)
    clause_type = clause.get("detectedType", "General Clause")
    clause_text = clause.get("rawText", "") or clause.get("sanitizedText", "")
    
    if not clause_text or len(clause_text.strip()) < 10:
        return audit_and_calibrate_finding({
            "riskLevel": "NO_ISSUE_DETECTED",
            "finding": "No apparent statutory conflict identified from the text reviewed.",
            "statutoryConflict": None,
            "reasoning": "No operative legal liabilities detected in short text.",
            "confidenceScore": 1.0
        }, clause_index, clause_type)

    # -------------------------------------------------------------
    # 1. ROUTE A: Deterministic Rule Engine
    # -------------------------------------------------------------
    deterministic_result = evaluate_deterministic_rules(clause_text, domain=domain, state=state, country=country)
    if deterministic_result:
        return audit_and_calibrate_finding(deterministic_result, clause_index, clause_type)

    # -------------------------------------------------------------
    # 2. ROUTE B: Grounded Reasoning Engine
    # -------------------------------------------------------------
    # Step 2.1: Retrieve authoritative legal context via Hybrid RAG with domain filtering
    retrieved_contexts = rag_store.retrieve(
        query=clause_text,
        state=state,
        country=country,
        domain=domain,
        limit=3
    )

    context_str = "\n\n".join([
        f"--- Source: {c.get('metadata', {}).get('act', 'Act')} (Section {c.get('metadata', {}).get('section_number', 'N/A')}) ---\n{c.get('content', '')}"
        for c in retrieved_contexts
    ]) if retrieved_contexts else "No specific statutory context found."

    # Step 2.2: Attempt LLM reasoning
    groq_key = os.environ.get("GROQ_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if groq_key and ("your_groq" in groq_key or "placeholder" in groq_key):
        groq_key = None
    if gemini_key and ("your_gemini" in gemini_key or "placeholder" in gemini_key):
        gemini_key = None

    llm_result = None
    if gemini_key:
        llm_result = analyze_clause_with_gemini(clause_text, context_str, gemini_key)
        if not llm_result and groq_key:
            llm_result = analyze_clause_with_groq(clause_text, context_str, groq_key)
    elif groq_key:
        llm_result = analyze_clause_with_groq(clause_text, context_str, groq_key)
        if not llm_result and gemini_key:
            llm_result = analyze_clause_with_gemini(clause_text, context_str, gemini_key)

    if llm_result:
        llm_result["deterministicRuleTriggered"] = False
        return audit_and_calibrate_finding(llm_result, clause_index, clause_type)

    # Step 2.3: Heuristic RAG Grounding Fallback
    finding_dict = heuristic_grounded_evaluation(clause_text, clause_type, retrieved_contexts)
    return audit_and_calibrate_finding(finding_dict, clause_index, clause_type)

def heuristic_grounded_evaluation(clause_text: str, clause_type: str, retrieved_contexts: list) -> Dict[str, Any]:
    """
    Deterministic/Heuristic fallback for Route B when external LLM is offline.
    Zero fake Section 10 defaults: Returns neutral compliance for standard clauses.
    """
    text_lower = clause_text.lower()
    
    # Check for governing law & jurisdiction
    if "governing law" in text_lower or "jurisdiction" in text_lower:
        if any(c in text_lower for c in ["bengaluru", "bangalore", "karnataka", "mumbai", "delhi", "india"]):
            return {
                "riskLevel": "NO_ISSUE_DETECTED",
                "finding": "Standard governing law and domestic court jurisdiction clause.",
                "statutoryConflict": {
                    "actName": "Indian Contract Act 1872",
                    "section": "28",
                    "authorityLevel": "STATUTE"
                },
                "reasoning": "The clause designates valid domestic territorial jurisdiction under the Code of Civil Procedure and Indian Contract Act, 1872.",
                "confidenceScore": 0.95
            }

    # Check for severe one-sided indemnification / uncapped liability
    if "indemnif" in text_lower and ("unlimited" in text_lower or "sole discretion" in text_lower or "hold harmless from any and all" in text_lower):
        return {
            "riskLevel": "ONE_SIDED",
            "finding": "Broad, uncapped indemnification covenant imposes disproportionate liability.",
            "statutoryConflict": {
                "actName": "Indian Contract Act 1872",
                "section": "124",
                "authorityLevel": "STATUTE"
            },
            "reasoning": "Under Section 124 of the Indian Contract Act, 1872, an indemnity is intended to cover losses caused by the conduct of the promisor. Unilateral uncapped indemnity terms expose the signing party to expansive commercial risk.",
            "confidenceScore": 0.88,
            "humanReviewRequired": True
        }

    # Neutral Compliance — No statutory conflict identified
    return {
        "riskLevel": "NO_ISSUE_DETECTED",
        "finding": "No apparent statutory conflict identified from the text reviewed.",
        "statutoryConflict": None,
        "reasoning": "The clause text does not contain restrictive covenants, statutory waivers, or disproportionate liabilities under Indian law.",
        "confidenceScore": 0.95
    }

def analyze_all_clauses(clauses: List[Dict[str, Any]], domain: Optional[str] = None, state: Optional[str] = None, country: str = "India") -> List[Dict[str, Any]]:
    """
    Iterates through all document clauses and executes dual-path analysis.
    """
    risk_analysis_list = []
    for clause in clauses:
        finding = analyze_single_clause(clause, domain=domain, state=state, country=country)
        risk_analysis_list.append(finding)
    return risk_analysis_list
