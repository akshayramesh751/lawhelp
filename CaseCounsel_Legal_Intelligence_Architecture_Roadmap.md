# CaseCounsel — Technical Specification & Comprehensive Architecture Roadmap
**System Blueprint & Implementation Guide for Legal Intelligence & Multi-Tier Processing Pipeline**

---

## 1. Executive Summary & Core Architectural Paradigm

### 1.1 Project Objective
**CaseCounsel** is an enterprise-grade legal document intelligence system designed to process, extract, categorize, summarize, and evaluate complex legal agreements (such as employment contracts, residential/commercial leases, non-disclosure agreements, and service-level agreements).

### 1.2 The Fundamental Conceptual Shift: Decoupling Document Truth from Legal Truth
A critical design pitfall in AI legal engineering is the naive approach: passing an entire raw contract and vector chunks of all national laws into a generic Large Language Model (LLM) context window with the open-ended instruction *"Is this document legal?"*

This naive approach inherently fails due to:
* **Hallucinatory Legal Inferences:** LLMs generate plausible-sounding statutory citations and interpret jurisdictions ambiguously.
* **Token Budget Dilution:** High-signal legal provisions get lost in dense boilerplate text.
* **Lack of Grounded Determinism:** Direct numerical/statutory violations (e.g., minimum notice durations or statutory wage ceilings) become subject to probabilistic variance.
* **Context Bleed:** The internal obligations of the document become entangled with external statutory mandates.

To build an auditable, legally sound system, CaseCounsel strictly bifurcates its pipeline into two distinct knowledge planes:

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
                                 | - Parties & Term                  | - Central/State Statutes
                                 | - Affirmative Obligations         | - Binding High Court/SC Precedents
                                 | - Financial Covenants             | - Dynamic Rules & Regulations
                                 | - Termination Triggers            | - Domain-Specific Statutory Limits
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
                                 +-----------------------------------+
```

---

## 2. Complete End-to-End System Workflow Diagram

```
                        +---------------------------------------+
                        |  User Upload (PDF / Image / DOCX)     |
                        +---------------------------------------+
                                           |
                                           v
                        +---------------------------------------+
                        | [Task 1] S3 Archival, Metadata & Hash |
                        | (KMS SSE, SHA-256, Audit Ledger)      |
                        +---------------------------------------+
                                           |
                                           v
                        +---------------------------------------+
                        | OCR Engine + Kannada Language Detect  |
                        | (Tesseract / EasyOCR / PyMuPDF)       |
                        +---------------------------------------+
                                           |
                    +----------------------+----------------------+
                    | (Kannada Detected)                          | (English / Standard)
                    v                                             v
        +-----------------------+                                 |
        | Unicode Normalization |                                 |
        | + Legal Translation   |                                 |
        +-----------------------+                                 |
                    |                                             |
                    +----------------------+----------------------+
                                           |
                                           v
                        +---------------------------------------+
                        | PII Masking & Redaction Layer         |
                        | (Aadhaar, PAN, Phone, Email, Address) |
                        +---------------------------------------+
                                           |
                                           v
                        +---------------------------------------+
                        | [Task 2] MongoDB DocumentSummaries    |
                        | (Persistence & Multi-Stage State)     |
                        +---------------------------------------+
                                           |
                                           v
                        +---------------------------------------+
                        | Layout & Semantic Clause Segmentation |
                        | (Boundary-Aware Legal Parser)         |
                        +---------------------------------------+
                                           |
            +------------------------------+------------------------------+
            |                                                             |
            v                                                             v
========================================      ========================================
TRACK A: DOCUMENT TRUTH (Understanding)       TRACK B: LEGAL TRUTH (Risk Intelligence)
========================================      ========================================
            |                                                             |
            v                                                             v
+--------------------------------------+      +--------------------------------------+
| Entity & Covenant Extraction Engine  |      | [Task 3] 3-Tier Classification Engine|
| (Parties, Dates, Rights, Liabilities)|      | (Regex -> Keywords -> Zero-Shot ML)  |
+--------------------------------------+      +--------------------------------------+
            |                                                             |
            v                                                             v
+--------------------------------------+      +--------------------------------------+
| Schema-Enforced JSON Summary         |      | Clause Taxonomy & Jurisdiction Tag   |
| (Affirmative/Negative Covenants,     |      | (e.g. Non-Compete / India-Karnataka) |
| Deadlines, Financial Clauses)        |      +--------------------------------------+
+--------------------------------------+                                  |
            |                                                             v
            |                                 +--------------------------------------+
            |                                 | Metadata Filter (Domain, State, Year)|
            |                                 +--------------------------------------+
            |                                                             |
            |                                                             v
            |                                 +--------------------------------------+
            |                                 | External Legal Knowledge Base        |
            |                                 | (Statutes, State Rules, Precedents)  |
            |                                 +--------------------------------------+
            |                                                             |
            |                                                             v
            |                                 +--------------------------------------+
            |                                 | Hybrid Retrieval: BM25 + Dense Vector|
            |                                 | + Cross-Encoder Re-Ranking           |
            |                                 +--------------------------------------+
            |                                                             |
            |                                                             v
            |                                 +--------------------------------------+
            |                                 | Quantitative / Statutory Boundary?   |
            |                                 +--------------------------------------+
            |                                          |                     |
            |                         (Yes, Fixed Limit)                     (No, Ambiguous Language)
            |                                          v                     v
            |                         +-----------------------+   +-----------------------+
            |                         | Deterministic Rule    |   | Grounded LLM Reasoning|
            |                         | Engine (No LLM Call)  |   | (Strict Source Bound) |
            |                         +-----------------------+   +-----------------------+
            |                                          |                     |
            |                                          +----------+----------+
            |                                                     |
            |                                                     v
            |                                 +--------------------------------------+
            |                                 | Source Citation & Audit Verification |
            |                                 | (Fallback if No Authority Retrieved) |
            |                                 +--------------------------------------+
            |                                                     |
            |                                                     v
            |                                 +--------------------------------------+
            |                                 | Severity Matrix Scoring:             |
            |                                 | 🔴 High Risk | 🟠 Unenforceable     |
            |                                 | 🟡 Review    | 🔵 One-Sided          |
            |                                 | 🟢 No Issue Detected                 |
            |                                 +--------------------------------------+
            |                                                             |
            +------------------------------+------------------------------+
                                           |
                                           v
                        +---------------------------------------+
                        | CaseCounsel Interactive Dashboard     |
                        | (Side-by-Side Summary + Risk Matrix)  |
                        +---------------------------------------+
```

---

## 3. Detailed Phase-by-Phase Technical Specifications

### Phase 1: Ingestion, Multi-Image Bundling, Storage & Compliance (Task 1 Context)
* **Storage Ingestion Pipeline:** Accepts PDF, DOCX, and raw multi-image streams (PNG/JPEG/TIFF).
* **Multi-Page Image Bundling:** Generates an aggregate `bundleId` preserving sequence indices before storage.
* **Security & KMS:** Direct uploads to private AWS S3 buckets using AES-256 Server-Side KMS encryption with strict TLS 1.3 endpoints.
* **Integrity Ledger:** Computes SHA-256 checksums per file block to guarantee non-repudiation.
* **Ephemeral Access:** Direct S3 links are forbidden; reads are mediated strictly via IAM-governed pre-signed URLs expiring within 900 seconds.
* **Data Retention Policy:** In accordance with India's Digital Personal Data Protection (DPDP) Act, raw unmasked files are scheduled for automatic Glacier archival or purging after 30 days.

---

### Phase 2: Persistence Pipeline, Multilingual Preprocessing & PII Masking (Task 2 Execution)
* **MongoDB Schema Realization:** Implements the `DocumentSummaries` collection linking foreign-key references to original S3 tracking records.
* **Unicode Resiliency & Preprocessing:**
  * Implements regex and Unicode normalization routines to resolve broken conjuncts, half-forms, and glyph misalignments common in regional OCR.
  * Sanitizes archaic Kannada legal terms and preambles (e.g., *ಖರೀದಿ ಒಪ್ಪಂದ*, *ಬಾಡಿಗೆ ಕರಾರು*, *ಕರಾರುಪತ್ರ*) prior to translation.
* **High-Fidelity Neural Translation:** Routes cleaned regional text through a fine-tuned translation microservice yielding standard legal English without dropping legal connotations.
* **PII Detection & Redaction:**
  * Uses regex heuristics and Named Entity Recognition (NER) to detect and redact sensitive Indian identifiers:
    * Aadhaar Numbers: `\b[2-9]{1}[0-9]{3}\s[0-9]{4}\s[0-9]{4}\b`
    * Permanent Account Numbers (PAN): `\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b`
    * Phone Numbers, Personal Emails, Bank Account Numbers, and Residential Addresses.
* **Context-Aware Semantic Chunking:** Replaces fixed-token sliding windows with legal boundary parsing (identifying Title, Recitals, Definitions, Operative Clauses, Schedules, and Signatures).

#### Database Schema Contract: `DocumentSummaries`
```typescript
interface IDocumentSummary {
  _id: string; // ObjectId
  originalDocumentId: string; // Foreign Key -> OriginalDocuments._id
  userId: string;
  documentHash: string; // SHA-256
  pipelineStatus: 'INGESTED' | 'PREPROCESSED' | 'SEGMENTED' | 'ANALYZED' | 'FAILED';
  metadata: {
    fileName: string;
    mimeType: string;
    detectedLanguage: 'en' | 'kn' | 'mixed';
    pageCount: number;
    wordCount: number;
    createdAt: Date;
    updatedAt: Date;
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
    parties: Array<{ name: string; role: string; address?: string }>;
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
    financialTerms: Array<{ description: string; amount?: string; deadline?: string }>;
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
      authorityLevel: 'STATUTE' | 'STATE_RULE' | 'NOTIFICATION' | 'HIGH_COURT' | 'SUPREME_COURT';
    };
    deterministicRuleTriggered: boolean;
    reasoning: string;
    confidenceScore: number;
    humanReviewRequired: boolean;
  }>;
}
```

---

### Phase 3: Cognitive Fallback & Deep Classification Engine (Task 3 Execution)
* **3-Tier Hierarchical Document Classifier:**
  1. **Tier 1 (Deterministic / Exact Match):** Scans document headers, preamble patterns, and statutory references using regex templates (e.g., *"Employment Agreement"*, *"Residential Lease Agreement"*, *"Non-Disclosure Agreement"*).
  2. **Tier 2 (Heuristic Keyword Density):** Evaluates term-frequency sliding windows across legal tokens (e.g., `indemnification`, `severance`, `liquidated damages`, `lessor`, `lessee`, `intellectual property assignment`).
  3. **Tier 3 (Zero-Shot Cognitive Fallback):** If Tier 1 and Tier 2 confidence scores register $< 75\%$, routes the extracted preamble and operative clauses to a Zero-Shot classification model configured with target legal taxonomy labels.
* **Uncategorized Document Handling:** Documents failing all three tiers ($< 60\%$ confidence) are flagged as `Uncategorized Legal Document` and scheduled for an asynchronous audit queue.

---

### Phase 4: Legal Knowledge Architecture & Hybrid RAG Layer
* **Separation of Legal Indexes:** Rather than storing legal data in a generic monolithic vector store, the knowledge base is divided into isolated, structured collections:
  * `statutes_index` (Central Acts like Indian Contract Act 1872, Industrial Disputes Act 1947, Code on Wages 2019)
  * `state_laws_index` (State Acts like Karnataka Shops and Commercial Establishments Act 1961)
  * `rules_regulations_index` (Karnataka Standing Orders, State Labour Rules)
  * `case_law_index` (High Court & Supreme Court ratio decidendi summaries)
* **Structural Legal Chunking:** Legal provisions are never chunked by blind token counts. Chunks strictly preserve structural units:
  $$	ext{Act} \longrightarrow 	ext{Chapter} \longrightarrow 	ext{Section} \longrightarrow 	ext{Subsection} \longrightarrow 	ext{Explanation}$$
* **Hybrid Retrieval Mechanics:**
  * **Sparse Retrieval (BM25):** Queries exact Section numbers, Act titles, case names, and specialized legal terminology.
  * **Dense Semantic Retrieval:** Queries vector embeddings of the clause intent.
  * **Metadata Filtering:** Prior to vector evaluation, filters candidate space strictly by:
    $$	ext{Country} = 	ext{"India"} \quad\land\quad 	ext{State} \in \{	ext{"Karnataka"}, 	ext{null}\} \quad\land\quad 	ext{Domain} = 	ext{"Employment"}$$
  * **Cross-Encoder Re-Ranking:** Scores the combined top 20 candidate passages to output the top 3–5 most authoritative legal references.
* **Hierarchy of Legal Authority:**
  $$	ext{Constitution} > 	ext{Statute (Central/State)} > 	ext{Statutory Rules} > 	ext{Notifications} > 	ext{SC Precedent} > 	ext{HC Precedent} > 	ext{Commentary}$$

---

### Phase 5: Dual-Path Clause Analysis (Deterministic Rules + Grounded LLM)
Every segmented clause is processed through an automated routing split:

```
                                  +---------------------------------------+
                                  |            ISOLATED CLAUSE            |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |        TAXONOMY CLASSIFICATION        |
                                  +---------------------------------------+
                                                      |
                                                      v
                         +---------------------------------------------------------+
                         |       Is this governed by a deterministic rule?         |
                         +---------------------------------------------------------+
                                         /                         \
                                        /                           \
                                      YES                            NO
                                      /                               \
                                     v                                 v
        +-----------------------------------------+       +-----------------------------------------+
        |         DETERMINISTIC RULE ENGINE       |       |        GROUNDED LLM REASONING           |
        | - Minimum Age Verification              |       | - Restraint of Trade (Section 27 ICA)   |
        | - Maximum Notice Period Caps            |       | - Reasonable Liquidated Damages         |
        | - Statutory Gratuity Minimums           |       | - Non-Solicitation Enforceability       |
        | - Maternity Benefit Duration            |       | - Unilateral Dispute Resolution         |
        +-----------------------------------------+       +-----------------------------------------+
                                     \                                 /
                                      \                               /
                                       v                             v
                                  +---------------------------------------+
                                  |        STRICT CITATION AUDIT          |
                                  +---------------------------------------+
                                                      |
                                                      v
                                  +---------------------------------------+
                                  |          FINAL RISK DECISION          |
                                  +---------------------------------------+
```

#### Grounding Constraints for LLM Reasoning
When an LLM call is executed for qualitative clauses, the system prompt strictly enforces:
1. Grounding in provided retrieved context only. Zero external assertions.
2. Inability to verify citations triggers automatic fallback: *"Insufficient verified legal authority retrieved."*
3. All conclusions must output direct statutory or precedent citations.

---

### Phase 6: Document Truth Summarization Pipeline
Independent of the risk analysis track, the summarization engine digests the raw document into structured JSON entities:
* **Parties:** Full names, registered entities, operational roles.
* **Term & Milestones:** Effective date, lock-in duration, renewal triggers, delivery milestones.
* **Affirmative Covenants:** Core deliverables, compliance mandates, reporting obligations.
* **Negative Covenants:** Confidentiality, IP assignments, restrictive covenants.
* **Financial Terms:** Base compensation, security deposits, payment schedules, late penalties.
* **Termination & Dispute Resolution:** Notice requirements, cure periods, arbitration seats, jurisdiction.

---

### Phase 7: Severity Matrix, Citation Verification & Explainability
Findings are categorized across five calibrated tiers:
* 🔴 **High Risk:** Direct statutory violation (e.g., post-employment non-compete under Indian Contract Act § 27; notice period under Karnataka Shops Act § 39).
* 🟠 **Potentially Unenforceable:** Restrictive or penalty clauses subject to heavy judicial scrutiny (e.g., excessive liquidated damages).
* 🟡 **Requires Review:** Legal validity contingent on undisclosed factual factors (e.g., managerial vs. workman classification).
* 🔵 **Unusual / One-Sided:** Legally enforceable but structurally disadvantageous (e.g., unilateral immediate employer termination vs. 90-day employee notice).
* 🟢 **No Immediate Issue Detected:** Consistent with standard practice and applicable retrieved authorities.

---

## 4. Domain Rollout Progression & Staging Plan

```
+---------------------------------------------------------------------------------------------------+
| STAGE 1: Pilot Vertical — Karnataka & Central Employment Agreements                               |
| - Ingest: Karnataka Shops and Commercial Establishments Act 1961, Industrial Disputes Act 1947,    |
|   Payment of Gratuity Act 1972, Indian Contract Act 1872 (§ 27).                                  |
| - Validate: Notice periods, probation limits, non-competes, IP assignment, dispute seats.        |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 2: Residential & Commercial Lease Agreements                                                |
| - Ingest: Karnataka Rent Control Act, Transfer of Property Act 1882, Model Tenancy Act.           |
| - Validate: Security deposit caps, eviction notices, lock-in penalties, maintenance duties.       |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 3: Non-Disclosure & Intellectual Property Agreements                                        |
| - Ingest: Trade Secrets Jurisprudence, Indian Copyright Act 1957, Patents Act 1970.               |
| - Validate: Perpetual confidentiality scopes, non-circumvention terms, IP carveouts.              |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| STAGE 4: Enterprise SaaS & Master Service Agreements (MSAs)                                       |
| - Ingest: Information Technology Act 2000, DPDP Act 2023, Specific Relief Act 1963.               |
| - Validate: Limitation of liability, SLA indemnities, data localization, governing law.          |
+---------------------------------------------------------------------------------------------------+
```

---

## 5. Architectural Quality Attributes & Non-Functional Requirements

| Metric / Dimension | Target Specification | Enforcement Mechanism |
| :--- | :--- | :--- |
| **Citation Precision** | $100\%$ verifiable against retrieved context | Automated cross-reference validation; suppression of ungrounded output. |
| **PII Redaction Recall** | $\ge 99.5\%$ on Indian identifiers | Multi-pattern regex + Legal-NER transformer pass. |
| **OCR Text Fidelity** | $\ge 98.0\%$ character accuracy | Unicode sanitization layer for regional scripts. |
| **Retrieval Latency** | $< 450	ext{ ms}$ (P95) | Metadata pre-filtering + quantized dense embeddings + BM25 caching. |
| **End-to-End Analysis** | $< 12.0	ext{ s}$ per 10-page document | Parallelized asynchronous clause pipeline via worker pools. |
| **Compliance** | ISO 27001 & India DPDP Act 2023 | S3 KMS encryption, ephemeral pre-signed URLs, 30-day automated purge. |
