import pytest
from rule_packs import evaluate_v2_rules, one_sidedness_signals

def test_rnt_entry_no_notice():
    # Positive
    res = evaluate_v2_rules("The landlord may enter the premises at any time without notice.", "Rental / Lease Agreement")
    assert res and res["riskLevel"] == "ONE_SIDED"
    
    # Negative
    res = evaluate_v2_rules("The landlord may enter the premises with 24 hours prior notice.", "Rental / Lease Agreement")
    assert res is None

def test_rnt_forfeit_deposit():
    # Positive
    res = evaluate_v2_rules("The landlord shall forfeit the entire deposit if the tenant vacates early.", "Rental / Lease Agreement")
    assert res and res["riskLevel"] == "HIGH_RISK"
    
    # Negative
    res = evaluate_v2_rules("The landlord may deduct actual damages from the deposit.", "Rental / Lease Agreement")
    assert res is None

def test_rnt_unilateral_escalation():
    # Positive
    res = evaluate_v2_rules("The landlord can increase the rent at their sole discretion.", "Rental / Lease Agreement")
    assert res and res["riskLevel"] == "ONE_SIDED"
    
    # Negative
    res = evaluate_v2_rules("The rent will increase by 5% every year.", "Rental / Lease Agreement")
    assert res is None

def test_rnt_heavy_lock_in():
    # Positive
    res = evaluate_v2_rules("If vacated during lock-in, tenant is liable to pay for the balance term.", "Rental / Lease Agreement")
    assert res and res["riskLevel"] == "HIGH_RISK"
    
    # Negative
    res = evaluate_v2_rules("If vacated during lock-in, tenant will forfeit 2 months rent.", "Rental / Lease Agreement")
    assert res is None

def test_emp_withhold_docs():
    # Positive
    res = evaluate_v2_rules("Employer will withhold original certificates until end of probation.", "Employment Agreement")
    assert res and res["riskLevel"] == "HIGH_RISK"
    
    # Negative
    res = evaluate_v2_rules("Employees must show original certificates for verification on day one.", "Employment Agreement")
    assert res is None

def test_emp_waiver_benefits():
    # Positive
    res = evaluate_v2_rules("The employee agrees to waive overtime pay.", "Employment Agreement")
    assert res and res["riskLevel"] == "POTENTIALLY_UNENFORCEABLE"
    
    # Negative
    res = evaluate_v2_rules("The employee is eligible for overtime pay per company policy.", "Employment Agreement")
    assert res is None

def test_nda_perpetual():
    # Positive
    res = evaluate_v2_rules("Confidentiality obligations will survive forever.", "Non-Disclosure Agreement (NDA)")
    assert res and res["riskLevel"] == "REQUIRES_REVIEW"
    
    # Negative
    res = evaluate_v2_rules("Confidentiality survives for 3 years after termination.", "Non-Disclosure Agreement (NDA)")
    assert res is None

def test_nda_one_way():
    # Positive
    res = evaluate_v2_rules("Only the Disclosing Party's info is solely confidential.", "Non-Disclosure Agreement (NDA)")
    assert res and res["riskLevel"] == "ONE_SIDED"
    
    # Negative
    res = evaluate_v2_rules("Both parties shall keep information confidential.", "Non-Disclosure Agreement (NDA)")
    assert res is None

def test_ven_uncapped_liability():
    # Positive
    res = evaluate_v2_rules("The vendor liability shall not be limited.", "Vendor / Master Service Agreement (MSA)")
    assert res and res["riskLevel"] == "HIGH_RISK"
    
    # Negative
    res = evaluate_v2_rules("The vendor liability shall be limited to the total contract value.", "Vendor / Master Service Agreement (MSA)")
    assert res is None

def test_crim_waive_courts():
    # Positive
    res = evaluate_v2_rules("The parties waive the right to approach any court.", "Criminal / Bail, Surety & Undertaking")
    assert res and res["riskLevel"] == "POTENTIALLY_UNENFORCEABLE"
    
    # Negative
    res = evaluate_v2_rules("The parties may approach a competent court of jurisdiction.", "Criminal / Bail, Surety & Undertaking")
    assert res is None

def test_one_sidedness_signals():
    # Positive (needs 2 signals)
    assert one_sidedness_signals("This is at our sole discretion and is final and binding.") == True
    
    # Negative
    assert one_sidedness_signals("This agreement requires mutual consent.") == False
