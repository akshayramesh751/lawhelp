import os
import json
import re
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "server", ".env"))

from rag_service import rag_store
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

CHAT_SYSTEM_PROMPT = """You are CaseCounsel, an expert AI Legal Intelligence Assistant specializing in Contract Analysis and Indian Law.
You are helping the user understand their analyzed legal document.

STRICT 3-TIER EVIDENCE GATING DIRECTIVES:
1. MODE 1 — CONTRACT EVIDENCE:
   If the answer is explicitly stated in the document clauses, quote or reference the exact Clause number and state the contract term clearly.

2. MODE 2 — CONTRACT SILENCE (ABSENCE / NO_EVIDENCE_FOUND):
   If the document does NOT contain a clause covering the user's question (e.g., no non-compete clause, no late payment penalty clause, no termination procedure), you MUST state clearly:
   "The agreement does not contain any clause regarding [topic]. It is silent on this matter."
   NEVER pretend or infer that an absent clause exists in the agreement.

3. MODE 3 — EXTERNAL LEGAL GUIDANCE (DOMAIN-MATCHED ONLY):
   If relevant, explain what external Indian statutory law provides in the absence of a contract clause, but STRICTLY SEPARATE IT from the contract and ensure the statute matches the legal domain (e.g., Transfer of Property Act for leases, Industrial Disputes / Contract Act for employment).

PRESENTATION & FORMATTING GUIDELINES:
- Structure your response cleanly with markdown headings (###), bullet points, and **bold** highlights.
- Keep the tone professional, structured, and easy to read.
- Avoid messy repetitive divider characters like long rows of hashes or dashes.

Format your final response strictly as a JSON object adhering to this schema:
{
  "reply": "Clear, markdown-formatted plain English response adhering to the 3-tier evidence rules.",
  "relevantClauses": [1, 2],
  "citations": [
    {
      "actName": "Name of Act",
      "section": "Section number or N/A",
      "authorityLevel": "STATUTE" | "STATE_RULE" | "SUPREME_COURT"
    }
  ],
  "suggestedQuestions": ["Suggested follow-up question 1?", "Suggested follow-up question 2?"]
}
"""

def chat_with_groq(messages: List[Dict[str, str]], context_str: str, api_key: str) -> Optional[Dict[str, Any]]:
    if not HAS_GROQ or not api_key:
        return None
    models_to_try = ["openai/gpt-oss-120b", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"]
    client = Groq(api_key=api_key)
    formatted_messages = [
        {"role": "system", "content": f"{CHAT_SYSTEM_PROMPT}\n\n=== DOCUMENT & STATUTORY CONTEXT ===\n{context_str}"}
    ]
    for m in messages:
        formatted_messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})
        
    for model_name in models_to_try:
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=formatted_messages,
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            raw = completion.choices[0].message.content
            if raw and raw.strip().startswith("{"):
                return json.loads(raw)
        except Exception as e:
            print(f"[ChatService] Groq ({model_name}) error: {e}")
            continue
    return None

def chat_with_gemini(messages: List[Dict[str, str]], context_str: str, api_key: str) -> Optional[Dict[str, Any]]:
    if not HAS_GEMINI or not api_key:
        return None
    try:
        conversation_history = "\n".join([f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in messages])
        prompt = f"=== DOCUMENT & STATUTORY CONTEXT ===\n{context_str}\n\n=== CONVERSATION HISTORY ===\n{conversation_history}"

        if HAS_NEW_GENAI:
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-3.6-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=CHAT_SYSTEM_PROMPT,
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
                system_instruction=f"{CHAT_SYSTEM_PROMPT}\n\n=== DOCUMENT & STATUTORY CONTEXT ===\n{context_str}",
                generation_config={"response_mime_type": "application/json", "temperature": 0.0}
            )
            response = model.generate_content(conversation_history)
            if response.text and response.text.strip().startswith("{"):
                return json.loads(response.text)
    except Exception as e:
        print(f"[ChatService] Gemini execution error ({e}), handing over to Groq LPU...")
    return None

def heuristic_chat_fallback(query: str, doc_context: Dict[str, Any], retrieved_rag: List[Dict[str, Any]], domain: Optional[str] = None) -> Dict[str, Any]:
    """
    Evidence-Gated deterministic fallback for Q&A when external LLMs are unreachable.
    Strictly differentiates between Contract Evidence, Contract Silence, and External Law.
    """
    q_lower = query.lower()
    summary = doc_context.get("summaryOutput", {})
    risks = doc_context.get("riskAnalysis", [])
    clauses = doc_context.get("structure", {}).get("clauses", [])
    full_doc_text = " ".join([c.get("sanitizedText") or c.get("rawText", "") for c in clauses])

    matched_clauses = []
    matched_citations = []
    reply_lines = []

    # 1. Non-compete / competitor query
    if any(k in q_lower for k in ["compet", "non-compete", "work for", "join", "restraint", "post-employment"]):
        has_nc_in_doc = any(k in full_doc_text.lower() for k in ["non-compete", "compet", "restraint of trade", "competing business"])
        risk_nc = next((r for r in risks if "non-compete" in r.get("finding", "").lower() or "27" in str(r.get("statutoryConflict", {}).get("section", ""))), None)
        
        if has_nc_in_doc or (risk_nc and risk_nc.get("riskLevel") == "HIGH_RISK"):
            finding_text = risk_nc.get("finding", "Post-employment non-compete covenants are void ab initio under Indian law.") if risk_nc else "Restrictive covenants post-employment are unenforceable."
            clause_idx = risk_nc.get("clauseIndex", 1) if risk_nc else 1
            conflict_dict = risk_nc.get("statutoryConflict", {"actName": "Indian Contract Act, 1872", "section": "27", "authorityLevel": "STATUTE"}) if risk_nc else {"actName": "Indian Contract Act, 1872", "section": "27", "authorityLevel": "STATUTE"}
            
            matched_clauses.append(clause_idx)
            matched_citations.append(conflict_dict)
            reply_lines.append(f"**Post-Employment Non-Compete Assessment:** {finding_text}\n\n"
                               f"• **Contract Clause:** The agreement contains a restrictive covenant in Clause #{clause_idx}.\n"
                               f"• **Statutory Rule:** Under **Section 27 of the Indian Contract Act, 1872**, any agreement restraining an individual from exercising a lawful profession, trade, or business is void ab initio (*Percept D'Mark v. Zaheer Khan*).")
        else:
            # Explicit Absence Response
            reply_lines.append("**Non-Compete Assessment:** No non-compete clause or business restriction was found in this agreement.\n\nThe contract does not contain any covenant preventing you from working for competitors or engaging in lawful business activities.")

    # 2. Notice period / termination query
    elif any(k in q_lower for k in ["notice", "terminate", "termination", "dismiss", "fire", "resignation", "quit"]):
        has_notice_in_doc = any(k in full_doc_text.lower() for k in ["notice", "terminat", "dismiss", "resig"])
        risk_term = next((r for r in risks if "notice" in r.get("finding", "").lower() or "39" in str(r.get("statutoryConflict", {}).get("section", ""))), None)
        term_terms = summary.get("terminationConditions", [])
        
        is_rental = domain and any(k in domain.lower() for k in ["rent", "lease", "tenan", "property"])
        
        if term_terms and len(term_terms) > 0 and term_terms[0] != "Standard statutory notice":
            term_str = "; ".join(term_terms)
            clause_idx = risk_term.get("clauseIndex", 1) if risk_term else 1
            matched_clauses.append(clause_idx)
            
            if is_rental:
                reply_lines.append(f"**Termination & Notice Terms:**\n\n• **Contract Clause:** {term_str}\n• **Statutory Framework:** Governed by Section 106 of the Transfer of Property Act, 1882 and Karnataka Rent Control laws.")
                matched_citations.append({"actName": "Transfer of Property Act, 1882", "section": "106", "authorityLevel": "STATUTE"})
            else:
                reply_lines.append(f"**Termination & Notice Terms:**\n\n• **Contract Clause:** {term_str}\n• **Statutory Requirement:** Under Section 39 of the Karnataka Shops and Commercial Establishments Act, 1961, employer dismissals require at least 30 days written notice or wages in lieu.")
                matched_citations.append({"actName": "Karnataka Shops and Commercial Establishments Act, 1961", "section": "39", "authorityLevel": "STATE_RULE"})
        elif has_notice_in_doc and risk_term:
            clause_idx = risk_term.get("clauseIndex", 1)
            matched_clauses.append(clause_idx)
            conflict_dict = risk_term.get("statutoryConflict", {})
            if conflict_dict:
                matched_citations.append(conflict_dict)
            reply_lines.append(f"**Termination Assessment:** {risk_term.get('finding')}\n\n{risk_term.get('reasoning')}")
        else:
            # Absence
            if is_rental:
                reply_lines.append("**Termination Notice:** The agreement does not specify an explicit termination notice period.\n\n• **Applicable Law:** Under Section 106 of the Transfer of Property Act, 1882, in the absence of a contract clause, a monthly residential lease is terminable by 15 days notice expiring with the end of a month of the tenancy.")
                matched_citations.append({"actName": "Transfer of Property Act, 1882", "section": "106", "authorityLevel": "STATUTE"})
            else:
                reply_lines.append("**Termination Notice:** The agreement does not specify an explicit termination notice period. It contains no explicit clause regarding termination procedures or notice duration.")

    # 3. Default / Missed Rent / Late payment consequences query
    elif any(k in q_lower for k in ["miss", "unpaid", "late", "default", "delay", "penalty", "fail to pay", "evict"]):
        has_default_clause = any(k in full_doc_text.lower() for k in ["late fee", "interest on overdue", "default in payment", "eviction", "penalty for delay"])
        financials = summary.get("financialTerms", [])
        fin_summary = "; ".join([f"{f.get('description', 'Fee')}: {f.get('amount', 'N/A')}" for f in financials]) if financials else "Stipulated payments"
        
        if has_default_clause:
            reply_lines.append(f"**Default & Overdue Consequences:** The agreement contains explicit terms governing payment defaults:\n\n{full_doc_text[:300]}")
        else:
            reply_lines.append(f"**Payment Obligations & Default Consequences:**\n\n"
                               f"• **Contractual Payment Terms:** The agreement specifies regular consideration ({fin_summary}), but contains **no explicit clause specifying late fees, interest, or eviction procedures** for missed payments.\n"
                               f"• **Statutory Framework:** In the absence of an explicit contract term, remedies for non-payment are governed by the Transfer of Property Act, 1882 and applicable State Rent Control legislation.")
            if domain and any(k in domain.lower() for k in ["rent", "lease", "property"]):
                matched_citations.append({"actName": "Transfer of Property Act, 1882", "section": "108", "authorityLevel": "STATUTE"})

    # 4. Financial / salary / rent / deposit query
    elif any(k in q_lower for k in ["salary", "compensation", "pay", "rent", "deposit", "money", "financial", "bonus", "fee", "maintenance"]):
        financials = summary.get("financialTerms", [])
        if financials:
            fin_lines = [f"• **{f.get('description', 'Item')}:** {f.get('amount', 'N/A')} (Due: {f.get('deadline', 'As stipulated')})" for f in financials]
            reply_lines.append("**Contractual Financial Schedules:**\n" + "\n".join(fin_lines))
        else:
            reply_lines.append("No specific quantitative financial amounts were extracted from this document.")

    # 5. Governing law / Jurisdiction query
    elif any(k in q_lower for k in ["jurisdiction", "court", "law", "governing", "dispute"]):
        gov = summary.get("governingLaw", "Not specified in the document")
        if gov and gov != "Not specified in the document":
            reply_lines.append(f"**Governing Law & Jurisdiction:** {gov}.\nDisputes under this agreement are subject to the designated territorial courts.")
        else:
            reply_lines.append("**Governing Law & Jurisdiction:** The agreement does not contain an explicit governing law or court jurisdiction clause. By default, disputes are subject to the competent territorial courts where the contract was executed or premises/employment is located under the Code of Civil Procedure, 1908.")

    # 6. General fallback
    else:
        exec_summary = summary.get("executiveSummary", "This is an analyzed legal agreement.")
        reply_lines.append(f"**Document Overview:** {exec_summary}\n\nYou can ask about specific clauses, payment schedules, notice periods, or identified legal risks.")

    if not matched_citations and retrieved_rag:
        top_rag = retrieved_rag[0].get("metadata", {})
        matched_citations.append({
            "actName": top_rag.get("act", "Applicable Statute"),
            "section": top_rag.get("section_number", "N/A"),
            "authorityLevel": "STATUTE"
        })

    return {
        "reply": "\n\n".join(reply_lines),
        "relevantClauses": list(set(matched_clauses)) or [1],
        "citations": matched_citations,
        "suggestedQuestions": [
            "What are the key financial terms?",
            "Are there any restrictive clauses?",
            "What is the required notice period for termination?"
        ]
    }

def answer_document_query(query: str, doc_context: Dict[str, Any], messages: Optional[List[Dict[str, str]]] = None, domain: Optional[str] = None, state: Optional[str] = None, country: str = "India") -> Dict[str, Any]:
    """
    Main entry point for Phase 7 Interactive Document Q&A.
    """
    messages = messages or [{"role": "user", "content": query}]
    provider = os.environ.get("LLM_PROVIDER", "groq").lower().strip()
    groq_key = os.environ.get("GROQ_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")

    if groq_key and ("your_groq" in groq_key or "placeholder" in groq_key):
        groq_key = None
    if gemini_key and ("your_gemini" in gemini_key or "placeholder" in gemini_key):
        gemini_key = None

    # Retrieve relevant legal statutory context strictly via Hybrid RAG with domain mapping
    retrieved_rag = rag_store.retrieve(
        query=query,
        state=state,
        country=country,
        domain=domain,
        limit=3
    )

    rag_text = "\n\n".join([
        f"--- {c.get('metadata', {}).get('act', 'Act')} (§ {c.get('metadata', {}).get('section_number', '')}) ---\n{c.get('content', '')}"
        for c in retrieved_rag
    ]) if retrieved_rag else "No external statutes retrieved."

    summary = doc_context.get("summaryOutput", {})
    risks = doc_context.get("riskAnalysis", [])
    clauses = doc_context.get("structure", {}).get("clauses", [])

    context_str = f"""
DOCUMENT DOMAIN: {domain or 'Legal Document'}
JURISDICTION: {state or 'National'}, {country}

EXPLICIT DOCUMENT CLAUSES (GROUND TRUTH):
{json.dumps([{'clauseIndex': c.get('clauseIndex'), 'header': c.get('clauseHeader'), 'text': c.get('sanitizedText') or c.get('rawText')} for c in clauses], indent=2)}

EXTRACTED FINANCIAL TERMS:
{json.dumps(summary.get('financialTerms', []), indent=2)}

IDENTIFIED LEGAL RISKS & VIOLATIONS:
{json.dumps(risks, indent=2)}

STATUTORY RETRIEVAL KNOWLEDGE:
{rag_text}
"""

    conversation_history = "\n".join([f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in messages])
    user_prompt = f"=== DOCUMENT & STATUTORY CONTEXT ===\n{context_str}\n\n=== CONVERSATION HISTORY ===\n{conversation_history}"

    chat_result = llm_gateway.generate_json(CHAT_SYSTEM_PROMPT, user_prompt)

    if not chat_result:
        chat_result = heuristic_chat_fallback(query, doc_context, retrieved_rag, domain=domain)

    return {
        "reply": str(chat_result.get("reply", "No specific conclusion reached.")),
        "relevantClauses": chat_result.get("relevantClauses", [1]),
        "citations": chat_result.get("citations", []),
        "suggestedQuestions": chat_result.get("suggestedQuestions", [
            "What are the key financial terms?",
            "What is my required notice period for termination?"
        ])
    }
