import os
import json
import re
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "server", ".env"))

import hashlib
from rule_engine import evaluate_deterministic_rules
from citation_auditor import audit_and_calibrate_finding
from rag_service import rag_store
from cache_service import clause_cache
from llm_gateway import llm_gateway

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
5. If a clause imposes unilateral uncapped indemnification, disproportionate liability at sole discretion, or unlimited hold-harmless, mark "ONE_SIDED" or "REQUIRES_REVIEW" citing Section 73/124 ICA 1872.

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

SYSTEM_BATCH_CLAUSE_PROMPT = """You are CaseCounsel, an expert Indian Legal Risk Compliance Engine.
Analyze the following batch of isolated contractual CLAUSES against their respective RETRIEVED STATUTORY CONTEXT under Indian Law.

STRICT GROUNDING & AUDIT CONSTRAINTS:
1. Base your findings ONLY on the provided RETRIEVED STATUTORY CONTEXT and established Indian Law for each clause.
2. If a clause is standard, operational, or non-violative (e.g. standard payment terms, premises description, emergency contacts, parking rules, execution blocks), output riskLevel as "NO_ISSUE_DETECTED" and set statutoryConflict to null.
3. Allowed riskLevel values: "HIGH_RISK", "POTENTIALLY_UNENFORCEABLE", "REQUIRES_REVIEW", "ONE_SIDED", "NO_ISSUE_DETECTED".
4. If the retrieved context does not support any statutory violation, mark "NO_ISSUE_DETECTED" and DO NOT cite irrelevant statutes like Section 10 ICA.
5. If a clause imposes unilateral uncapped indemnification, disproportionate liability at sole discretion, or unlimited hold-harmless, mark "ONE_SIDED" or "REQUIRES_REVIEW" citing Section 73/124 ICA 1872.

Respond with a pure JSON object containing a "results" array matching each clause by its clauseIndex:
{
  "results": [
    {
      "clauseIndex": 1,
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
  ]
}
"""

def build_batch_prompt(batch_items: List[Dict[str, Any]]) -> str:
    """Constructs a composite prompt for multiple ambiguous clauses."""
    prompt_parts = ["Analyze the following contractual clauses and return the compliance finding for each clauseIndex:\n"]
    for item in batch_items:
        idx = item.get("clauseIndex", 1)
        c_type = item.get("clauseType", "Contractual Clause")
        text = item.get("text", "")
        context_str = item.get("context_str", "No specific statutory context.")
        prompt_parts.append(
            f"=== CLAUSE #{idx} (Type: {c_type}) ===\n"
            f"CLAUSE TEXT:\n\"\"\"{text}\"\"\"\n"
            f"RETRIEVED STATUTORY CONTEXT:\n\"\"\"{context_str}\"\"\"\n"
        )
    return "\n".join(prompt_parts)

def analyze_clause_batch_with_groq(batch_items: List[Dict[str, Any]], api_key: str) -> Optional[List[Dict[str, Any]]]:
    """Evaluates a batch of clauses in a single Groq request with multi-model failover."""
    if not HAS_GROQ or not api_key or not batch_items:
        return None
    models_to_try = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"]
    client = Groq(api_key=api_key)
    prompt = build_batch_prompt(batch_items)
    for model_name in models_to_try:
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_BATCH_CLAUSE_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            raw = completion.choices[0].message.content
            if raw and raw.strip().startswith("{"):
                parsed = json.loads(raw)
                results = parsed.get("results")
                if isinstance(results, list):
                    return results
        except Exception as e:
            print(f"[ClauseAnalyzer Batch] Groq ({model_name}) error: {e}")
            continue
    return None

def analyze_clause_batch_with_gemini(batch_items: List[Dict[str, Any]], api_key: str) -> Optional[List[Dict[str, Any]]]:
    """Evaluates a batch of clauses in a single Gemini request."""
    if not HAS_GEMINI or not api_key or not batch_items:
        return None
    prompt = build_batch_prompt(batch_items)
    for attempt in range(2):
        try:
            if HAS_NEW_GENAI:
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model="gemini-3.6-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_BATCH_CLAUSE_PROMPT,
                        response_mime_type="application/json",
                        temperature=0.0
                    )
                )
                if response.text and response.text.strip().startswith("{"):
                    parsed = json.loads(response.text)
                    results = parsed.get("results")
                    if isinstance(results, list):
                        return results
            elif HAS_LEGACY_GENAI:
                legacy_genai.configure(api_key=api_key)
                model = legacy_genai.GenerativeModel(
                    model_name="gemini-3.6-flash",
                    system_instruction=SYSTEM_BATCH_CLAUSE_PROMPT,
                    generation_config={"response_mime_type": "application/json", "temperature": 0.0}
                )
                response = model.generate_content(prompt)
                if response.text and response.text.strip().startswith("{"):
                    parsed = json.loads(response.text)
                    results = parsed.get("results")
                    if isinstance(results, list):
                        return results
        except Exception as e:
            print(f"[ClauseAnalyzer Batch] Gemini attempt {attempt + 1} error: {e}")
            if attempt == 0:
                import time
                time.sleep(1.0)
    return None

def analyze_clause_with_groq(clause_text: str, context_str: str, api_key: str) -> Optional[Dict[str, Any]]:
    if not HAS_GROQ or not api_key:
        return None
    models_to_try = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"]
    client = Groq(api_key=api_key)
    prompt = f"CLAUSE TO ANALYZE:\n\"\"\"{clause_text}\"\"\"\n\nRETRIEVED STATUTORY CONTEXT:\n\"\"\"{context_str}\"\"\""
    for model_name in models_to_try:
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_CLAUSE_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            raw = completion.choices[0].message.content
            if raw and raw.strip().startswith("{"):
                return json.loads(raw)
        except Exception as e:
            print(f"[ClauseAnalyzer] Groq ({model_name}) error: {e}")
            continue
    return None

def analyze_clause_with_gemini(clause_text: str, context_str: str, api_key: str) -> Optional[Dict[str, Any]]:
    if not HAS_GEMINI or not api_key:
        return None
    prompt = f"CLAUSE TO ANALYZE:\n\"\"\"{clause_text}\"\"\"\n\nRETRIEVED STATUTORY CONTEXT:\n\"\"\"{context_str}\"\"\""
    for attempt in range(2):
        try:
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
                if response.text and response.text.strip().startswith("{"):
                    return json.loads(response.text)
            elif HAS_LEGACY_GENAI:
                legacy_genai.configure(api_key=api_key)
                model = legacy_genai.GenerativeModel(
                    model_name="gemini-3.6-flash",
                    system_instruction=SYSTEM_CLAUSE_PROMPT,
                    generation_config={"response_mime_type": "application/json", "temperature": 0.0}
                )
                response = model.generate_content(prompt)
                if response.text and response.text.strip().startswith("{"):
                    return json.loads(response.text)
        except Exception as e:
            print(f"[ClauseAnalyzer] Gemini attempt {attempt + 1} error: {e}")
            if attempt == 0:
                import time
                time.sleep(1.0)
    return None

def analyze_single_clause(clause: Dict[str, Any], domain: Optional[str] = None, state: Optional[str] = None, country: str = "India") -> Dict[str, Any]:
    """
    Dual-path analysis for an isolated clause.
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

    # 1. ROUTE A: Deterministic Rule Engine
    deterministic_result = evaluate_deterministic_rules(clause_text, domain=domain, state=state, country=country)
    if deterministic_result:
        return audit_and_calibrate_finding(deterministic_result, clause_index, clause_type)

    # 2. ROUTE B: Grounded Reasoning Engine    # Step 2.1: Retrieve authoritative legal context via Hybrid RAG with domain filtering
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

    auth_hash = hashlib.sha256(context_str.encode("utf-8")).hexdigest()[:16]

    # Context-Aware Cache Check
    cached_finding = clause_cache.get(clause_text, clause_type, domain, state, country, authority_hash=auth_hash)
    if cached_finding:
        return cached_finding

    prompt = f"CLAUSE TO ANALYZE:\n\"\"\"{clause_text}\"\"\"\n\nRETRIEVED STATUTORY CONTEXT:\n\"\"\"{context_str}\"\"\""
    llm_result = llm_gateway.generate_json(SYSTEM_CLAUSE_PROMPT, prompt)

    if llm_result:
        llm_result["deterministicRuleTriggered"] = False
        final_res = audit_and_calibrate_finding(llm_result, clause_index, clause_type)
        clause_cache.set(clause_text, final_res, clause_type, domain, state, country, authority_hash=auth_hash)
        return final_res

    finding_dict = heuristic_grounded_evaluation(clause_text, clause_type, retrieved_contexts)
    final_res = audit_and_calibrate_finding(finding_dict, clause_index, clause_type)
    clause_cache.set(clause_text, final_res, clause_type, domain, state, country, authority_hash=auth_hash)
    return final_res

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
    Optimized Dual-Path Clause Analysis Engine with Batch Builder and Safe Context-Aware Cache.
    1. Pass 1: Resolves deterministic boundaries (0ms) & checks Context-Aware Cache.
    2. Pass 2: Batches remaining uncached ambiguous clauses into composite LLM requests (up to 5 per batch).
    3. Pass 3: Stores new findings into Cache and returns calibrated results in original order.
    """
    findings_map: Dict[int, Dict[str, Any]] = {}
    ambiguous_items: List[Dict[str, Any]] = []

    # --- PASS 1: Trivial, Deterministic & Cache Pre-Check ---
    for clause in clauses:
        clause_index = clause.get("clauseIndex", 1)
        clause_type = clause.get("detectedType", "General Clause")
        clause_text = clause.get("rawText", "") or clause.get("sanitizedText", "")

        if not clause_text or len(clause_text.strip()) < 10:
            findings_map[clause_index] = audit_and_calibrate_finding({
                "riskLevel": "NO_ISSUE_DETECTED",
                "finding": "No apparent statutory conflict identified from the text reviewed.",
                "statutoryConflict": None,
                "reasoning": "No operative legal liabilities detected in short text.",
                "confidenceScore": 1.0
            }, clause_index, clause_type)
            continue

        # Check Route A (Deterministic Rule Engine)
        det_result = evaluate_deterministic_rules(clause_text, domain=domain, state=state, country=country)
        if det_result:
            findings_map[clause_index] = audit_and_calibrate_finding(det_result, clause_index, clause_type)
            continue

        # Retrieve Hybrid RAG context
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

        auth_hash = hashlib.sha256(context_str.encode("utf-8")).hexdigest()[:16]

        # Context-Aware Cache Check
        cached = clause_cache.get(clause_text, clause_type, domain, state, country, authority_hash=auth_hash)
        if cached:
            cached_copy = dict(cached)
            cached_copy["clauseIndex"] = clause_index
            findings_map[clause_index] = cached_copy
            continue

        # Step 4: Authority Validation Gate (Short-circuit weak/benign operational clauses)
        auth_val = rag_store.validate_authority_strength(retrieved_contexts, clause_text, clause_type, domain)
        if not auth_val.get("is_authoritative", True) and not auth_val.get("has_conflict_risk", False):
            calibrated = audit_and_calibrate_finding({
                "riskLevel": "NO_ISSUE_DETECTED",
                "finding": "No apparent statutory conflict identified from the text reviewed.",
                "statutoryConflict": None,
                "reasoning": "Standard operational clause with no statutory liability indicators under Indian law.",
                "confidenceScore": 0.95
            }, clause_index, clause_type)
            clause_cache.set(clause_text, calibrated, clause_type, domain, state, country, authority_hash=auth_hash)
            findings_map[clause_index] = calibrated
            continue

        ambiguous_items.append({
            "clauseIndex": clause_index,
            "clauseType": clause_type,
            "text": clause_text,
            "context_str": context_str,
            "auth_hash": auth_hash,
            "retrieved_contexts": retrieved_contexts
        })

    # --- PASS 2: Batch Execution of Ambiguous Clauses (Cache Misses) ---
    if ambiguous_items:
        batch_size = 5
        for i in range(0, len(ambiguous_items), batch_size):
            chunk = ambiguous_items[i:i + batch_size]
            prompt = build_batch_prompt(chunk)
            res_json = llm_gateway.generate_json(SYSTEM_BATCH_CLAUSE_PROMPT, prompt)
            batch_results = res_json.get("results") if isinstance(res_json, dict) else None

            # Map returned batch findings to clause indexes
            returned_map = {}
            if batch_results:
                for res in batch_results:
                    c_idx = res.get("clauseIndex")
                    if c_idx is not None:
                        returned_map[int(c_idx)] = res

            for item in chunk:
                c_idx = item["clauseIndex"]
                c_type = item["clauseType"]
                c_text = item["text"]
                c_auth_hash = item["auth_hash"]
                if c_idx in returned_map:
                    raw_finding = returned_map[c_idx]
                    raw_finding["deterministicRuleTriggered"] = False
                    calibrated = audit_and_calibrate_finding(raw_finding, c_idx, c_type)
                else:
                    # Fallback to heuristic grounded evaluation
                    fallback_finding = heuristic_grounded_evaluation(c_text, c_type, item["retrieved_contexts"])
                    calibrated = audit_and_calibrate_finding(fallback_finding, c_idx, c_type)

                # Store in Context-Aware Cache
                clause_cache.set(c_text, calibrated, c_type, domain, state, country, authority_hash=c_auth_hash)
                findings_map[c_idx] = calibrated

    # --- PASS 3: Assemble ordered results ---
    ordered_findings = []
    for clause in clauses:
        c_idx = clause.get("clauseIndex", 1)
        if c_idx in findings_map:
            ordered_findings.append(findings_map[c_idx])
        else:
            ordered_findings.append(analyze_single_clause(clause, domain=domain, state=state, country=country))

    return ordered_findings
