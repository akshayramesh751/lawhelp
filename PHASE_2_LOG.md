# Phase 2 Implementation Log — Persistence, Unicode Modernization & Legal Segment Parsing

This log documents all files modified, new models introduced, features added, and instructions to execute verification tests for Phase 2.

---

## 📂 Summary of Changes

### 1. Database Schema
* **File Introduced**: [`server/models/DocumentSummary.js`](file:///e:/lawhelp/server/models/DocumentSummary.js)
  * **Relational Schema**: Holds raw OCR, translated, and redacted text; redacted PII offsets list; structured sections (`preamble`, `parties`, `clauses`); and summary output blocks.
  * **DPDP Compliance**: Configured a `30-day TTL index` on the `createdAt` field for auto-deletion of temporary assets.

### 2. S3 Integration Update
* **File Modified**: [`server/utils/s3.js`](file:///e:/lawhelp/server/utils/s3.js)
  * Implemented `downloadFromS3(s3Key)` supporting both AWS and local fallback disk retrieval.

### 3. Model Ownership Constraints
* **File Modified**: [`server/models/OriginalDocument.js`](file:///e:/lawhelp/server/models/OriginalDocument.js)
  * Introduced the `userId` field to bind raw uploads directly to their Firebase UID owner.

### 4. Node Ingestion Controller & Route Protections
* **File Modified**: [`server/controllers/aiController.js`](file:///e:/lawhelp/server/controllers/aiController.js)
  * Protected file registry inputs by storing uploads linked to the Firebase `req.user.uid`.
  * Computes standard `SHA-256 hashes` on OCR text for data integrity.
  * Persists processed AI payloads directly into `DocumentSummary` collections.
* **File Modified**: [`server/routes/aiRoutes.js`](file:///e:/lawhelp/server/routes/aiRoutes.js)
  * Protects AI routes using the Firebase token verification middleware.
  * Registered:
    * `POST /api/ai/extract` (Ingestion)
    * `GET /api/ai/summary/:documentId` (Status/Summary Fetch)
    * `POST /api/ai/reprocess/:documentId` (Retry Pipeline)
* **File Modified**: [`server/middleware/auth.js`](file:///e:/lawhelp/server/middleware/auth.js)
  * Integrated a secure developer test-mode token override (`test-token-uid-123`) active under `process.env.NODE_ENV === 'test'` for programmatic verification.

### 5. Multilingual Python microservice
* **File Modified**: [`ai-service/main.py`](file:///e:/lawhelp/ai-service/main.py)
  * **Unicode Correction**: Automatically merges space characters separating base consonants and vattus/viramas. Modernizes archaic Kannada scripts (`ಱ` $\rightarrow$ `ರ`, `ೞ` $\rightarrow$ `ಳ`).
  * **Translate Auto-Bypass**: Detects character sets. English-only uploads completely skip Google Translate to prevent rate limiting and optimize latency.
  * **Offset Registry**: Compiles exact character location mappings for redacted PII arrays.
  * **Legal Parser**: Extract structural preamble, parties list, and numbered clauses.

---

## 🧪 Verification Commands

You can run these scripts directly from your workspace directory to verify all features:

### 1. Test Pipeline Normalization & Translate Auto-Bypass
Ensure the Python microservice is online (`uvicorn main:app --port 8000`), then run:
```bash
node scratch/test_pipeline_features.js
```
* **Verify**: The output console log checks that archaic characters become modernized and English texts skip translation entirely.

### 2. Test Ingestion Persistence & Relational Linkage
Start this command from the root workspace directory:
```bash
node scratch/test_mongo_relations.js
```
* **Verify**: Confirms that sending an authenticated request updates `OriginalDocument` and generates an exact relational `DocumentSummary` database entry.

### 3. Test Authentication Protections & Reprocessing Recovery
Execute this script to test route security blocks and pipeline retries:
```bash
node scratch/test_auth_summary.js
```
* **Verify**: Confirms that missing or bad authorization tokens throw `401 Unauthorized`, and that reprocessing downloads files back from S3 to regenerate failed documents.
