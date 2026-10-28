# CaseCounsel — Master Technical Specification & Architecture Documentation
**Enterprise System Blueprint, Multi-Tier Processing Pipeline & Implementation Specification**  
**Document Version:** 2.0.0 (Comprehensive Post-Phase 11 Edition)  
**Last Updated:** October 28, 2026  
**Target Jurisdictions:** Central Indian Law (ICA 1872, TPA 1882, Gratuity Act 1972, Code on Wages 2019, Specific Relief Act 1963) & State Jurisdictions (Karnataka Shops Act 1961, Karnataka Rent Control Act 2001)

---

## 1. Executive Summary & Core Architectural Paradigm

### 1.1 Project Objective
**CaseCounsel** (formerly referenced as NyayaConnect) is an enterprise-grade legal document intelligence platform engineered to parse, sanitize, translate, structure, analyze, summarize, and cross-evaluate complex legal agreements and instruments. Supported document verticals include:
* Residential and Commercial Lease Agreements
* Employment Contracts and Workman Covenants
* Non-Disclosure Agreements (NDAs) & Intellectual Property Assignments
* Master Service Agreements (MSAs) & Vendor Contracts
* Statutory Bonds, Criminal Undertakings & Legal Notices

The platform democratizes access to legal comprehension by translating opaque legalese into structured, plain-language executive summaries while subjecting every clause to a rigorous, auditable compliance audit against statutory benchmarks and judicial precedents.

---

### 1.2 The Fundamental Conceptual Shift: Decoupling Document Truth from Legal Truth
A prevalent architectural flaw in AI legal engineering is the ungrounded, end-to-end approach: piping raw scanned text alongside large context windows of statute text into a generative Large Language Model (LLM) with a generic prompt such as *"Is this document legal and what are its risks?"*

Empirical testing and literature have demonstrated that this naive architecture fails systematically due to:
1. **Hallucinatory Legal Inferences:** LLMs fabricate statutory section numbers, cross-contaminate state with central acts, and imagine non-existent binding precedents.
2. **Context Window Dilution:** High-signal operative clauses (such as non-compete covenants or dispute resolution clauses) get drowned out in extensive contractual boilerplate.
3. **Loss of Grounded Determinism:** Fixed numerical thresholds (e.g., minimum notice periods, statutory wage deductions, or interest caps) fluctuate probabilistically between inference calls.
4. **Context Bleed:** The obligations internal to the document become conflated with the external statutory mandates of the jurisdiction.

To guarantee auditable, explainable, and zero-hallucination results, **CaseCounsel strictly bifurcates its pipeline into two distinct knowledge planes**:

```
                                 +---------------------------------------+
                                 |             USER DOCUMENT             |
                                 +---------------------------------------+
                                                     |
                                                     v
                        +---------------------------------------------------+
                        |        SANITIZATION & STRUCTURING PIPELINE        |
                        +---------------------------------------------------+
                                          |                   |
                                          v                   v
                     +--------------------------+       +--------------------------+
                     |       PLANE A:           |       |       PLANE B:           |
                     |    DOCUMENT TRUTH        |       |       LEGAL TRUTH        |
                     | (Internal Comprehension) |       |  (External Verification) |
                     +--------------------------+       +--------------------------+
                                  |                                   |
                                  | "What does this agreement say?"   | "What does applicable law mandate?"
                                  | - Contract Parties & Term         | - Central & State Statutes
                                  | - Affirmative Obligations         | - Binding SC & High Court Precedents
                                  | - Financial Terms & Deadlines     | - Dynamic Rules & Regulations
                                  | - Termination Triggers            | - Quantitative Statutory Ceilings
                                  |                                   |
                                  +-----------------+-----------------+
                                                    |
                                                    v
                                  +-----------------------------------+
                                  |        HYBRID VERIFICATION        |
                                  |         & AUDIT ENGINE            |
                                  +-----------------------------------+
                                                    |
                                                    v
                                  +-----------------------------------+
                                  |    EXPLAINABLE SEVERITY MATRIX    |
                                  | (🔴 High | 🟠 Review | 🟢 Compliant) |
                                  +-----------------------------------+
```

* **Plane A (Document Truth):** What did the parties agree to? This plane parses, translates, structures, and summarizes the text verbatim without judging legality.
* **Plane B (Legal Truth):** What does the governing jurisdiction mandate? This plane extracts governing statutes, state rules, and authoritative ratios from an isolated, curated legal knowledge base.
* **Hybrid Verification:** Reconciles Plane A with Plane B via deterministic rule engines for quantitative boundaries, and tightly constrained, retrieval-augmented LLM reasoning for qualitative covenants.

---

## 2. Decoupled 3-Tier System Architecture

The platform is designed as an event-driven, decoupled microservices ecosystem:

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT TIER                                          |
|  React 18 SPA (Vite + TypeScript + Tailwind CSS "Midnight Gilded" UI Theme)             |
|  - Drag-and-Drop Ingestion (PDF / Multi-Image Bundles up to 5 images)                   |
|  - Multi-Stage Real-Time Pipeline Progress Tracker                                      |
|  - Interactive Side-by-Side Document Viewer & 5-Tier Calibrated Risk Matrix             |
|  - Grounded Legal Assistant Drawer (Document-Context Q&A with Statutory Citations)      |
|  - Lawyer Discovery & Scheduling Marketplace                                            |
+-----------------------------------------------------------------------------------------+
                                      |  HTTPS / REST / JSON
                                      v
+-----------------------------------------------------------------------------------------+
|                                  API GATEWAY TIER                                       |
|  Express.js REST Engine (Node.js v18+)                                                  |
|  - Authentication: Firebase Token Auth & Role Guard                                    |
|  - Ingestion Broker: Multer Memory Storage, SHA-256 Deduplication, Page Ordering        |
|  - Durable Archival: AWS S3 Encrypted Storage (AES-256 KMS SSE), Expiring Signed URLs   |
|  - Persistence Ledger: MongoDB Mongoose (OriginalDocuments & DocumentSummaries)        |
|  - Compliance Daemon: 30-Day Automated Purge TTL Index (DPDP Act Compliance)            |
|  - OCR Orchestration: Multi-Threaded Tesseract.js (`eng+kan` Multi-Language Fallback)   |
|  - Read Caching: Redis In-Memory Directory & Cache Layer                                |
+-----------------------------------------------------------------------------------------+
                                      |  Internal HTTP REST / Microservice Bridge
                                      v
+-----------------------------------------------------------------------------------------+
|                              NLP & AI REASONING TIER                                    |
|  FastAPI Dedicated Microservice (Python 3.10 - 3.13)                                    |
|  - Native-First Parser: PyMuPDF Unicode Extraction with Substantial Image Area Analysis |
|  - Regional Script Engine: Kannada Unicode Normalizer, Glossary Replacement & Virama Fix|
|  - Machine Translation: Boundary-Preserving Chunked Google Translate with Retry Backoff |
|  - Privacy Shield: Microsoft Presidio Legal-NER + Dual-Pass PII Pattern Redaction       |
|  - Structural Segmenter: Context-Aware Numbering Scheme Detection (Arabic/Roman/Alpha)  |
|  - Hierarchical Classifier: 3-Tier Domain Router (Header -> Heuristic -> Zero-Shot)     |
|  - Dual-Path Analysis Engine: Deterministic Statutory Engine + Grounded LLM Gateway    |
|  - Hybrid Vector Store: ChromaDB (4 Isolated Legal Indexes) + BM25 Sparse Search + RRF  |
|  - Credibility Layer: Token-Jaccard Finding Deduplication + Statute Citation Auditor    |
+-----------------------------------------------------------------------------------------+
```

---

## 3. End-to-End Pipeline Workflow Diagram

```
                               +-------------------------------------+
                               | User Ingestion: PDF / Images <= 5   |
                               +-------------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               | S3 Durable Storage & SHA-256 Hash   |
                               | (KMS SSE-S3, Audit Ledger Tracking) |
                               +-------------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               | PyMuPDF Native Text Extraction      |
                               +-------------------------------------+
                                                  |
                                       [Text Density Check]
                                         /              \
                        [Low Density / Scanned]       [Clean Digital Text]
                                       /                  \
                                      v                    \
                      +--------------------------------+    \
                      | Per-Page Substantial Image     |     \
                      | Area Detection (> 15% Area)    |      \
                      +--------------------------------+       \
                                      |                         \
                                      v                          \
                      +--------------------------------+          \
                      | Node.js Tesseract OCR          |           \
                      | (`eng+kan` 200 DPI Fallback)   |            \
                      +--------------------------------+             \
                                      |                               \
                                      +---------------+---------------+
                                                      |
                                                      v
                                      +--------------------------------+
                                      | Per-Page Text Merging Routine  |
                                      +--------------------------------+
                                                      |
                                                      v
                                      +--------------------------------+
                                      | Kannada Script Detection       |
                                      +--------------------------------+
                                             /                  \
                                     [Yes, Kannada]        [No, English]
                                           /                      \
                                          v                        \
                      +--------------------------------+            \
                      | Stage 0: Unicode Normalization |             \
                      | & Conjunct / Virama Repair     |              \
                      +--------------------------------+               \
                                      |                                 \
                                      v                                  \
                      +--------------------------------+                  \
                      | Stage 1: Domain Legal Glossary |                   \
                      | Substitution (Longest First)   |                    \
                      +--------------------------------+                     \
                                      |                                       \
                                      v                                        \
                      +--------------------------------+                        \
                      | Stage 2: Pre-Translation PII   |                         \
                      | Redaction (Aadhaar / PAN)      |                          \
                      +--------------------------------+                           \
                                      |                                             \
                                      v                                              \
                      +--------------------------------+                              \
                      | Stage 3: Sentence-Bounded      |                               \
                      | Translation (1000 Char Chunks) |                                \
                      +--------------------------------+                                 \
                                      |                                                   \
                                      +-----------------------+---------------------------+
                                                              |
                                                              v
                                              +--------------------------------+
                                              | Stage 4: Post-Translation PII  |
                                              | Redaction (Presidio Legal-NER) |
                                              +--------------------------------+
                                                              |
                                                              v
                                              +--------------------------------+
                                              | Stage 5: Context-Aware Clause  |
                                              | Segmentation (Scheme Hunter)   |
                                              +--------------------------------+
                                                              |
                                                              v
                                              +--------------------------------+
                                              | Stage 6: Hierarchical Document |
                                              | Classification (3-Tier Engine) |
                                              +--------------------------------+
                                                              |
                                 +----------------------------+----------------------------+
                                 |                                                         |
                                 v                                                         v
                  ================================          ================================
                  TRACK A: DOCUMENT TRUTH                   TRACK B: LEGAL RISK AUDIT
                  ================================          ================================
                                 |                                                         |
                                 v                                                         v
                  +------------------------------+          +------------------------------+
                  | Structured Entity Extraction |          | Isolated Clause Processing   |
                  | - Parties & Contract Term    |          +------------------------------+
                  | - Affirmative Covenants      |                                         |
                  | - Negative Covenants         |                                         v
                  | - Financial Terms & Deposits |          +------------------------------+
                  | - Termination Triggers       |          | Quantitative / Rule Pack?    |
                  | - Dispute Resolution Seats   |          +------------------------------+
                  +------------------------------+                         /               \
                                 |                                [ YES ] /                 \ [ NO ]
                                 v                                       v                   v
                  +------------------------------+        +----------------------+   +----------------------+
                  | MongoDB DocumentSummary      |        | Deterministic Rule   |   | Hybrid RAG Search    |
                  | State Persistence            |        | Engine & Rule Packs  |   | (BM25 + Dense + RRF) |
                  +------------------------------+        +----------------------+   +----------------------+
                                                                         |                   |
                                                                         |                   v
                                                                         |           +----------------------+
                                                                         |           | Authority Gate Check |
                                                                         |           | (One-Sidedness Test) |
                                                                         |           +----------------------+
                                                                         |                   |
                                                                         |                   v
                                                                         |           +----------------------+
                                                                         |           | Grounded LLM Context |
                                                                         |           | Bounded Reasoning    |
                                                                         |           +----------------------+
                                                                         |                   |
                                                                         +---------+---------+
                                                                                   |
                                                                                   v
                                                                     +------------------------------+
                                                                     | Finding Deduplication Guard  |
                                                                     | (Jaccard Similarity >= 0.55) |
                                                                     +------------------------------+
                                                                                   |
                                                                                   v
                                                                     +------------------------------+
                                                                     | Citation Auditor & 5-Tier    |
                                                                     | Severity Matrix Calibration  |
                                                                     +------------------------------+
                                                                                   |
                                 +-------------------------------------------------+
                                 |
                                 v
                  +----------------------------------------------+
                  | Interactive Client Dashboard & Chat Drawer   |
                  +----------------------------------------------+
```

---

## 4. Detailed Technical Specifications by Phase

### Phase 1: Ingestion, Multi-Image Bundling, S3 Durable Storage & DPDP Compliance
* **Multimodal Upload Gateway:** Accepts standard single PDFs or up to 5 multi-image files (JPEG, PNG, WebP) up to 10 MB per file.
* **Relational Storage Model:**
  * File uploads generate an aggregate `documentId` (UUID v4) stored in the `OriginalDocument` collection.
  * Preserves sequential page indexes (`sequenceIndex: 0..N-1`) for multi-page image uploads.
* **Security & KMS Encryption:** Direct streaming uploads to AWS S3 using AES-256 Server-Side KMS encryption (`aws:kms`).
* **Integrity Ledger:** Computes SHA-256 hashes of all raw file buffers to prevent tampering and enable idempotent document caching.
* **Ephemeral Access:** Pre-signed URLs with an expiry of 900 seconds (15 minutes). No public bucket access is permitted.
* **DPDP Act Compliance (Digital Personal Data Protection Act, 2023):** MongoDB `createdAt` field configured with a `2,592,000` seconds (30 days) TTL index, guaranteeing automatic regulatory deletion of customer data.

---

### Phase 2: Persistence Pipeline, Multilingual Preprocessing & PII Masking
* **Database Schema Realization:** Implements the `DocumentSummaries` collection linking foreign-key references to `OriginalDocument` records.
* **Unicode Resiliency & Preprocessing:**
  * Regex and Unicode normalization routines (`NFKC`) resolving broken conjuncts, half-forms, and glyph misalignments common in regional OCR.
  * Sanitizes archaic Kannada legal terms and preambles (e.g., *ಖರೀದಿ ಒಪ್ಪಂದ*, *ಬಾಡಿಗೆ ಕರಾರು*, *ಕರಾರುಪತ್ರ*) prior to translation.
* **Dual-Stage PII Detection & Redaction:**
  * **Stage 1 (Pre-Translation Regex Masking):** Masks structured numerical identifiers before machine translation to prevent format corruption:
    * Aadhaar (12-digit UID): `\b[2-9]{1}[0-9]{3}\s[0-9]{4}\s[0-9]{4}\b` $\rightarrow$ `[AADHAAR_REDACTED]`
    * Permanent Account Number (PAN): `\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b` $\rightarrow$ `[PAN_REDACTED]`
    * Phone Numbers: `(?:\+91[\-\s]?)?[6-9]\d{9}` $\rightarrow$ `[PHONE_REDACTED]`
    * Indian Cheque Numbers: `\b\d{6}\b` $\rightarrow$ `[CHEQUE_REDACTED]`
  * **Stage 2 (Post-Translation NLP Anonymization):** Employs Microsoft Presidio Analyzer and Anonymizer engines with spacy legal NER models to detect and mask personal emails, residential addresses, and party names while tracking precise character offsets.

---

### Phase 3: Cognitive Fallback & 3-Tier Classification Engine
To route documents to their correct legal vertical, CaseCounsel executes a hierarchical 3-tier classifier:
1. **Tier 1 (Deterministic Header Matching):** Scans the first 1000 characters for unequivocal title patterns (e.g., *"LEASE AGREEMENT"*, *"NON-DISCLOSURE AGREEMENT"*, *"CRIMINAL BAIL BOND"*).
2. **Tier 2 (Heuristic Keyword Density):** Computes normalized token frequency scores over domain-specific legal vocabularies (e.g., `lessor`, `lessee`, `liquidated damages`, `surety`, `indemnification`).
3. **Tier 3 (Zero-Shot Cognitive Fallback):** If Tier 1 and Tier 2 yield confidence $< 0.75$, routes extracted recitals to a zero-shot legal classifier configured with taxonomy labels from `taxonomy.json`. Documents scoring $< 0.60$ across all tiers are flagged as `Uncategorized Legal Document` and scheduled for manual audit review.

---

### Phase 4: Legal Knowledge Architecture & Hybrid RAG Layer
* **Decoupled Legal Collections:** Rather than combining statutes and cases into a monolithic index, CaseCounsel maintains four isolated ChromaDB collections:
  1. `statutes_index`: Central legislative enactments (Indian Contract Act 1872, Code on Wages 2019, Specific Relief Act 1963).
  2. `state_laws_index`: State-specific enactments (Karnataka Shops and Commercial Establishments Act 1961, Karnataka Rent Control Act 2001).
  3. `rules_regulations_index`: Subordinate administrative regulations, state labour rules, model tenancy standing orders.
  4. `case_law_index`: Authoritative High Court and Supreme Court of India *ratio decidendi* excerpts.
* **Structural Legal Chunking:** Legal texts are chunked along structural legislative boundaries:
  $$\text{Act} \longrightarrow \text{Chapter} \longrightarrow \text{Section} \longrightarrow \text{Subsection} \longrightarrow \text{Explanation / Proviso}$$
* **Hybrid Retrieval Mechanics:**
  * **Dense Semantic Vector Search:** 384-dimensional dense embeddings generated via `sentence-transformers/all-MiniLM-L6-v2`.
  * **Sparse Lexical Search:** BM25 scoring for exact statutory references, section numbers, and archaic legal terminology.
  * **Reciprocal Rank Fusion (RRF):** Fuses sparse and dense candidate ranks:
    $$RRF(d) = \sum_{m \in \{BM25, Dense\}} \frac{1}{60 + r_m(d)}$$
  * **Strict Metadata Filtering:** Candidate chunks are strictly partitioned prior to evaluation:
    $$\text{Country} = \text{"India"} \quad\land\quad \text{State} \in \{\text{"Karnataka"}, \text{null}\} \quad\land\quad \text{Domain} = \text{ClassificationDomain}$$

---

### Phase 5: Dual-Path Clause Analysis Engine
Every segmented clause is evaluated via an automated routing split:
1. **Deterministic Rule Engine (Path A):**
   * Clauses with quantitative statutory boundaries (e.g., employee minimum age $\ge 18$, statutory maximum notice under Section 39 of the Karnataka Shops Act, ceiling on tenancy security deposits) bypass LLM inference completely.
   * Delivers sub-millisecond execution, zero probabilistic variance, and deterministic statutory citations.
2. **Grounded LLM Reasoning Engine (Path B):**
   * Qualitative or ambiguous covenants (e.g., restraint of trade covenants under Section 27 of ICA 1872, unilateral dispute resolution seats, excessive liquidated damages) invoke multi-provider LLMs (`llama-3.3-70b-versatile` / `gemini-1.5-flash`).
   * **Strict Prompt Scaffolding:** LLMs are strictly bounded by retrieved context chunks. If the retrieval engine returns no authoritative statute or precedent, the model is compelled to emit:
     > *"Insufficient verified legal authority retrieved."*
   * Hallucinated or speculative legal reasoning is suppressed.

---

### Phase 6: Document Truth Summarization Pipeline
Running completely independently of risk analysis, the summarization engine digests the sanitized agreement into a standardized, schema-enforced JSON structure:
* **Parties:** Extracted names, operational roles (Lessor, Lessee, Employer, Employee), and addresses.
* **Term & Milestones:** Effective start date, expiration date, lock-in durations, renewal notice windows.
* **Affirmative Covenants:** Core operational deliverables, maintenance obligations, statutory compliance covenants.
* **Negative Covenants:** Restrictive covenants, confidentiality obligations, IP assignment clauses.
* **Financial Terms:** Base remuneration/rent, security deposit amounts, payment due dates, late fees.
* **Termination & Dispute Resolution:** Notice periods, cure periods, arbitration seats, designated governing law.

---

### Phase 7: Severity Matrix & Citation Verification
Risk findings are mapped onto a five-tier calibrated severity hierarchy:
* 🔴 **High Risk (`HIGH_RISK`):** Direct statutory violation (e.g., post-employment non-compete void under Section 27 of Indian Contract Act 1872; notice period violating Karnataka Shops Act Section 39).
* 🟠 **Potentially Unenforceable (`POTENTIALLY_UNENFORCEABLE`):** Onerous covenants subject to severe judicial scrutiny (e.g., punitive liquidated damages, unreasonable geographic restraints).
* 🟡 **Requires Review (`REQUIRES_REVIEW`):** Ambiguous clauses whose enforceability depends on unstated factual context (e.g., managerial vs. workman classification).
* 🔵 **Unusual / One-Sided (`ONE_SIDED`):** Legally permissible under contractual freedom, but heavily structurally asymmetric (e.g., landlord right of immediate termination vs tenant 90-day notice).
* 🟢 **No Issue Detected (`NO_ISSUE_DETECTED`):** Consistent with standard commercial practice and verified against applicable retrieved statutes.

---

### Phase 8: Safety Net, Mocking Harness & Golden Baseline Regression Suite
**Objective:** Lock down system behavior so all subsequent optimizations, segmentation algorithms, and normalizers can be proven strictly additive and non-breaking.
* **Offline Deterministic Testing Harness:** Created `ai-service/tests/conftest.py` which mocks external network boundaries (`GoogleTranslator`, Groq/Gemini API endpoints) and establishes reproducible test environments.
* **Golden Baseline Generator:** Implemented `ai-service/tests/make_baseline.py` to freeze legacy output states across 6 standard scenarios (`scenario_A`, `scenario_B`, `scenario_C`, `scenario_D`, `phase5_clauses`, `kannada_archaic`) into `tests/golden/*.json`.
* **Golden Regression Test:** Implemented `ai-service/tests/test_golden_regression.py`. Uses recursive dictionary matching with an explicit `INTENDED_CHANGES` allow-list. Guarantees that when feature flags are off (`0`), legacy output remains perfectly byte-identical.

---

### Phase 9: High-Resilience Kannada Processing, Glossary Substitution & Safe Translation
**Objective:** Eliminate silent translation loss, corrupted PyMuPDF text extractions, and destructive regex stripping of Indic scripts.
* **Dedicated Normalizer Module:** Created `ai-service/kannada_normalizer.py` providing:
  1. `apply_glossary`: Maps specialized legal Kannada terminology using a length-descending sort algorithm. Prevents short substrings from clashing with and corrupting compound legal phrases (e.g. ensuring *ಖರೀದಿ ಒಪ್ಪಂದ* is replaced before *ಒಪ್ಪಂದ*).
  2. `fix_joint_characters`: Targeted regex routine fixing split viramas and conjunct graphemes without fusing across newline boundaries.
  3. `split_for_translation`: Intelligent sentence segmenter that partitions Kannada text safely within the 1000-character Google Translate limit without breaking sentences, Kannada danda (`।`), or redaction placeholders (`[AADHAAR_REDACTED]`).
  4. `translate_with_retry`: Async translation wrapper with exponential backoff and localized chunk failure detection. Failed chunks are marked as `[UNTRANSLATED_KANNADA]` instead of being discarded.
  5. `kannada_quality_report`: Measures Indic character ratios and diagnoses legacy font corruptions (Nudi/Baraha font encoding mismatches).
* **Server-Side OCR Profile Update:** Updated `server/controllers/aiController.js` to initialize Tesseract OCR with `eng+kan` language flags and bundled local `kan.traineddata`.
* **Feature Flag:** Controlled via `KN_NORMALIZER_V2=1`.

---

### Phase 10: Context-Aware Clause Segmentation, Domain Rule Packs & Authority Gate Bypass
**Objective:** Solve clause concatenation bugs (e.g., 6 distinct covenants merged into 3) and reliably detect oppressive one-sided clauses that do not violate explicit statutes.
* **Context-Aware Scheme Hunter (`clause_segmenter.py`):**
  * Replaces rigid static regex with an adaptive algorithm that scans candidate numbering conventions:
    * Arabic dot (`1. Heading`), Arabic decimal (`1.1 Heading`), Arabic parenthesis (`(1) Heading`)
    * Alphabetical (`(a)`, `a)`), Roman numerals (`I.`, `(iv)`), Article/Clause headers (`Clause 1`, `ARTICLE II`)
    * All-caps header lines and recitals (`WHEREAS`, `NOW THEREFORE`)
  * Selects the dominant, most consistent numbering sequence per document.
* **Domain-Specific Rule Packs (`rule_packs.py`):**
  * Implements regex-based heuristic detectors for Rental, Employment, NDA, Vendor/MSA, and Criminal/Bail agreements.
  * Captures unreasonable provisions such as landlord entry without notice, unilateral rent escalation, blanket deposit forfeiture, perpetual non-solicitation, and non-mutual IP assignments.
* **Authority Gate Bypass for One-Sided Clauses:**
  * Previously, clauses without a direct statutory violation were short-circuited by the RAG authority gate as `NO_ISSUE_DETECTED`.
  * Implemented `one_sidedness_signals()` detecting compounding markers of oppression (`sole discretion`, `without notice`, `unilateral`, `final and binding`, `without recourse`).
  * If two or more markers match, the clause **bypasses the authority gate dismissal** and is routed for scrutiny.
* **Taxonomy Expansion:** Added `"Criminal / Bail, Surety & Undertaking"` to `taxonomy.json` and created knowledge base seed script `scratch/seed_criminal_kb.py`.
* **Feature Flags:** Controlled via `CLAUSE_SEGMENTER_V2=1` and `RULE_PACKS_V2=1`.

---

### Phase 11: Synthetic Multi-Severity Evaluation Framework & Corpus
**Objective:** Establish a labeled, data-driven offline evaluation harness across varying contract severities to replace small, unrepresentative manual tests.
* **Synthetic Corpus Generator (`generate_synthetic_docs.py`):**
  * Programmatically generates 28 labeled testing documents (`docs/*.txt` and `docs/*.pdf`) across 5 legal domains.
  * Injects 4 severity levels: Fair Control, Mild One-Sided, Moderate One-Sided, and Extreme Oppressive.
  * Injects multilingual variations (English and Kannada) and diverse numbering schemes.
* **Offline Evaluation Engine (`evaluate_pipeline.py`):**
  * Cycles through the corpus with mocked translation and LLM gateways.
  * Computes exact segmentation accuracy, precision, recall, F1-score, and false positive rates.
* **Synthetic Smoke Tests (`test_synthetic_smoke.py`):**
  * Asserts that balanced control agreements produce **0 false positives**.
  * Asserts that extreme agreements trigger at least one heuristic rule.
* **Empirical Benchmarks (Dev Split):**
  * **Segmentation Correctness:** Increased from **0 / 21** (legacy) to **17 / 21** (V2).
  * **Heuristic Precision:** **0.67** (with 0.00 false positive rate on fair controls).

---

### Phase 12 (RCA & Architectural Hardening): Risk Matrix Deduplication & Document Genre Awareness
**Root Cause Addressed:** Risk matrix cards for different clauses displayed duplicated section labels (e.g. *"Encumbrance & Title Warranty"* repeated 5 times), identical canned finding text, and irrelevant sale-deed statutes on non-sale documents like legal notices.
* **Whole-Word Matching:** Refactored `parse_legal_structure` in `ai-service/main.py`. Replaced raw substring search with whole-word regex (`\brent\b`, not matching `current`).
* **Document Genre Detection:** Added `_looks_like_legal_notice`. Detects legal notices and classifies paragraphs by rhetorical function (*Denial of Allegations*, *Demand / Call to Perform*, *Consequences & Reservation of Rights*, *Factual Background*) rather than forcing contract taxonomy.
* **Prompt Refactoring in `clause_analyzer.py`:** Removed rigid sentence templates; prompts now enforce unique, clause-specific findings grounded in concrete amounts, dates, and names.
* **Token-Jaccard Finding Deduplication (`deduplicate_findings`):**
  * Computes Jaccard similarity across clause finding and reasoning text:
    $$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$
  * If similarity $\ge 0.55$ between compliant clauses, the later finding is rewritten using the clause's verbatim excerpt.
  * Attaches explainable audit metadata: `dedupeNote` and `similarToClause`. Flagged risk clauses are never altered.
* **Cache Versioning:** Bumped cache key to `v3.0_clause_specific_nodup` in `cache_service.py` to invalidate legacy boilerplate entries.

---

### Phase 13 (RCA & Processing Hardening): Mixed PDF Per-Page Analysis & Substantial Image OCR Aggregation
**Root Cause Addressed:** Uploading scanned or hybrid PDFs containing images failed with generic 500 errors, displayed as 0.00 MB, or ignored body pages when the first page had text.
* **Per-Page Analysis in `main.py` (`process_pdf`):**
  * Evaluates each PDF page individually rather than using a single document-wide character threshold.
  * If a page contains $< 150$ characters of text and carries substantial images ($> 15\%$ page surface area via `has_substantial_images`), it is flagged as an OCR candidate page.
* **High-DPI Rendering:** OCR candidate pages are rendered at **200 DPI** (up to 20 pages) for Tesseract OCR extraction.
* **Page-Level Text Merging:** Node.js `server/controllers/aiController.js` merges OCR text per page with PyMuPDF native digital text, preserving clean text where available.
* **Transparent Error Logging:** Python traceback and error details are returned through the Node.js gateway instead of being masked by generic 500 error strings.
* **Empty File Guard:** Files $< 100$ bytes are rejected immediately with clear guidance to prevent corrupted or un-downloaded cloud placeholder files from crashing the pipeline.

---

## 5. Complete Database Schema Specifications

### 5.1 Collection: `OriginalDocuments` (S3 File Tracking)
```typescript
interface IOriginalDocument {
  _id: mongoose.Types.ObjectId;
  documentId: string;           // UUID v4 bundle identifier linking multi-page uploads
  fileName: string;             // Original client file name
  s3Key: string;                // Secure S3 object key (e.g. "uploads/UUID-filename.pdf")
  s3Bucket: string;             // AWS S3 bucket name
  mimeType: string;             // MIME type (application/pdf, image/png, image/jpeg)
  fileSize: number;             // File size in bytes
  sequenceIndex: number;        // Zero-based page sequence index for image stitching
  uploadTimestamp: Date;        // Timestamp of upload
  userId: string;               // Firebase UID of document owner
}
```

### 5.2 Collection: `DocumentSummaries` (Processed Analysis Ledger)
```typescript
interface IDocumentSummary {
  _id: mongoose.Types.ObjectId;
  originalDocumentId: string;   // Foreign key -> OriginalDocuments.documentId
  originalDocuments: mongoose.Types.ObjectId[]; // Page references
  userId: string;               // Firebase UID of owner
  documentHash: string;         // SHA-256 hash of raw OCR text for deduplication
  pipelineStatus: 'INGESTED' | 'PREPROCESSED' | 'SEGMENTED' | 'ANALYZED' | 'FAILED';
  
  metadata: {
    fileName: string;
    mimeType: string;
    detectedLanguage: 'en' | 'kn' | 'mixed';
    pageCount: number;
    wordCount: number;
  };
  
  classification: {
    domain: string;             // e.g. "Rental / Lease Agreement", "Legal Notice"
    confidence: number;         // 0.0 - 1.0
    method: 'Deterministic' | 'Heuristic-Density' | 'Zero-Shot' | 'Hybrid-Taxonomy';
    detectedLanguage: 'en' | 'kn' | 'mixed';
  };
  
  textContent: {
    rawOcrText: string;
    sanitizedRegionalText?: string;
    translatedEnglishText: string;
    redactedEnglishText: string;
    redactedPiiEntities: Array<{
      entityType: 'AADHAAR' | 'PAN' | 'PHONE' | 'EMAIL' | 'NAME' | 'ADDRESS';
      maskedValue: string;
      startIndex: number;
      endIndex: number;
    }>;
  };
  
  structure: {
    preamble: string;
    parties: Array<{
      name: string;
      role: string;
      address?: string;
    }>;
    clauses: Array<{
      clauseIndex: number;
      clauseHeader: string;
      rawText: string;
      sanitizedText: string;
      detectedType: string;
      jurisdiction: {
        country: string;
        state: string | null;
        governingLawClausePresent: boolean;
      };
    }>;
  };
  
  summaryOutput?: {
    executiveSummary: string;
    rights: string[];
    obligations: string[];
    financialTerms: Array<{
      description: string;
      amount?: string;
      deadline?: string;
    }>;
    terminationConditions: string[];
    deadlinesAndMilestones: string[];
    governingLaw: string;
  };
  
  riskAnalysis?: Array<{
    clauseIndex: number;
    clauseType: string;
    riskLevel: 'HIGH_RISK' | 'POTENTIALLY_UNENFORCEABLE' | 'REQUIRES_REVIEW' | 'ONE_SIDED' | 'NO_ISSUE_DETECTED';
    finding: string;
    statutoryConflict?: {
      actName: string;
      section: string;
      ruleNumber?: string;
      precedentCitation?: string;
      authorityLevel: 'STATUTE' | 'STATE_RULE' | 'NOTIFICATION' | 'HIGH_COURT' | 'SUPREME_COURT' | 'N/A' | 'NONE';
    };
    deterministicRuleTriggered: boolean;
    reasoning: string;
    confidenceScore: number;
    humanReviewRequired: boolean;
    dedupeNote?: string;        // Explainability record if near-duplicate rewrite occurred
    similarToClause?: number;   // Clause index of matching earlier compliant clause
  }>;
  
  translationQuality?: {
    kannadaRatio: number;
    hasGarbledFont: boolean;
    fallbackChunksCount: number;
  };
  
  createdAt: Date;              // Configured with TTL Index: 2,592,000s (30 days)
  updatedAt: Date;
}
```

---

## 6. Complete API Gateway & Service Endpoints Reference

### 6.1 Express.js Gateway (`server`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/documents/upload` | Optional | Multer in-memory upload (up to 10 files, 15 MB cap) to S3 with SHA-256 hash. |
| `GET` | `/api/documents/:documentId/view` | Public | Generates temporary 900-second pre-signed S3 viewing URLs for document pages. |
| `POST` | `/api/ai/extract` | Required | Main processing entry point. Accepts PDF or up to 5 images. Orchestrates OCR, Python analysis, and MongoDB persistence. |
| `GET` | `/api/ai/documents` | Required | Retrieves paginated historical document summaries for authenticated user. |
| `GET` | `/api/ai/documents/latest` | Required | Fetches the most recently processed `DocumentSummary` for current user. |
| `GET` | `/api/ai/documents/:documentId` | Required | Retrieves full structured summary and risk analysis by document ID. |
| `DELETE`| `/api/ai/documents/:documentId` | Required | Deletes `DocumentSummary` and associated S3 objects. |
| `POST` | `/api/ai/reprocess/:documentId` | Required | Triggers re-analysis of an existing document without re-uploading bytes. |
| `POST` | `/api/ai/chat/:documentId` | Required | Document-grounded Q&A. Answers user legal queries with citations based on document context. |
| `POST` | `/api/rag/seed` | Required | Administrative endpoint to seed statutory chunks into ChromaDB. |
| `POST` | `/api/rag/retrieve` | Required | Queries hybrid RAG index with metadata filters. |

### 6.2 Python FastAPI Engine (`ai-service`)

| Method | Endpoint | Request Payload | Response Model | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/process-document` | `{ text: str, source_language: str }` | `DocumentResponse` | Full pipeline execution over raw string text. |
| `POST` | `/process-pdf` | `UploadFile (multipart/form-data)` | `DocumentResponse` | Native-first PyMuPDF extraction with 422 OCR fallback triggers. |
| `POST` | `/anonymize` | `{ text: str }` | `{ anonymized_text: str, pii_entities: list }` | Presidio + Regex PII masking pass. |
| `POST` | `/classify` | `{ text: str }` | `{ domain: str, confidence: float, method: str }` | 3-tier document classifier. |
| `POST` | `/segment-clauses`| `{ text: str }` | `{ clauses: list }` | Adaptive numbering scheme clause segmenter. |
| `POST` | `/rag/retrieve` | `{ query: str, state: str, domain: str, limit: int }`| `{ results: list }` | Hybrid BM25 + Dense ChromaDB retrieval. |
| `POST` | `/summarize` | `{ text: str, structure: dict }` | `SummaryOutput` | 7-entity document truth summarization. |
| `POST` | `/chat` | `{ query: str, document_text: str, context: dict }` | `{ answer: str, citations: list }` | Document-bounded Q&A generation. |

---

## 7. Feature Flags & Operational Configuration

All architectural upgrades implemented from Phase 8 onwards are protected by environmental feature flags to guarantee seamless rollbacks and zero disruption to legacy behavior:

| Feature Flag | Default | Active Value (`1`) Behavior | Fallback (`0`) Behavior |
| :--- | :---: | :--- | :--- |
| `KN_NORMALIZER_V2` | `1` | Executes `kannada_normalizer.py`: longest-first legal glossary, safe chunk translation, and virama repairs. | Legacy character-by-character regex substitution and standard Google Translate calls. |
| `CLAUSE_SEGMENTER_V2` | `1` | Context-aware scheme hunter (`clause_segmenter.py`) dynamically detecting dominant numbering formats. | Static regex segmentation splitting on `\n\s*(\d+)[\.\)]`. |
| `RULE_PACKS_V2` | `1` | Domain rule packs (`rule_packs.py`), authority-gate bypass for oppressive phrasing (`one_sidedness_signals`). | Standard deterministic rule assertions without domain packs or authority gate bypass. |

---

## 8. Verification Benchmarks & Empirical Performance Metrics

### 8.1 Synthetic Corpus Evaluation (Dev Split, LLM Gateway Mocked)

| Metric | Legacy Baseline (Flags = `0`) | Full V2 Platform (Flags = `1`) | Absolute Improvement |
| :--- | :---: | :---: | :---: |
| **Clause Segmentation Correctness** | 0 / 21 (0.0%) | **17 / 21 (81.0%)** | $+81.0\%$ |
| **Heldout Segmentation Correctness** | 0 / 7 (0.0%) | **6 / 7 (85.7%)** | $+85.7\%$ |
| **Heuristic Precision** | 0.00 | **0.67** | $+0.67$ |
| **Heuristic Recall (Offline Heuristic Only)** | 0.00 | **0.12** | $+0.12$ |
| **False Positive Rate on Fair Controls** | 0 / 5 (0.0%) | **0 / 5 (0.0%)** | Zero False Alarms |

> [!NOTE]
> Offline heuristic recall sits at 12% because offline unit tests intentionally isolate deterministic regexes and mock generative LLM calls to avoid API quota usage. In production, qualitative clauses that pass heuristic triggers are routed to the retrieval-grounded LLM reasoning layer.

### 8.2 End-to-End System Reliability Index
As verified via `COMPREHENSIVE_VERIFICATION_REPORT.md` across all foundational subsystems:
* **Relational Schema Linkage:** $100\%$ ($1/1$ `DocumentSummary` correctly linked to original document pages).
* **DPDP Automated TTL Retention:** $100\%$ (Active on `createdAt` timestamp with 30-day index).
* **PII Redaction Recall:** $100\%$ on standard Indian identifiers (Aadhaar, PAN, Phone, Email).
* **Archaic Kannada Unicode Modernization:** $100\%$ precision on historical letterforms (`ಱ` $\rightarrow$ `ರ`, `ೞ` $\rightarrow$ `ಳ`).
* **Hybrid RAG Retrieval Precision:** $100\%$ accuracy across 16 seeded statutory chunks over 5 legal domains.
* **Deterministic Clause Routing:** $100\%$ accuracy across quantitative statutory benchmarks.

---

## 9. Security, Compliance & Deployment Guidelines

1. **Digital Personal Data Protection (DPDP) Act Compliance:**
   * Raw OCR text and parsed documents must remain ephemeral. The automated 30-day MongoDB TTL index (`expires: 2592000`) must be verified on database startup.
   * Direct S3 public access is strictly prohibited; all file view operations must utilize IAM-signed pre-signed URLs expiring in $\le 900$ seconds.
2. **Third-Party API Data Leakage Safeguards:**
   * Raw Aadhaar and PAN numbers are redacted **before** text is sent to Google Translate or LLM inference APIs.
   * Presidio Legal-NER redaction ensures personal names and residential addresses are scrubbed or masked in transit.
3. **Environment Credentials & Production Hygiene:**
   * Service accounts (`server/config/firebase-service-account.json`) must never be checked into version control. Ensure it is listed in `.gitignore`.
   * Vector database binaries (`ai-service/chroma_db/`) should be excluded from version tracking and mounted via persistent container volumes in production.
   * Tesseract language packs (`eng.traineddata`, `kan.traineddata`) must reside in standard paths accessible to the Node.js runtime worker pool.

