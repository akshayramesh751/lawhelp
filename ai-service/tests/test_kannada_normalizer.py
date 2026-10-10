import pytest
from kannada_normalizer import (
    apply_glossary,
    kannada_quality_report,
    split_for_translation,
    fix_joint_characters
)

def test_apply_glossary_longest_match():
    # 'ಮುಂಗಡ' vs 'ಮುಂಗಡ ಹಣ ಮರುಪಾವತಿ ಹಕ್ಕು'
    glossary = {
        "ಮುಂಗಡ": "advance",
        "ಮುಂಗಡ ಹಣ ಮರುಪಾವತಿ ಹಕ್ಕು": "right to advance refund"
    }
    # Longest should match first
    text = "ಇದು ಮುಂಗಡ ಹಣ ಮರುಪಾವತಿ ಹಕ್ಕು ಬಗ್ಗೆ."
    result = apply_glossary(text, glossary)
    assert result == "ಇದು  right to advance refund  ಬಗ್ಗೆ."

def test_split_for_translation_preserves_placeholders():
    text = "ಇದು [AADHAAR_REDACTED] ಸಂಖ್ಯೆ.\nಇನ್ನೊಂದು [PAN_REDACTED] ಆಗಿದೆ." * 20
    # Should not split mid-placeholder even if near 1000 limit
    chunks = split_for_translation(text, max_len=50)
    for chunk in chunks:
        assert "[AADHAAR" not in chunk or "[AADHAAR_REDACTED]" in chunk
        assert "[PAN" not in chunk or "[PAN_REDACTED]" in chunk

def test_fix_joint_characters_newline_gluing():
    text = "ಮುಂಗಡ\nಹಣ"
    # Previously \s+ glued these across newlines if there was logic doing so
    # fix_joint_characters should only fix spaces/tabs on the same line
    result = fix_joint_characters(text)
    assert "\n" in result

def test_kannada_quality_report_legacy_font_garble():
    garbled_text = "Ã¤ÂªÃ¤Â°Ã¤Â¿Ã¤Â²Ã¤Â¿" * 3 # Example of garbled Nudi/Baraha output in pyMuPDF
    report = kannada_quality_report(garbled_text)
    assert report["looks_garbled"] is True
    assert report["kannada_ratio"] < 0.1

def test_split_for_translation_preserves_newlines():
    text = "Line 1.\nLine 2.\nLine 3."
    chunks = split_for_translation(text, max_len=10)
    assert chunks[0] == "Line 1.\n"
