from typing import Dict, Any, Optional

# Verified legal knowledge base act references
KNOWN_STATUTES = {
    "indian contract act 1872": {"authorityLevel": "STATUTE", "standardName": "Indian Contract Act, 1872"},
    "karnataka shops and commercial establishments act 1961": {"authorityLevel": "STATE_RULE", "standardName": "Karnataka Shops and Commercial Establishments Act, 1961"},
    "payment of gratuity act 1972": {"authorityLevel": "STATUTE", "standardName": "Payment of Gratuity Act, 1972"},
    "transfer of property act 1882": {"authorityLevel": "STATUTE", "standardName": "Transfer of Property Act, 1882"},
    "karnataka rent control act 2001": {"authorityLevel": "STATE_RULE", "standardName": "Karnataka Rent Control Act, 2001"},
    "specific relief act 1963": {"authorityLevel": "STATUTE", "standardName": "Specific Relief Act, 1963"},
    "sale of goods act 1930": {"authorityLevel": "STATUTE", "standardName": "Sale of Goods Act, 1930"},
    "code on wages 2019": {"authorityLevel": "STATUTE", "standardName": "Code on Wages, 2019"},
    "employees provident funds act 1952": {"authorityLevel": "STATUTE", "standardName": "Employees Provident Funds and Miscellaneous Provisions Act, 1952"},
    "employees state insurance act 1948": {"authorityLevel": "STATUTE", "standardName": "Employees' State Insurance Act, 1948"}
}

ALLOWED_RISK_LEVELS = {
    "HIGH_RISK", "POTENTIALLY_UNENFORCEABLE", "REQUIRES_REVIEW", "ONE_SIDED", "NO_ISSUE_DETECTED"
}

def audit_and_calibrate_finding(finding_dict: Dict[str, Any], clause_index: int, clause_type: str) -> Dict[str, Any]:
    """
    Step 5.3: Citation Audit & Severity Calibration
    Audits citations against the known statute registry, calibrates risk severity,
    and returns a clean, schema-compliant riskAnalysis item.
    """
    risk_level = finding_dict.get("riskLevel", "NO_ISSUE_DETECTED")
    if risk_level not in ALLOWED_RISK_LEVELS:
        risk_level = "REQUIRES_REVIEW"
        
    statutory_conflict = finding_dict.get("statutoryConflict") or {}
    act_name = statutory_conflict.get("actName", "")
    section = statutory_conflict.get("section", "N/A")
    rule_num = statutory_conflict.get("ruleNumber", "N/A")
    precedent = statutory_conflict.get("precedentCitation", "N/A")
    authority_level = statutory_conflict.get("authorityLevel", "STATUTE")
    
    # If no issue detected, clean out statutory conflict fields so harmless clauses are not stamped with fake statutes
    if risk_level == "NO_ISSUE_DETECTED":
        act_name = "N/A"
        section = "N/A"
        rule_num = "N/A"
        precedent = "N/A"
        authority_level = "N/A"
    else:
        # Audit act against known statutes for actual risk findings
        matched_statute = None
        act_lower = act_name.lower().strip()
        for known_key, meta in KNOWN_STATUTES.items():
            if known_key in act_lower or act_lower in known_key:
                matched_statute = meta
                break
                
        if matched_statute:
            authority_level = matched_statute["authorityLevel"]
            act_name = matched_statute["standardName"]
        elif precedent and precedent != "N/A" and ("v." in precedent or "vs." in precedent or "SCC" in precedent or "SCR" in precedent):
            authority_level = "SUPREME_COURT"
        else:
            if risk_level in ["HIGH_RISK", "POTENTIALLY_UNENFORCEABLE"] and not matched_statute:
                # If no verified statute matched for a high-risk claim, flag for human verification
                finding_dict["humanReviewRequired"] = True
                finding_dict["confidenceScore"] = min(finding_dict.get("confidenceScore", 0.7), 0.75)
            
    # Human review calibration
    confidence = float(finding_dict.get("confidenceScore", 1.0))
    human_review = finding_dict.get("humanReviewRequired", False)
    if risk_level in ["POTENTIALLY_UNENFORCEABLE", "REQUIRES_REVIEW"] or confidence < 0.85:
        human_review = True

    return {
        "clauseIndex": clause_index,
        "clauseType": clause_type or "General Clause",
        "riskLevel": risk_level,
        "finding": finding_dict.get("finding", "Standard clause without apparent statutory conflicts."),
        "statutoryConflict": {
            "actName": act_name or "N/A",
            "section": str(section),
            "ruleNumber": str(rule_num),
            "precedentCitation": str(precedent),
            "authorityLevel": authority_level
        },
        "deterministicRuleTriggered": bool(finding_dict.get("deterministicRuleTriggered", False)),
        "reasoning": finding_dict.get("reasoning", "The clause is consistent with standard legal practice."),
        "confidenceScore": round(confidence, 2),
        "humanReviewRequired": bool(human_review)
    }
