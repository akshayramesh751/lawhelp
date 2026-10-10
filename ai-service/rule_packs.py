import re

# Data-driven generic rules
# Each rule is a dict: id, domains (list of strings or "ALL"), patterns (list of regexes), riskLevel, finding, statute, reasoning, confidence
RULE_PACKS = [
    # RENTAL
    {
        "id": "RNT_ENTRY_NO_NOTICE",
        "domains": ["Rental / Lease Agreement"],
        "patterns": [r"(?i)\b(enter|inspect|visit)\b[^\.]*\b(at any time|without notice|sole discretion)\b"],
        "riskLevel": "ONE_SIDED",
        "finding": "Landlord can enter premises without prior notice.",
        "statute": "Karnataka Rent Control Act, 2001",
        "reasoning": "Statutory frameworks generally require reasonable notice before landlord entry to protect tenant privacy and quiet enjoyment.",
        "confidence": 0.8
    },
    {
        "id": "RNT_FORFEIT_DEPOSIT",
        "domains": ["Rental / Lease Agreement"],
        "patterns": [r"(?i)\b(forfeit|forfeited)\b[^\.]*\b(entire deposit|security deposit|advance)\b"],
        "riskLevel": "HIGH_RISK",
        "finding": "Clause allows blanket forfeiture of the entire security deposit.",
        "statute": "Transfer of Property Act, 1882",
        "reasoning": "Blanket forfeiture without accounting for actual damages may be considered a penalty rather than reasonable liquidated damages.",
        "confidence": 0.85
    },
    {
        "id": "RNT_UNILATERAL_ESCALATION",
        "domains": ["Rental / Lease Agreement"],
        "patterns": [r"(?i)\b(increase|escalate|hike)[^\.]*\brent\b[^\.]*\b(sole discretion|any time|without notice)\b"],
        "riskLevel": "ONE_SIDED",
        "finding": "Landlord can unilaterally increase rent.",
        "statute": "N/A",
        "reasoning": "Rent escalation should be mutually agreed upon or pre-defined.",
        "confidence": 0.8
    },
    {
        "id": "RNT_HEAVY_LOCK_IN",
        "domains": ["Rental / Lease Agreement"],
        "patterns": [r"(?i)\b(lock-in|lock in)\b[^\.]*\b(liable to pay|balance term|entire remaining term)\b"],
        "riskLevel": "HIGH_RISK",
        "finding": "Tenant is liable for rent for the entire remaining term if vacating during lock-in.",
        "statute": "Indian Contract Act, 1872",
        "reasoning": "Courts generally only allow landlords to recover actual damages during a lock-in breach, not the entire balance.",
        "confidence": 0.75
    },
    {
        "id": "RNT_SELF_HELP_EVICTION",
        "domains": ["Rental / Lease Agreement"],
        "patterns": [r"(?i)\b(evict|remove|take possession|disconnect)\b[^\.]*\b(without recourse to law|without notice|sole discretion|electricity|water)\b"],
        "riskLevel": "HIGH_RISK",
        "finding": "Allows landlord to use self-help eviction or disconnect essential services.",
        "statute": "Specific Relief Act, 1963",
        "reasoning": "Self-help eviction without due process of law is illegal.",
        "confidence": 0.9
    },
    {
        "id": "RNT_STRUCTURAL_REPAIR",
        "domains": ["Rental / Lease Agreement"],
        "patterns": [r"(?i)\b(tenant|lessee)\b[^\.]*\b(structural repairs|major repairs)\b"],
        "riskLevel": "ONE_SIDED",
        "finding": "Tenant is made liable for structural repairs.",
        "statute": "Transfer of Property Act, 1882",
        "reasoning": "Structural repairs are typically the landlord's responsibility unless explicitly contracted otherwise.",
        "confidence": 0.85
    },
    {
        "id": "RNT_WAIVER_PROTECTIONS",
        "domains": ["Rental / Lease Agreement"],
        "patterns": [r"(?i)\b(waive|waiver)\b[^\.]*\b(rights|protections)\b[^\.]*\b(rent control|law)\b"],
        "riskLevel": "POTENTIALLY_UNENFORCEABLE",
        "finding": "Attempts to waive statutory tenant protections.",
        "statute": "Karnataka Rent Control Act, 2001",
        "reasoning": "Statutory rights under rent control laws generally cannot be contracted out of.",
        "confidence": 0.9
    },
    
    # EMPLOYMENT
    {
        "id": "EMP_BOND_RECOVERY",
        "domains": ["Employment Agreement"],
        "patterns": [r"(?i)\b(training cost|bond)\b[^\.]*\b(liable to pay|recover|liquidated damages)\b[^\.]*\b(rupees|rs)\b"],
        "riskLevel": "ONE_SIDED",
        "finding": "Imposes excessive training bond recovery.",
        "statute": "Indian Contract Act, 1872",
        "reasoning": "Bond recoveries must reflect actual training costs incurred and cannot be arbitrary penalties.",
        "confidence": 0.85
    },
    {
        "id": "EMP_WITHHOLD_DOCS",
        "domains": ["Employment Agreement"],
        "patterns": [r"(?i)\b(withhold|retain)\b[^\.]*\b(salary|original certificates|documents)\b"],
        "riskLevel": "HIGH_RISK",
        "finding": "Employer reserves right to withhold salary or original certificates.",
        "statute": "Code on Wages, 2019",
        "reasoning": "Withholding earned wages or original educational certificates is legally prohibited.",
        "confidence": 0.95
    },
    {
        "id": "EMP_UNILATERAL_TRANSFER",
        "domains": ["Employment Agreement"],
        "patterns": [r"(?i)\b(transfer|relocate|modify terms)\b[^\.]*\b(sole discretion|any time|without notice)\b"],
        "riskLevel": "ONE_SIDED",
        "finding": "Employer can unilaterally change terms or transfer the employee anywhere.",
        "statute": "N/A",
        "reasoning": "While transfers are management prerogative, doing so without notice or consent can be deemed unreasonable.",
        "confidence": 0.75
    },
    {
        "id": "EMP_WAIVER_BENEFITS",
        "domains": ["Employment Agreement"],
        "patterns": [r"(?i)\b(waive|not applicable)\b[^\.]*\b(overtime|gratuity|provident fund)\b"],
        "riskLevel": "POTENTIALLY_UNENFORCEABLE",
        "finding": "Attempts to waive statutory employment benefits.",
        "statute": "Payment of Gratuity Act, 1972",
        "reasoning": "Statutory benefits like gratuity and PF cannot be waived by mutual consent.",
        "confidence": 0.95
    },
    {
        "id": "EMP_INDEFINITE_PROBATION",
        "domains": ["Employment Agreement"],
        "patterns": [r"(?i)\bprobation\b[^\.]*\b(extended indefinitely|sole discretion without limit)\b"],
        "riskLevel": "REQUIRES_REVIEW",
        "finding": "Allows indefinite extension of probation.",
        "statute": "Karnataka Shops and Commercial Establishments Act, 1961",
        "reasoning": "Probation periods should have defined maximum durations.",
        "confidence": 0.8
    },
    {
        "id": "EMP_OVERBROAD_IP",
        "domains": ["Employment Agreement"],
        "patterns": [r"(?i)\b(intellectual property|inventions|creations)\b[^\.]*\b(prior to employment|outside working hours|not related to)\b"],
        "riskLevel": "ONE_SIDED",
        "finding": "IP assignment is over-broad, covering inventions unrelated to employment or made outside working hours.",
        "statute": "Indian Contract Act, 1872",
        "reasoning": "IP assignment should typically be limited to work created in the course of employment.",
        "confidence": 0.85
    },

    # NDA
    {
        "id": "NDA_PERPETUAL",
        "domains": ["Non-Disclosure Agreement (NDA)"],
        "patterns": [r"(?i)\bconfidentiality\b[^\.]*\b(perpetual|indefinite|survive forever|without limit)\b"],
        "riskLevel": "REQUIRES_REVIEW",
        "finding": "Imposes perpetual confidentiality obligations.",
        "statute": "Indian Contract Act, 1872",
        "reasoning": "Perpetual obligations may be considered unreasonable restraints of trade if not strictly protecting trade secrets.",
        "confidence": 0.75
    },
    {
        "id": "NDA_ONE_WAY",
        "domains": ["Non-Disclosure Agreement (NDA)"],
        "patterns": [r"(?i)\b(one party|disclosing party)\b[^\.]*\b(solely|only)\b[^\.]*\b(confidential)\b"],
        "riskLevel": "ONE_SIDED",
        "finding": "Confidentiality obligations appear entirely one-sided.",
        "statute": "N/A",
        "reasoning": "In a purportedly mutual NDA, one-way obligations disadvantage the receiving party.",
        "confidence": 0.7
    },
    {
        "id": "NDA_PENALTY",
        "domains": ["Non-Disclosure Agreement (NDA)"],
        "patterns": [r"(?i)\blonger term\b|\bliquidated damages\b[^\.]*\b(penalty|fixed amount of)\b"],
        "riskLevel": "POTENTIALLY_UNENFORCEABLE",
        "finding": "Imposes penalty-style liquidated damages for breach.",
        "statute": "Indian Contract Act, 1872",
        "reasoning": "Courts will not enforce liquidated damages that are purely penal in nature.",
        "confidence": 0.8
    },
    {
        "id": "NDA_WAIVER_REMEDY",
        "domains": ["Non-Disclosure Agreement (NDA)"],
        "patterns": [r"(?i)\b(waive|waiver)\b[^\.]*\b(injunctive relief|legal remedy|defenses)\b"],
        "riskLevel": "POTENTIALLY_UNENFORCEABLE",
        "finding": "Attempts to waive the right to seek certain legal remedies or defenses.",
        "statute": "Specific Relief Act, 1963",
        "reasoning": "Waivers of fundamental legal remedies are generally unenforceable.",
        "confidence": 0.9
    },

    # VENDOR / MSA
    {
        "id": "VEN_UNCAPPED_LIABILITY",
        "domains": ["Vendor / Master Service Agreement (MSA)", "Service Agreement"],
        "patterns": [r"(?i)\bliability\b[^\.]*\b(shall not be limited|uncapped|unlimited)\b"],
        "riskLevel": "HIGH_RISK",
        "finding": "Imposes uncapped or unlimited liability.",
        "statute": "Indian Contract Act, 1872",
        "reasoning": "Uncapped liability exposes the party to disproportionate risk compared to contract value.",
        "confidence": 0.85
    },
    {
        "id": "VEN_UNILATERAL_TERM",
        "domains": ["Vendor / Master Service Agreement (MSA)", "Service Agreement"],
        "patterns": [r"(?i)\b(terminate|modify)\b[^\.]*\b(sole discretion|at any time|without cause)\b"],
        "riskLevel": "ONE_SIDED",
        "finding": "Allows unilateral termination or modification of the agreement.",
        "statute": "N/A",
        "reasoning": "Mutual agreements should generally require mutual consent or cause for termination/modification.",
        "confidence": 0.8
    },
    {
        "id": "VEN_AUTO_RENEW",
        "domains": ["Vendor / Master Service Agreement (MSA)", "Service Agreement"],
        "patterns": [r"(?i)\b(automatically renew|auto-renewal)\b[^\.]*\b(unless notice is given|without notice)\b"],
        "riskLevel": "ONE_SIDED",
        "finding": "Contains an auto-renewal trap clause.",
        "statute": "N/A",
        "reasoning": "Auto-renewals without explicit affirmation can lock parties into unwanted terms.",
        "confidence": 0.75
    },
    {
        "id": "VEN_PAYMENT_WITHHOLD",
        "domains": ["Vendor / Master Service Agreement (MSA)", "Service Agreement"],
        "patterns": [r"(?i)\b(withhold payment)\b[^\.]*\b(sole discretion|any reason)\b"],
        "riskLevel": "HIGH_RISK",
        "finding": "Allows withholding of payment at sole discretion.",
        "statute": "N/A",
        "reasoning": "Payment should be tied to clear acceptance criteria, not arbitrary discretion.",
        "confidence": 0.85
    },

    # CRIMINAL ADJACENT
    {
        "id": "CRIM_WAIVE_COURTS",
        "domains": ["Criminal / Bail, Surety & Undertaking"],
        "patterns": [r"(?i)\b(waive|not approach)\b[^\.]*\b(court|legal recourse|legal proceedings)\b"],
        "riskLevel": "POTENTIALLY_UNENFORCEABLE",
        "finding": "Clause attempts to waive the right to approach courts.",
        "statute": "Indian Contract Act, 1872",
        "reasoning": "Agreements absolutely restricting parties from enforcing rights via standard tribunals are void under Section 28.",
        "confidence": 0.95
    },
    {
        "id": "CRIM_OPEN_INDEMNITY",
        "domains": ["Criminal / Bail, Surety & Undertaking"],
        "patterns": [r"(?i)\bindemnify\b[^\.]*\b(against any and all|all claims|without limit|forever)\b"],
        "riskLevel": "HIGH_RISK",
        "finding": "Imposes open-ended, unlimited indemnity.",
        "statute": "Indian Contract Act, 1872",
        "reasoning": "Open-ended indemnity clauses expose the indemnifier to severe, unquantifiable financial risks.",
        "confidence": 0.85
    },
    {
        "id": "CRIM_UNLIMITED_PERSONAL",
        "domains": ["Criminal / Bail, Surety & Undertaking"],
        "patterns": [r"(?i)\b(personally liable)\b[^\.]*\b(unlimited|any amount)\b"],
        "riskLevel": "HIGH_RISK",
        "finding": "Binds a person to unlimited personal liability.",
        "statute": "Indian Contract Act, 1872",
        "reasoning": "Personal liability should be capped or tied to specific, quantifiable defaults.",
        "confidence": 0.9
    }
]

def evaluate_v2_rules(clause_text: str, domain: str):
    """Evaluates the text against rule packs and returns the finding dict if any match."""
    for rule in RULE_PACKS:
        if "ALL" in rule["domains"] or domain in rule["domains"]:
            for pattern in rule["patterns"]:
                if re.search(pattern, clause_text):
                    return {
                        "riskLevel": rule["riskLevel"],
                        "finding": rule["finding"],
                        "actName": rule["statute"],
                        "reasoning": rule["reasoning"],
                        "confidence": rule["confidence"],
                        "isDeterminstic": True
                    }
    return None

def one_sidedness_signals(text: str) -> bool:
    """Returns True if the text contains strong one-sidedness signals."""
    signals = [
        r'\bsole discretion\b',
        r'\bwithout notice\b',
        r'\bunilateral\b',
        r'\birrevocable\b',
        r'\bwaive[s]?\b.*?\brights\b',
        r'\bnotwithstanding anything to the contrary\b',
        r'\bat any time\b',
        r'\bfinal and binding\b',
        r'\bwithout recourse\b'
    ]
    t = text.lower()
    match_count = sum(1 for p in signals if re.search(p, t))
    return match_count >= 2
