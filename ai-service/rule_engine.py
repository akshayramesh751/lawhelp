import re
from typing import Optional, Dict, Any

def evaluate_deterministic_rules(clause_text: str, domain: Optional[str] = None, state: Optional[str] = None, country: str = "India") -> Optional[Dict[str, Any]]:
    """
    Route A: Deterministic Rule Engine
    Evaluates quantitative and explicit statutory boundaries using direct programmatic assertions.
    Returns a structured finding dictionary if a deterministic rule is triggered, or None if it should route to Route B.
    """
    text_lower = clause_text.lower()
    is_rental = bool(domain and any(k in domain.lower() for k in ["rent", "lease", "tenan", "property"]))
    
    # -------------------------------------------------------------
    # Rule 1: Post-Employment Non-Compete / Restraint of Trade
    # Governed by: Section 27, Indian Contract Act, 1872
    # -------------------------------------------------------------
    non_compete_keywords = ["non-compete", "non compete", "not engage in any competing", "shall not work for any competitor", 
                            "restraint of trade", "competing business", "competing entity", "shall not engage in similar business"]
    post_term_keywords = ["after termination", "post termination", "post-employment", "following termination", 
                          "after resignation", "after leaving", "for a period of", "months following", "years following", "subsequent to departure"]
    
    has_non_compete = any(k in text_lower for k in non_compete_keywords)
    has_post_term = any(k in text_lower for k in post_term_keywords) or bool(re.search(r'\b\d+\s*(?:months?|years?)\s*(?:after|following|post)', text_lower))
    
    if has_non_compete and (has_post_term or "compete" in text_lower):
        return {
            "deterministicRuleTriggered": True,
            "riskLevel": "HIGH_RISK",
            "finding": "Post-employment non-compete covenants are void ab initio under Indian law.",
            "statutoryConflict": {
                "actName": "Indian Contract Act 1872",
                "section": "27",
                "ruleNumber": "N/A",
                "precedentCitation": "Percept D'Mark (India) Pvt. Ltd. v. Zaheer Khan (2006) 4 SCC 227",
                "authorityLevel": "STATUTE"
            },
            "statutoryCitation": "Section 27, Indian Contract Act, 1872",
            "reasoning": "Section 27 of the Indian Contract Act, 1872 renders any agreement that restrains anyone from exercising a lawful profession, trade, or business void. The Supreme Court has repeatedly held that negative covenants extending beyond the term of employment are unenforceable.",
            "confidenceScore": 1.0,
            "humanReviewRequired": False
        }

    # -------------------------------------------------------------
    # Rule 2: Absolute Bar on Legal Proceedings / Truncated Limitation
    # Governed by: Section 28, Indian Contract Act, 1872
    # -------------------------------------------------------------
    legal_bar_patterns = [
        r'(?:shall not|neither party shall|no party shall|parties agree that neither).{0,40}?(?:have the right to )?approach (?:any )?court',
        r'barred from (?:initiating|taking) (?:any )?legal (?:action|proceedings)',
        r'waives? all rights to (?:seek )?legal remedies',
        r'no right to approach (?:any )?(?:court|tribunal)',
        r'restrain(?:ed|s)? absolutely from enforcing (?:his|her|its|their)? rights'
    ]
    if any(re.search(p, text_lower) for p in legal_bar_patterns):
        return {
            "deterministicRuleTriggered": True,
            "riskLevel": "HIGH_RISK",
            "finding": "Clause absolutely restricting access to judicial remedies or legal tribunals is void.",
            "statutoryConflict": {
                "actName": "Indian Contract Act 1872",
                "section": "28",
                "ruleNumber": "N/A",
                "precedentCitation": "N/A",
                "authorityLevel": "STATUTE"
            },
            "statutoryCitation": "Section 28, Indian Contract Act, 1872",
            "reasoning": "Section 28 of the Indian Contract Act, 1872 explicitly provides that every agreement by which any party is restricted absolutely from enforcing their rights under or in respect of any contract by ordinary legal proceedings in tribunals is void to that extent.",
            "confidenceScore": 1.0,
            "humanReviewRequired": False
        }

    # -------------------------------------------------------------
    # Rule 3: Statutory Gratuity Waiver or Denial
    # Governed by: Section 4, Payment of Gratuity Act, 1972
    # -------------------------------------------------------------
    if "gratuity" in text_lower and any(w in text_lower for w in ["waive", "waives", "not entitled to gratuity", "forfeit gratuity", "no gratuity shall be payable"]):
        return {
            "deterministicRuleTriggered": True,
            "riskLevel": "HIGH_RISK",
            "finding": "Attempted contractual waiver or forfeiture of statutory gratuity is illegal.",
            "statutoryConflict": {
                "actName": "Payment of Gratuity Act 1972",
                "section": "4",
                "ruleNumber": "N/A",
                "precedentCitation": "N/A",
                "authorityLevel": "STATUTE"
            },
            "statutoryCitation": "Section 4, Payment of Gratuity Act, 1972",
            "reasoning": "Under Section 4 of the Payment of Gratuity Act, 1972, gratuity is a statutory entitlement upon continuous service of not less than five years. It cannot be contracted out or arbitrarily forfeited except under narrow statutory grounds (e.g. violent misconduct causing riotous damage).",
            "confidenceScore": 1.0,
            "humanReviewRequired": False
        }

    # -------------------------------------------------------------
    # Rule 4: Notice Period Statutory Deficit or Severe Asymmetry
    # Governed by: Section 39, Karnataka Shops & Commercial Establishments Act 1961 (Employment)
    #              Section 106, Transfer of Property Act 1882 (Leases)
    # -------------------------------------------------------------
    if "notice" in text_lower and ("terminat" in text_lower or "dismiss" in text_lower or "resig" in text_lower or "vacat" in text_lower):
        # 4A. Rental Asymmetry Check
        landlord_immediate = bool(re.search(r'(?:landlord|lessor).{0,50}?(?:may|can).{0,50}?terminat\w*.{0,50}?(?:immediately|without notice|with \d+ days?)', text_lower)) or ("landlord may terminate immediately" in text_lower)
        tenant_long = bool(re.search(r'(?:tenant|lessee).{0,50}?(?:shall|must|is required to).{0,50}?(?:give|provide).{0,30}?(?:60|90|120|\d{2,3})\s*days?', text_lower)) or ("tenant must provide 90 days" in text_lower or "tenant shall give 90 days" in text_lower)
        if (landlord_immediate and tenant_long) or ("landlord may terminate immediately" in text_lower and "90 days" in text_lower):
            return {
                "deterministicRuleTriggered": True,
                "riskLevel": "ONE_SIDED",
                "finding": "Asymmetric termination notice heavily favors the landlord over the tenant.",
                "statutoryConflict": {
                    "actName": "Transfer of Property Act 1882",
                    "section": "106",
                    "ruleNumber": "N/A",
                    "precedentCitation": "N/A",
                    "authorityLevel": "STATUTE"
                },
                "statutoryCitation": "Section 106, Transfer of Property Act, 1882",
                "reasoning": "Section 106 of the Transfer of Property Act, 1882 establishes balanced periodic termination principles. Binding the tenant to an onerous notice period (e.g. 90 days) while reserving immediate termination for the landlord creates an unconscionable contractual asymmetry.",
                "confidenceScore": 0.95,
                "humanReviewRequired": False
            }

        # 4B. Employment Asymmetry Check
        employer_immediate = bool(re.search(r'(?:employer|company).{0,50}?(?:may|can).{0,50}?terminat\w*.{0,50}?(?:immediately|without notice|with \d+ days?)', text_lower)) or ("employer may terminate" in text_lower and "without notice" in text_lower)
        employee_long = bool(re.search(r'(?:employee|worker).{0,50}?(?:shall|must|is required to).{0,50}?(?:give|provide).{0,30}?(?:60|90|120|\d{2,3})\s*days?', text_lower)) or ("employee must give 90 days" in text_lower or "employee must provide 90 days" in text_lower)
        
        if (employer_immediate and employee_long) or ("employer may terminate this contract with immediate effect without notice" in text_lower and "90 days" in text_lower):
            return {
                "deterministicRuleTriggered": True,
                "riskLevel": "ONE_SIDED",
                "finding": "Asymmetric termination notice heavily favors the employer over the employee.",
                "statutoryConflict": {
                    "actName": "Karnataka Shops and Commercial Establishments Act 1961",
                    "section": "39",
                    "ruleNumber": "N/A",
                    "precedentCitation": "N/A",
                    "authorityLevel": "STATE_RULE"
                },
                "statutoryCitation": "Section 39, Karnataka Shops and Commercial Establishments Act, 1961",
                "reasoning": "Section 39 mandates minimum one month (30 days) written notice or wages in lieu for termination of employees with continuous service exceeding 6 months. A contract permitting immediate employer termination while binding the employee to 90 days creates an aggressive, one-sided burden.",
                "confidenceScore": 0.95,
                "humanReviewRequired": False
            }

        # Sub-statutory notice check
        short_notice_match = re.search(r'(?:employer|company) (?:may|can).{0,40}?terminat\w*.{0,40}?(?:with|giving)\s*(\d+)\s*days?', text_lower)
        if short_notice_match:
            days = int(short_notice_match.group(1))
            if days < 30 and ("misconduct" not in text_lower):
                return {
                    "deterministicRuleTriggered": True,
                    "riskLevel": "HIGH_RISK",
                    "finding": f"Contractual employer notice period of {days} days is below the statutory 30-day minimum.",
                    "statutoryConflict": {
                        "actName": "Karnataka Shops and Commercial Establishments Act 1961",
                        "section": "39",
                        "ruleNumber": "N/A",
                        "precedentCitation": "N/A",
                        "authorityLevel": "STATE_RULE"
                    },
                    "statutoryCitation": "Section 39, Karnataka Shops and Commercial Establishments Act, 1961",
                    "reasoning": "Section 39 of the Karnataka Shops and Commercial Establishments Act, 1961 mandates that no employer shall remove or dismiss an employee in continuous service for >= 6 months without at least one month (30 days) prior written notice or wages in lieu.",
                    "confidenceScore": 0.95,
                    "humanReviewRequired": False
                }

    # -------------------------------------------------------------
    # Rule 5: Unreasonable Penalties / Liquidated Damages
    # Governed by: Section 74, Indian Contract Act, 1872
    # -------------------------------------------------------------
    if ("liquidated damage" in text_lower or "penalty" in text_lower or "forfeit" in text_lower) and any(w in text_lower for w in ["entire deposit", "all unpaid wages", "disproportionate", "unreasonable"]):
        return {
            "deterministicRuleTriggered": True,
            "riskLevel": "POTENTIALLY_UNENFORCEABLE",
            "finding": "Disproportionate liquidated damages or automatic total forfeiture clauses are subject to judicial moderation.",
            "statutoryConflict": {
                "actName": "Indian Contract Act 1872",
                "section": "74",
                "ruleNumber": "N/A",
                "precedentCitation": "Fateh Chand v. Balkishan Dass (1964) 1 SCR 515",
                "authorityLevel": "STATUTE"
            },
            "statutoryCitation": "Section 74, Indian Contract Act, 1872",
            "reasoning": "Under Section 74 of the Indian Contract Act, stipulated liquidated damages operate as an upper ceiling. Courts will not enforce penalty clauses in terrorem and will only award reasonable compensation for actual proven damage.",
            "confidenceScore": 0.90,
            "humanReviewRequired": True
        }

    # -------------------------------------------------------------
    # Rule 6: Benign Operational & Administrative Clearance (0ms Route A Pre-filter)
    # -------------------------------------------------------------
    contact_keywords = ["emergency contact", "contact details", "official notice", "email address", "phone number", "designated email"]
    if any(k in text_lower for k in contact_keywords) and len(text_lower) < 250:
        return {
            "deterministicRuleTriggered": True,
            "riskLevel": "NO_ISSUE_DETECTED",
            "finding": "No apparent statutory conflict identified from the text reviewed.",
            "statutoryConflict": None,
            "statutoryCitation": "N/A",
            "reasoning": "Standard administrative and contact notice clause with zero legal liability or statutory conflict.",
            "confidenceScore": 1.0,
            "humanReviewRequired": False
        }

    witness_keywords = ["witness whereof", "signed and delivered", "in witness", "attestation", "signed by the parties", "witness 1", "witness 2"]
    if any(k in text_lower for k in witness_keywords) and len(text_lower) < 300:
        return {
            "deterministicRuleTriggered": True,
            "riskLevel": "NO_ISSUE_DETECTED",
            "finding": "No apparent statutory conflict identified from the text reviewed.",
            "statutoryConflict": None,
            "statutoryCitation": "N/A",
            "reasoning": "Standard contract attestation, signature, and execution block.",
            "confidenceScore": 1.0,
            "humanReviewRequired": False
        }

    # -------------------------------------------------------------
    # Rule 7: Standard Domestic Governing Law & Court Jurisdiction
    # -------------------------------------------------------------
    if ("governing law" in text_lower or "jurisdiction" in text_lower) and ("courts at" in text_lower or "courts of" in text_lower or "laws of india" in text_lower):
        if any(city in text_lower for city in ["bengaluru", "bangalore", "karnataka", "mumbai", "delhi", "chennai", "hyderabad", "india"]):
            return {
                "deterministicRuleTriggered": True,
                "riskLevel": "NO_ISSUE_DETECTED",
                "finding": "Standard governing law and domestic court jurisdiction clause.",
                "statutoryConflict": {
                    "actName": "Indian Contract Act 1872",
                    "section": "28",
                    "ruleNumber": "N/A",
                    "precedentCitation": "N/A",
                    "authorityLevel": "STATUTE"
                },
                "statutoryCitation": "Section 28, Indian Contract Act, 1872",
                "reasoning": "Designation of valid domestic territorial jurisdiction within India is fully enforceable under the Code of Civil Procedure, 1908 and Section 28 of the Indian Contract Act, 1872.",
                "confidenceScore": 0.98,
                "humanReviewRequired": False
            }

    # No deterministic rule triggered; route to Route B
    return None
