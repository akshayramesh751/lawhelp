# RCA & Fix Log — Duplicate / Look-alike Clauses in the 5-Tier Risk Matrix

**Date:** 2026-10-10  
**Symptom:** Risk-matrix cards for different clauses showed the same section label
(“Encumbrance & Title Warranty” ×5, “Financial & Consideration Schedules” ×3), near-identical
*finding* sentences (“No apparent statutory conflict identified… standard denial…”) and near-identical
*reasoning* paragraphs. This looked like duplicated content and undermined credibility.
The uploaded document was a **legal notice** (denials, demands), not a sale deed.

## Root causes

| # | Where | Problem | Evidence |
|---|-------|---------|----------|
| 1 | `ai-service/main.py` `parse_legal_structure` | Clause type picked by **raw substring search over the whole clause body**, first match wins. `"rent"` matches *cur**rent***, `"charges"`/`"indemnity"` match any notice paragraph, `"car"` matches *care*. Every numbered paragraph of a notice fell into 1–2 buckets. | Clauses #1,2,5,6,8 → “Encumbrance & Title Warranty” |
| 2 | same | No concept of **document genre**. A notice paragraph is an *averment/denial/demand*, not a contractual covenant, but was forced into contract taxonomy. | Denials labelled “Title Warranty” |
| 3 | `clause_analyzer.py` prompts | The system prompts **embedded a canned sentence template** (“No apparent statutory conflict… standard and comprehensive [Type]… in compliance with relevant procedural requirements…”) and demanded sale-deed topics (RTGS, TDS 194-IA, stamp duty) in *every* compliant clause. The LLM at temperature 0 copied it → identical text. | Identical openings on every card; irrelevant statute mentions |
| 4 | `citation_auditor.py` | “Vague text” safety net **replaced** any short answer with one fixed paragraph per domain (e.g. “Deed of Absolute Sale”), chosen by substring checks on the clause. All clauses of a document therefore got byte-identical text, wrong for non-deeds. | Wrong “sale deed” language on a notice |
| 5 | `clause_analyzer.py` `heuristic_grounded_evaluation` | Offline-LLM fallback returned the same canned paragraph per domain. | Same as #4 |
| 6 | no component | **No cross-clause similarity check** existed, so nothing caught duplicates after generation. | — |
| 7 | `cache_service.py` | Cache would have kept serving old boilerplate results after the fix. | `PROMPT_VERSION` unchanged |

## Changes (with reasoning)

1. **`main.py` — new `classify_clause_type`, `_has_kw`, `_looks_like_legal_notice`**
   - Whole-word matching (`\b…\b`) removes false positives (#1).
   - Header keywords outrank body text; body matching uses only *specific multi-word phrases*
     (e.g. “free from all encumbrances”) rather than generic words.
   - Legal notices are detected and classified by **rhetorical function**:
     *Denial of Allegations, Demand / Call to Perform, Consequences & Reservation of Rights,
     Agreement / Payment Particulars, Factual Background*. Reason: gives distinct, truthful labels (#2).
2. **`clause_analyzer.py` prompts** — removed the canned template and sale-deed checklist; now require a
   finding unique to the clause (naming its concrete party/amount/date/allegation), forbid stock openings
   and cross-clause reuse, instruct notice-aware analysis, and cite statutes only when relevant (#3).
3. **`clause_analyzer.py` `deduplicate_findings`** — new post-pass: token-Jaccard similarity of
   finding+reasoning (threshold `0.55`). A later *compliant* clause that near-duplicates an earlier one
   is re-grounded in its own quoted wording; `dedupeNote` and `similarToClause` record exactly what
   happened (explainability), confidence is capped at 0.90. Flagged (risk) clauses are never rewritten.
   Operates on copies so cached objects aren’t polluted (#6).
4. **`citation_auditor.py`** — canned per-domain paragraphs replaced by a fallback built from the
   clause’s own excerpt; statutes are named only if whole-word evidence exists; confidence capped at 0.85
   (so it is flagged for human review rather than overstated) (#4).
5. **`clause_analyzer.py` heuristic fallback** — returns an intentionally empty compliant shell so the
   auditor grounds it per clause (#5).
6. **`cache_service.py`** — `PROMPT_VERSION` → `v3.0_clause_specific_nodup` to invalidate stale entries (#7).
7. **Test:** `scratch/test_dedupe_and_taxonomy.py` (taxonomy, dedupe, auditor uniqueness).

## Known limits / follow-ups
- Similarity threshold (0.55) is heuristic; tune on real documents.
- Previously analysed documents keep stored results until re-uploaded/re-analysed.
- `server/controllers/aiController.js` derives chat `domain` from clause #1’s type; this should use
  `classification.domain` instead (not changed here).
- Frontend may want to display `dedupeNote` as a tooltip.
