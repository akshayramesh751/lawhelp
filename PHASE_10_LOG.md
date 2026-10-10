# Phase 10 Log: Clause Analysis & Segmentation Upgrades

## Overview
Phase 10 implemented improvements to the `CaseCounsel` pipeline regarding risk matrix duplicity, clause segmentation, and detection of one-sided clauses.

## Why One-Sided Clauses Pass the Authority Gate
Prior to these changes, one-sided clauses (e.g., asymmetrical termination, unilateral modifications, disproportionate lock-ins) routinely passed through the authority gate unflagged. This is because **one-sidedness is rarely a direct statutory violation**. Traditional RAG and deterministic statutory gates check for conflicts against specific Acts (like the Indian Contract Act or Karnataka Rent Control Act). An oppressive lock-in period or unilateral termination right might be a severe contractual imbalance, but it is often technically legal under the broad umbrella of freedom of contract, meaning there is no clear statutory conflict to trigger the authority gate.

## Addressing the Gap via `rule_packs.py`
To solve this without adding the heavy latency of a second LLM pass, we implemented a robust, deterministic heuristics engine in `rule_packs.py`. 

1. **Domain-Specific Rule Packs**: We added regex-based rules specifically targeted at common one-sided patterns in specific domains (e.g., Rental, Employment, Vendor MSA, NDAs).
2. **Generic One-Sidedness Signals**: We introduced `one_sidedness_signals()` which detects pervasive linguistic signals of imbalance across any domain, requiring two or more signals (e.g., "sole discretion" + "forfeit") to trigger a flag.
3. **Short-Circuiting Authority Gate**: We updated `clause_analyzer.py` (behind the `RULE_PACKS_V2` flag) to evaluate these one-sidedness signals. If a clause lacks statutory risk *but exhibits strong one-sided signals*, the authority gate will **no longer short-circuit** it to `NO_ISSUE_DETECTED`. Instead, it allows the clause to proceed for deeper review (LLM batch or heuristic offline review), ensuring abusive contractual conditions are properly scrutinized.
4. **Integration**: `evaluate_v2_rules` is hooked gracefully into `rule_engine.py` at the very end of `evaluate_deterministic_rules()`. This ensures all legacy behavior and golden regressions are untouched unless the `RULE_PACKS_V2=1` feature flag is explicitly enabled.

## Additional Improvements
*   **Classifier Expansion**: Added "Criminal / Bail, Surety & Undertaking" to `taxonomy.json` with appropriate headers and weighted keywords. (Vendor/MSA is handled via rules, although not explicitly added to taxonomy as it wasn't requested).
*   **Comprehensive Testing**: Added positive and negative test cases for each domain rule in `tests/test_rule_packs.py` and validated that `test_golden_regression.py` passes fully with default settings.

## Recommendations
Because we added the 'Criminal / Bail, Surety & Undertaking' domain, we recommend seeding the knowledge base with relevant penal/bail codes (e.g., Bharatiya Nagarik Suraksha Sanhita, 2023 / CrPC provisions) for better RAG retrieval. A draft seed script has been created under `scratch/seed_criminal_kb.py`.
