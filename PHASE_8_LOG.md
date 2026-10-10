# Phase 8 Implementation Log — Baseline and Golden Tests
Goal: Lock current behaviour so every later change can be proven non-breaking.

## 🧭 Problem Verified
The project lacks a robust automated test suite to ensure that upcoming changes to Kannada handling, clause segmentation, and detection logic do not inadvertently alter the current behavior of the system. Thus, a set of offline baseline tests is essential.

## 📂 Summary of Changes
- **File Modified**: `ai-service/requirements-dev.txt`
  - Added `pytest-asyncio` for comprehensive offline testing capabilities (alongside `pytest`).
- **File Untouched-on-purpose**: `ai-service/tests/conftest.py`
  - Examined the existing file that sets the testing environment offline by mocking `GoogleTranslator` and nullifying API keys.
- **File Modified**: `ai-service/tests/make_baseline.py`
  - Fixed a `UnicodeEncodeError` by removing emojis so it executes correctly on Windows CP-1252 consoles.
- **File Created**: `ai-service/tests/test_golden_regression.py`
  - Added the test script that runs `process_text_pipeline` across 6 scenarios and performs a diff against the generated baseline `.json` files. Includes an explicit allow-list for known intentional changes in subsequent phases.

## 🚩 Feature Flags & Fallbacks
- Baseline tests explicitly set `KN_NORMALIZER_V2`, `CLAUSE_SEGMENTER_V2`, and `RULE_PACKS_V2` to `"0"` in `conftest.py` to assert legacy behavior.

## 🧠 Decisions & Rationale
- **Allow-list mechanism**: Designed `dicts_are_equal` to recursively ignore changes to paths provided in an explicit `INTENDED_CHANGES` dictionary. This prevents test failure for anticipated enhancements like additional data fields or expected new clause outputs during later phases.

## 🧪 Verification Commands
- `python tests/make_baseline.py`
- `python -m pytest tests/test_golden_regression.py -v`

## ✅ Verified Test Cases
- Generates 6 `baseline_*.json` golden outputs without error.
- All golden regression scenarios (`scenario_A`, `scenario_B`, `scenario_C`, `scenario_D`, `phase5_clauses`, `kannada_archaic`) PASS against their newly minted baselines.

## ⚠️ Known Limitations & Open Questions
- None. The safety net captures the existing pipeline's output.

## ↩️ Rollback
- Remove `ai-service/tests/` and revert `requirements-dev.txt`.

## 🔀 Git
- Branch: `phase-8-baseline-tests`
- (Will be committed after review)
