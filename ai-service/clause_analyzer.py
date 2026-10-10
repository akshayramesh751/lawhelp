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
1. Base your findings ONLY on the provided clause text, RETRIEVED STATUTORY CONTEXT, and established Indian Law.
2. Allowed riskLevel values: "HIGH_RISK", "POTENTIALLY_UNENFORCEABLE", "REQUIRES_REVIEW", "ONE_SIDED", "NO_ISSUE_DETECTED".
3. FOR STANDARD / COMPLIANT CLAUSES ("NO_ISSUE_DETECTED"):
   - Set statutoryConflict to null.
   - "finding": ONE sentence that is UNIQUE to this clause: name its concrete subject (the specific party, amount, date, property, cheque, allegation or obligation it mentions). NEVER start with a stock phrase such as "No apparent statutory conflict identified" and NEVER reuse wording from another clause.
   - "reasoning": 2-4 sentences quoting or paraphrasing the clause's OWN facts and explaining why those specific facts raise no statutory problem. Cite an Act/Section ONLY if it is genuinely relevant to this clause's subject. Do NOT mention sale-deed items (TDS 194-IA, stamp duty, registration, RTGS) unless the clause itself deals with them. If the document is a legal notice/pleading, analyse the clause as a statement/averment/demand, not as a contractual covenant.
   - If a clause is purely narrative (facts/recitals) with nothing assessable, say so plainly and use a lower confidenceScore rather than inventing legal analysis.
4. FOR FLAGGED CLAUSES ("HIGH_RISK", "POTENTIALLY_UNENFORCEABLE", "REQUIRES_REVIEW", "ONE_SIDED"):
   - "finding": Detail the exact legal conflict, restraint of trade/legal proceedings, or disproportionate liability.
   - "statutoryConflict": Cite the exact Act, Section, and authority level (e.g., Section 27/28/73/124 Indian Contract Act 1872).
   - "reasoning": Explain the statutory basis of the violation and legal risk.

Respond with a pure JSON object ONLY adhering to this exact schema:
{
  "riskLevel": "HIGH_RISK" | "POTENTIALLY_UNENFORCEABLE" | "REQUIRES_REVIEW" | "ONE_SIDED" | "NO_ISSUE_DETECTED",
  "finding": "Descriptive legal finding summarizing the clause and its compliance status.",
  "statutoryConflict": {
    "actName": "Name of Act",
    "section": "Section number or N/A",
    "ruleNumber": "Rule number or N/A",
    "precedentCitation": "Citation or N/A",
    "authorityLevel": "STATUTE" | "STATE_RULE" | "HIGH_COURT" | "SUPREME_COURT"
  } | null,
  "reasoning": "Thorough document-grounded legal reasoning explaining compliance status and operative legal mechanics.",
  "confidenceScore": 0.95
}
"""

SYSTEM_BATCH_CLAUSE_PROMPT = """You are CaseCounsel, an expert Indian Legal Risk Compliance Engine.
Analyze the following batch of isolated contractual CLAUSES against their respective RETRIEVED STATUTORY CONTEXT under Indian Law.

STRICT GROUNDING & AUDIT CONSTRAINTS:
1. Base your findings ONLY on the provided clause text, RETRIEVED STATUTORY CONTEXT, and established Indian Law.
2. Allowed riskLevel values: "HIGH_RISK", "POTENTIALLY_UNENFORCEABLE", "REQUIRES_REVIEW", "ONE_SIDED", "NO_ISSUE_DETECTED".
3. FOR STANDARD / COMPLIANT CLAUSES ("NO_ISSUE_DETECTED"):
   - Set statutoryConflict to null.
   - "finding": ONE sentence that is UNIQUE to each clause: name its concrete subject (the specific party, amount, date, property, cheque, allegation or obligation it mentions). NEVER start with a stock phrase such as "No apparent statutory conflict identified" and NEVER reuse wording across clauses in this batch.
   - "reasoning": 2-4 sentences quoting or paraphrasing that clause's OWN facts and explaining why those specific facts raise no statutory problem. Cite an Act/Section ONLY if genuinely relevant to that clause's subject. Do NOT mention sale-deed items (TDS 194-IA, stamp duty, registration, RTGS) unless the clause itself deals with them. If the document is a legal notice/pleading, analyse each clause as a statement/averment/demand, not a contractual covenant.
   - Two clauses in the same batch must never receive near-identical finding or reasoning text. If clauses overlap in content, state precisely what differs (e.g. different allegation, amount, date).
   - If a clause is purely narrative with nothing assessable, say so plainly and use a lower confidenceScore rather than inventing legal analysis.
4. FOR FLAGGED CLAUSES ("HIGH_RISK", "POTENTIALLY_UNENFORCEABLE", "REQUIRES_REVIEW", "ONE_SIDED"):
   - "finding": Detail the exact legal conflict, restraint of trade/legal proceedings, or disproportionate liability.
   - "statutoryConflict": Cite the exact Act, Section, and authority level.
   - "reasoning": Explain the statutory basis of the violation and legal risk.

Respond with a pure JSON object containing a "results" array matching each clause by its clauseIndex:
{
  "results": [
    {
      "clauseIndex": 1,
      "riskLevel": "HIGH_RISK" | "POTENTIALLY_UNENFORCEABLE" | "REQUIRES_REVIEW" | "ONE_SIDED" | "NO_ISSUE_DETECTED",
      "finding": "Descriptive legal finding summarizing the clause and its compliance status.",
      "statutoryConflict": {
        "actName": "Name of Act",
        "section": "Section number or N/A",
        "ruleNumber": "Rule number or N/A",
        "precedentCitation": "Citation or N/A",
        "authorityLevel": "STATUTE" | "STATE_RULE" | "HIGH_COURT" | "SUPREME_COURT"
      } | null,
      "reasoning": "Thorough document-grounded legal reasoning explaining compliance status and operative legal mechanics.",
      "confidenceScore": 0.95
    }
  ]
}
"""

def build_batch_prompt(batch_items: List[Dict[str, Any]], domain: Optional[str] = None) -> str:
    """Constructs a composite prompt for multiple ambiguous clauses with document domain grounding."""
    prompt_parts = [
        f"DOCUMENT DOMAIN: {domain or 'Legal Agreement / Contract'}\n",
        "Analyze the following contractual clauses and return the compliance finding for each clauseIndex. Ground your legal finding and reasoning specifically in the exact facts, parties, and provisions of each clause:\n"
    ]
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
            "reasoning": "The clause consists of standard operational recitals establishing the contractual framework under Section 10 of the Indian Contract Act, 1872, with no adverse statutory liabilities.",
            "confidenceScore": 1.0
        }, clause_index, clause_type, domain=domain, clause_text=clause_text)

    # 1. ROUTE A: Deterministic Rule Engine
    deterministic_result = evaluate_deterministic_rules(clause_text, domain=domain, state=state, country=country)
    if deterministic_result:
        return audit_and_calibrate_finding(deterministic_result, clause_index, clause_type, domain=domain, clause_text=clause_text)

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

    # Authority Gate Check
    use_rule_packs_v2 = os.environ.get("RULE_PACKS_V2", "0") == "1"
    if use_rule_packs_v2:
        auth_eval = rag_store.validate_authority_strength(retrieved_contexts, clause_text, clause_type, domain)
        from rule_packs import one_sidedness_signals
        is_authoritative = auth_eval.get("is_authoritative", False)
        has_risk = auth_eval.get("has_conflict_risk", False)
        has_signals = False
        try:
            has_signals = one_sidedness_signals(clause_text)
        except Exception:
            pass

        if not is_authoritative and not has_risk and not has_signals:
            return audit_and_calibrate_finding({
                "riskLevel": "NO_ISSUE_DETECTED",
                "finding": auth_eval.get("reason", "No statutory conflict identified."),
                "statutoryConflict": None,
                "reasoning": "This clause does not engage any strong statutory provisions or one-sided risks.",
                "confidenceScore": 0.95
            }, clause_index, clause_type, domain=domain, clause_text=clause_text)

    auth_hash = hashlib.sha256(context_str.encode("utf-8")).hexdigest()[:16]

    # Context-Aware Cache Check
    cached_finding = clause_cache.get(clause_text, clause_type, domain, state, country, authority_hash=auth_hash)
    if cached_finding:
        return cached_finding

    prompt = f"DOCUMENT DOMAIN: {domain or 'Legal Document'}\nCLAUSE TYPE: {clause_type}\nCLAUSE TO ANALYZE:\n\"\"\"{clause_text}\"\"\"\n\nRETRIEVED STATUTORY CONTEXT:\n\"\"\"{context_str}\"\"\""
    llm_result = llm_gateway.generate_json(SYSTEM_CLAUSE_PROMPT, prompt)

    if llm_result:
        llm_result["deterministicRuleTriggered"] = False
        final_res = audit_and_calibrate_finding(llm_result, clause_index, clause_type, domain=domain, clause_text=clause_text)
        clause_cache.set(clause_text, final_res, clause_type, domain, state, country, authority_hash=auth_hash)
        return final_res

    finding_dict = heuristic_grounded_evaluation(clause_text, clause_type, retrieved_contexts, domain=domain)
    final_res = audit_and_calibrate_finding(finding_dict, clause_index, clause_type, domain=domain, clause_text=clause_text)
    clause_cache.set(clause_text, final_res, clause_type, domain, state, country, authority_hash=auth_hash)
    return final_res

def heuristic_grounded_evaluation(clause_text: str, clause_type: str, retrieved_contexts: list, domain: Optional[str] = None) -> Dict[str, Any]:
    """
    Deterministic/Heuristic fallback for Route B when external LLM is offline.
    Returns rich, substantive, document-grounded legal reasoning across all domains.
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
                "reasoning": "The clause designates valid domestic territorial jurisdiction under the Code of Civil Procedure and Section 28 of the Indian Contract Act, 1872, fully preserving the parties' right to legal recourse before competent civil courts.",
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
            "reasoning": "Under Section 124 of the Indian Contract Act, 1872, an indemnity is intended to cover losses caused by the conduct of the promisor. Unilateral uncapped indemnity terms expose the signing party to expansive commercial risk without standard mitigating caps or mutual fault exceptions.",
            "confidenceScore": 0.88,
            "humanReviewRequired": True
        }

    # Fallback: no boilerplate. The finding/reasoning are intentionally minimal so that
    # audit_and_calibrate_finding() regenerates them from this clause's own excerpt
    # (clause-specific text, lowered confidence) instead of a shared per-domain paragraph.
    return {
        "riskLevel": "NO_ISSUE_DETECTED",
        "finding": "",
        "statutoryConflict": None,
        "reasoning": "",
        "confidenceScore": 0.8
    }

_STOPWORDS = set("the a an of to and or in on for by with is are was be this that it as at from under any no not which such has have into its their his her shall may clause".split())

def _tokens(s: str) -> set:
    return {w for w in re.findall(r"[a-z0-9]+", (s or "").lower()) if w not in _STOPWORDS and len(w) > 2}

def _jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0

def _clause_excerpt(text: str, limit: int = 170) -> str:
    body = re.sub(r"^\s*(?:\d+|[IVXLCDM]+)[\.)]\s*", "", (text or "").strip())
    body = re.sub(r"\s+", " ", body)
    return body if len(body) <= limit else body[:limit].rsplit(" ", 1)[0] + "\u2026"

DUPLICATE_SIMILARITY_THRESHOLD = 0.55

def deduplicate_findings(clauses: List[Dict[str, Any]], findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Credibility guard. If a later compliant clause's finding+reasoning is a near-copy (Jaccard >= threshold)
    of an earlier one, the generic text is replaced by a rewrite anchored in that clause's own wording, and
    the event is recorded in `dedupeNote` (explainability) rather than silently altered.
    Flagged clauses (non NO_ISSUE_DETECTED) are never rewritten.
    """
    text_by_idx = {c.get("clauseIndex"): (c.get("rawText") or c.get("sanitizedText") or "") for c in clauses}
    seen: List[tuple] = []
    findings = [dict(f) for f in findings]
    for f in findings:
        sig = _tokens(f.get("finding", "") + " " + f.get("reasoning", ""))
        dup_of = next((idx for idx, prev in seen if _jaccard(sig, prev) >= DUPLICATE_SIMILARITY_THRESHOLD), None)
        if dup_of is not None and f.get("riskLevel") == "NO_ISSUE_DETECTED":
            excerpt = _clause_excerpt(text_by_idx.get(f.get("clauseIndex"), ""))
            if excerpt:
                f["finding"] = f"Reviewed on its own wording \u2014 \u201c{excerpt}\u201d \u2014 no statutory conflict is apparent in this specific statement."
                f["reasoning"] = (f"Classified as '{f['clauseType']}'. " if f.get("clauseType") else "") + (
                    f"The assessment rests only on what this clause itself states (quoted above); it overlaps in subject with Clause #{dup_of}, "
                    f"so the shared analysis is not repeated here. Nothing in this clause independently restrains legal proceedings, "
                    f"imposes a penalty, or conflicts with a statutory requirement.")
                f["confidenceScore"] = round(min(float(f.get("confidenceScore", 0.9)), 0.9), 2)
                f["dedupeNote"] = f"Near-duplicate of clause #{dup_of} detected (similarity >= {DUPLICATE_SIMILARITY_THRESHOLD}); text re-grounded in own clause wording."
                f["similarToClause"] = dup_of
            sig = _tokens(f["finding"] + " " + f["reasoning"])
        seen.append((f.get("clauseIndex"), sig))
    return findings

def analyze_all_clauses(clauses: List[Dict[str, Any]], domain: Optional[str] = None, state: Optional[str] = None, country: str = "India") -> List[Dict[str, Any]]:
    """
    Optimized Dual-Path Clause Analysis Engine with Batch Builder and Safe Context-Aware Cache.
    1. Pass 1: Resolves deterministic boundaries (0ms) & checks Context-Aware Cache.
    2. Pass 2: Batches remaining uncached clauses into composite LLM requests (up to 5 per batch).
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
                "reasoning": "The clause consists of standard operational recitals establishing the contractual framework under Section 10 of the Indian Contract Act, 1872, with no adverse statutory liabilities.",
                "confidenceScore": 1.0
            }, clause_index, clause_type, domain=domain, clause_text=clause_text)
            continue

        # Check Route A (Deterministic Rule Engine)
        det_result = evaluate_deterministic_rules(clause_text, domain=domain, state=state, country=country)
        if det_result:
            findings_map[clause_index] = audit_and_calibrate_finding(det_result, clause_index, clause_type, domain=domain, clause_text=clause_text)
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

        # Authority Gate Check
        use_rule_packs_v2 = os.environ.get("RULE_PACKS_V2", "0") == "1"
        if use_rule_packs_v2:
            auth_eval = rag_store.validate_authority_strength(retrieved_contexts, clause_text, clause_type, domain)
            from rule_packs import one_sidedness_signals
            is_authoritative = auth_eval.get("is_authoritative", False)
            has_risk = auth_eval.get("has_conflict_risk", False)
            has_signals = False
            try:
                has_signals = one_sidedness_signals(clause_text)
            except Exception:
                pass

            if not is_authoritative and not has_risk and not has_signals:
                findings_map[clause_index] = audit_and_calibrate_finding({
                    "riskLevel": "NO_ISSUE_DETECTED",
                    "finding": auth_eval.get("reason", "No statutory conflict identified."),
                    "statutoryConflict": None,
                    "reasoning": "This clause does not engage any strong statutory provisions or one-sided risks.",
                    "confidenceScore": 0.95
                }, clause_index, clause_type, domain=domain, clause_text=clause_text)
                continue

        auth_hash = hashlib.sha256(context_str.encode("utf-8")).hexdigest()[:16]

        # Context-Aware Cache Check
        cached = clause_cache.get(clause_text, clause_type, domain, state, country, authority_hash=auth_hash)
        if cached:
            cached_copy = dict(cached)
            cached_copy["clauseIndex"] = clause_index
            findings_map[clause_index] = cached_copy
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
            prompt = build_batch_prompt(chunk, domain=domain)
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
                    calibrated = audit_and_calibrate_finding(raw_finding, c_idx, c_type, domain=domain, clause_text=c_text)
                else:
                    # Fallback to heuristic grounded evaluation
                    fallback_finding = heuristic_grounded_evaluation(c_text, c_type, item["retrieved_contexts"], domain=domain)
                    calibrated = audit_and_calibrate_finding(fallback_finding, c_idx, c_type, domain=domain, clause_text=c_text)

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

    return deduplicate_findings(clauses, ordered_findings)
