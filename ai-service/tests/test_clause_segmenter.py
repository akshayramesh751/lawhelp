import pytest
from clause_segmenter import segment_clauses

def test_mixed_case_headings():
    text = """
1. Engagement
Text 1
2. remuneration
Text 2
3. Confidentiality
Text 3
4. termination
Text 4
5. Governing law
Text 5
6. Non-Compete
Text 6
"""
    clauses = segment_clauses(text)
    assert len(clauses) == 6
    assert clauses[0]["clauseIndex"] == 1
    assert "remuneration" in clauses[1]["clauseHeader"].lower()

def test_different_numbering_styles():
    texts = [
        "1) Engagement\nText\n2) Remuneration\nText",
        "(1) Engagement\nText\n(2) Remuneration\nText",
        "Clause 1. Engagement\nText\nClause 2. Remuneration\nText",
        "Article I. Engagement\nText\nArticle II. Remuneration\nText",
        "Section 1. Engagement\nText\nSection 2. Remuneration\nText",
        "1.1 Engagement\nText\n1.2 Remuneration\nText",
        "(a) Engagement\nText\n(b) Remuneration\nText",
        "i) Engagement\nText\nii) Remuneration\nText",
        "1\nEngagement\nText\n2\nRemuneration\nText"
    ]
    for text in texts:
        clauses = segment_clauses(text)
        assert len(clauses) == 2, repr(text)
        assert clauses[0]["clauseIndex"] == 1
        assert clauses[1]["clauseIndex"] == 2

def test_unnumbered_all_caps_and_recitals():
    text = """
WHEREAS this agreement is made...
AND WHEREAS the parties...
NOW THEREFORE...
ENGAGEMENT
The employee will work.
REMUNERATION
The employer will pay.
SCHEDULE A
Property details.
"""
    clauses = segment_clauses(text)
    # WHEREAS (recitals) can be lumped together or separated
    # Usually recitals is 1 clause, then ENGAGEMENT, REMUNERATION, SCHEDULE A.
    # Total clauses should be at least 4.
    assert len(clauses) >= 4
    headers = [c["clauseHeader"].upper() for c in clauses]
    assert any("WHEREAS" in h or "RECITALS" in h for h in headers)
    assert any("ENGAGEMENT" in h for h in headers)
    assert any("REMUNERATION" in h for h in headers)
    assert any("SCHEDULE" in h for h in headers)

def test_ignore_page_markers():
    text = """
1. Engagement
Text
--- PAGE 1 ---
2. Remuneration
Text
"""
    clauses = segment_clauses(text)
    assert len(clauses) == 2
    assert "PAGE" not in clauses[1]["clauseHeader"]
    assert "Remuneration" in clauses[1]["clauseHeader"]

def test_duplicate_numbering():
    text = """
1. Engagement
Text 1
2. Remuneration
Text 2
1. Annexure Part 1
Text 3
2. Annexure Part 2
Text 4
"""
    clauses = segment_clauses(text)
    assert len(clauses) == 4
    indices = [c["clauseIndex"] for c in clauses]
    assert indices == [1, 2, 3, 4] # MUST BE UNIQUE AND SEQUENTIAL

def test_kannada_derived_text():
    text = """
೧. ಒಪ್ಪಂದ
ಪಠ್ಯ 1
೨. ಸಂಭಾವನೆ
ಪಠ್ಯ 2
"""
    clauses = segment_clauses(text)
    assert len(clauses) == 2
    assert clauses[0]["clauseIndex"] == 1
    assert clauses[1]["clauseIndex"] == 2

def test_over_long_clauses_split():
    text = """
1. Main Clause
A very long text.
1.1 Sub item A
Text for sub item A
1.2 Sub item B
Text for sub item B
2. Second Clause
Text
"""
    clauses = segment_clauses(text)
    assert len(clauses) == 4
    assert clauses[0]["clauseHeader"] == "1. Main Clause"
    assert clauses[1]["clauseHeader"] == "1.1 Sub item A"
    assert clauses[2]["clauseHeader"] == "1.2 Sub item B"
    assert clauses[3]["clauseHeader"] == "2. Second Clause"
