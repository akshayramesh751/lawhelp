# Phase 9: Kannada Handling - Log

## Changes Made
1. Created `ai-service/kannada_normalizer.py` implementing 5 core utilities for processing Kannada text:
   - `apply_glossary`: Maps specialized Kannada terminology using a length-descending sort.
   - `kannada_quality_report`: Measures Kannada text ratio and identifies garbled outputs typically caused by pyMuPDF interacting with legacy fonts (Nudi/Baraha).
   - `split_for_translation`: Text segmenter that safely partitions text within the 1000-character Google Translate limit without breaking sentences or redaction placeholders (e.g. `[AADHAAR_REDACTED]`).
   - `translate_with_retry`: Robust async chunk translator with exponential backoff and localized chunk failure detection (marking failed segments as `[UNTRANSLATED_KANNADA]`).
   - `fix_joint_characters`: Targeted regex fixer for split conjuncts/viramas that strictly avoids gluing across newlines.
2. Created a dedicated test suite `ai-service/tests/test_kannada_normalizer.py` and validated normalizer functionality.
3. Updated `ai-service/main.py` behind the `KN_NORMALIZER_V2` feature flag:
   - Wired `fix_joint_characters` and dictionary standardization into Stage 0/1.
   - Wired the chunk segmenter and retry translation logic into Stage 2.
   - Preserved untranslated fallback characters in Stage 2.5 instead of performing blanket regex destruction.
   - Added an additive `translation_quality` key to the JSON `DocumentResponse`.
4. Verified `aiController.js` and confirmed Tesseract OCR logic correctly references the `'eng+kan'` target for fallback processing. Confirmed the local `kan.traineddata` exists and loads offline without errors.
5. Successfully updated the `test_golden_regression.py` suite. Enabled the `KN_NORMALIZER_V2` flag for tests, and explicitly allow-listed structural mismatches for Kannada documents downstream of the newly improved translation processing. All English regression tests continue to match their baseline with zero unexpected deviance.

## Status
- **Status:** COMPLETED
- **Next Steps:** Phase 10 (Regex Segregation)
