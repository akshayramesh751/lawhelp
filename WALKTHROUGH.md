# NyayaConnect: Durable File Registry & S3 Integration Walkthrough

This document logs all architectural changes, additions, and validation steps performed to implement the secure, durable file intake registry for NyayaConnect.

---

## 📅 Log of Changes

### 1. Dependency Updates
* **Package**: [server/package.json](file:///e:/lawhelp/server/package.json)
* **Changes**: Installed the official `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` packages (v3).
* **Command run**: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

### 2. Database Layer
* **File**: [server/models/OriginalDocument.js](file:///e:/lawhelp/server/models/OriginalDocument.js) [NEW]
* **Logic**: 
  * Implemented a Mongoose schema representing the raw document/image metadata.
  * Added grouping via `documentId` (UUID) to handle multi-file bundles (multi-image aggregation).
  * Added `sequenceIndex` to ensure pages preserve their ordering sequence (0, 1, 2...).
  * Added a MongoDB **TTL Index** (`expires: 2592000`) on the `createdAt` field to automatically purge metadata after 30 days in compliance with privacy regulations (India's DPDP Act).

### 3. S3 Integration Utilities
* **File**: [server/utils/s3.js](file:///e:/lawhelp/server/utils/s3.js) [NEW]
* **Logic**:
  * Initializes the AWS `S3Client` when S3 credentials exist in the environment.
  * **AWS S3 Mode**: Uploads files to S3 with AES-256 server-side encryption (`SSE-S3`) and generates secure temporary HTTPS presigned URLs with 15-minute expiration.
  * **Local Fallback Mode**: Gracefully active if AWS variables are missing in `.env`. Saves files locally to `server/uploads/` and serves files through a local API endpoint, allowing offline development.

### 4. Controller & Routes
* **File**: [server/controllers/documentController.js](file:///e:/lawhelp/server/controllers/documentController.js) [NEW]
* **Logic**: Handles requests for uploading document arrays, generating presigned links, and serving local files in fallback mode.
* **File**: [server/routes/documentRoutes.js](file:///e:/lawhelp/server/routes/documentRoutes.js) [NEW]
* **Logic**: Mounts endpoints for uploading (`/upload` via `multer` memory storage), viewing (`/:documentId/view`), and local fallback reading (`/local-view/:filename`).
* **File**: [server/index.js](file:///e:/lawhelp/server/index.js) [MODIFY]
* **Logic**: Registered and mounted the new `/api/documents` routes.

### 5. Ingestion Pipeline Integration
* **File**: [server/controllers/aiController.js](file:///e:/lawhelp/server/controllers/aiController.js) [MODIFY]
* **Logic**: Integrated the durable file registry directly into the `/api/ai/extract` pipeline. Now, files uploaded for AI analysis are uploaded to S3/local and recorded in MongoDB *first* before running OCR or calling the Python service. The server returns the durable `documentId` alongside the AI classification.

### 6. Frontend Ingestion Display
* **File**: [project/src/pages/AIAnalysisPage.tsx](file:///e:/lawhelp/project/src/pages/AIAnalysisPage.tsx) [MODIFY]
* **Logic**: Captures the returned `documentId` state from the backend and displays a premium gilded dashboard card containing the unique registry ID and a "Registered (30-day retention active)" badge.

---

## 🧪 Verification Logs

Two verification scripts were executed locally to confirm correctness:

### Test 1: S3 and MongoDB Aggregation
* **File**: `scratch/test_s3_upload.js`
* **Result**: Verified that S3 uploads work, multiple files aggregate correctly under the same `documentId` with sequence numbers (`0` and `1`), presigned URLs generate correctly, and deletion successfully purges records.

### Test 2: AI End-to-End Extraction
* **File**: `scratch/test_ai_endpoint.js`
* **Result**: Verified that calling the actual `/api/ai/extract` API endpoint performs the database registration and S3/local file uploads, catches AI processing errors gracefully, and returns the unique `documentId` to the client.

---

## 🔒 Configuration Summary

### AWS S3 Production Credentials
Add the following keys to your [server/.env](file:///e:/lawhelp/server/.env):
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=nyayaconnect-documents
```
* **Encryption**: S3 files are encrypted using standard S3 managed keys (`AES256`/`SSE-S3`).
* **Transit**: Exclusively secure HTTPS communication (TLS).
* **Retention**: Set up a Lifecycle Rule on your S3 bucket to delete objects after 30 days.

---

## 🚀 Ready for Commit/Push

These changes are stable, fully compiled, and pass all local test verifications. You can stage and push them with the following Git commands:
```bash
git add .
git commit -m "feat: implement S3 durable file registry with MongoDB metadata tracking and React display"
git push origin main
```
