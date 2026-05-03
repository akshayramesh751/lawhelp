# NyayaConnect: Comprehensive Legal Services Platform

## 🎯 Overview
The primary goal of **NyayaConnect** is to democratize access to legal assistance. Navigating the legal landscape can be complex and intimidating. This platform bridges the gap between individuals seeking legal advice and qualified legal professionals by providing a transparent, user-friendly digital marketplace paired with cutting-edge AI legal document analysis.

---

## 🏗️ System Architecture & Design
NyayaConnect is engineered as a highly scalable, decoupled full-stack ecosystem. It operates using a Microservices architecture across three main repositories:

### 1. `/project` (Frontend Client)
A React-based Single Page Application (SPA) built with Vite and TypeScript. 
- **Design System**: Styled with the stunning "Midnight Gilded" UI theme, focusing on premium aesthetics, deep navy backgrounds, and gold accents.
- **State Management & Routing**: Utilizes React Hooks and dynamic routing for seamless transitions between Dashboards, AI Analysis, and Lawyer profiles.
- **Responsive & Interactive**: Full mobile-responsive design with drag-and-drop file uploaders, dynamic booking calendars, and animated transitions.

### 2. `/server` (Backend API Gateway)
An Express.js REST application operating on Node.js.
- **Database Layer**: Integrates with MongoDB (Atlas) using Mongoose for persistent data (Users, Lawyers, Bookings, Reviews).
- **Caching Layer**: Redis integration to drastically improve read latency for directory listings.
- **Document Gateway**: Utilizes `multer` for memory-safe multi-part file uploads (up to 5 images or 1 PDF) and `tesseract.js` for concurrent OCR processing before handing data to the AI service.

### 3. `/ai-service` (AI Document Microservice)
A highly specialized Python/FastAPI microservice dedicated entirely to heavy NLP and Machine Learning workloads.
- **Decoupled Performance**: Separating this from the Node.js event loop ensures that heavy text processing, Regex analysis, and ML model inference do not block standard web traffic.
- **Deterministic AI**: Prioritizes strict pattern matching, Unicode normalization, and termbases over purely probabilistic LLM generation to prevent legal hallucinations.

---

## ⚙️ System Requirements
To run the full stack locally, ensure the following are installed:
- **Node.js** (v18.0 or higher) - Required for the Frontend and Node Backend.
- **Python** (v3.10 to v3.13) - Required for the AI Microservice.
- **MongoDB** - Local instance or MongoDB Atlas cluster URI.
- **Redis** - Local instance or managed Redis cloud URI.
- **Tesseract OCR** - Under-the-hood engine used by the Node.js `tesseract.js` wrapper.

---

## 🔄 Application Workflow

### Workflow 1: The Booking Engine
1. **Authentication**: Users log in via a secure Google OAuth flow.
2. **Discovery**: Users browse the Lawyer Directory, filtered by specialties (cached via Redis for speed).
3. **Availability & Scheduling**: The UI dynamically generates evening availability slots (e.g., 4 PM–8 PM, Mon–Sat) dynamically bypassing past dates.
4. **Confirmation**: Upon booking, MongoDB securely logs the transaction, and the Node backend dispatches Email notifications/Twilio webhooks.

### Workflow 2: Multi-Stage AI Document Analysis
1. **Ingestion & Gateway Routing (Node.js)**
   - User drops up to 5 images or 1 digital PDF into the React UI.
   - Node.js streams PDFs directly to Python. For multi-page images, Node runs concurrent Tesseract OCR on all images, stitches the text together, and passes it to Python.
2. **Native Extraction & Fallback (Python)**
   - `PyMuPDF` attempts to extract perfect digital Unicode natively. If it detects a scanned PDF (low text density), it rejects it, forcing Node to fall back to OCR.
3. **Pre-Processing (Stage 0 & 1)**
   - **Joint Character Fix**: Merges broken Kannada conjuncts (e.g., floating Viramas).
   - **NFKC Normalization**: Mathematically fuses Unicode matras to base characters.
   - **Numeral Conversion**: Converts Kannada numerals (೧, ೨) to Arabic numerals (1, 2) to lock in financial and date data.
   - **OCR Sanity Checks**: Fixes formatting blinks (e.g., `1.50.000` -> `1,50,000` and spaced Pincodes).
4. **Pre-Translation Safeguards (Stage 2)**
   - **Raw PII Redaction**: Masks Aadhaar, PAN, and Cheque numbers before translation destroys their format.
   - **Suffix Stripping**: Recognizes agglutinative Kannada suffixes (e.g., "Name + ಅವರೇ") and wraps them in English salutations ("Dear [Name]").
   - **Deterministic Glossary**: Hard-codes critical domain terms (e.g., "ಕೆಲಸದಿಂದ ವಜಾ ಮಾಡುವ ಹಕ್ಕು" strictly to "Right to Dismiss/Terminate").
5. **Deep Translation & Post-Editing (Stage 3 & 4)**
   - Uses chunked Google Translate logic (1000 chars) to bypass limits.
   - Cleans up translation hallucinations and strips remaining non-ASCII noise.
6. **NLP Anonymization & Classification (Stage 5)**
   - **Microsoft Presidio**: Masks high-risk English PII (Emails, Phones) while preserving context (Names, Locations).
   - **Tiered Classification**: A 3-Tier engine scans the cleaned text. Tier 1 matches Headers. Tier 2 uses a sliding window for weighted keywords. Tier 3 uses Zero-Shot ML. Returns the precise legal domain (e.g., "Rental Agreement") back to the React UI.

---

## ✅ Implemented Features (Current State)

### Frontend Development (`/project`)
- Premium "Midnight Gilded" UI Design System.
- Multi-file drag-and-drop ingestion with format gatekeeping (max 5 images or 1 PDF).
- Beautiful classification and confidence-score rendering component.
- Real backend integration fetching MongoDB data and processing AI requests.

### Backend Infrastructure (`/server`)
- MongoDB Atlas schema modeling (User, Lawyer, Booking).
- `multer` implementation supporting concurrent arrays of images.
- Native fetch integration cleanly sending `Blob`/`FormData` boundary requests to FastAPI.
- Redis implementation for rapid directory caching.

### AI Microservice (`/ai-service`)
- `PyMuPDF` Native-First extraction.
- A fully mapped `taxonomy.json` serving as the legal Termbase/Glossary.
- `classifier.py` implementing the fast, deterministic 3-tier categorization system.
- `presidio` integration for bulletproof data anonymization.

---

## 🚀 The Roadmap: Scaling for Enterprise
1. **Message Brokers**: Offload email sending and NLP requests to background queues (BullMQ + Redis) so the main API responds instantly.
2. **WebSockets**: Implement `Socket.io` to push live classification updates and booking confirmations directly to the user dashboard.
3. **Database Sharding & Replicas**: Route heavy frontend `GET` searches to secondary MongoDB nodes, separating them from transactional `POST` operations.
4. **CDN & Rate Limiting**: Serve the React application and images via Cloudflare edge nodes, and use Redis rate limiting to prevent DDoS attacks on the `/extract` endpoints.

---

## 💻 Running the Current System Locally

You will need three terminal windows running concurrently:

**Terminal 1 (AI Microservice):**
```bash
cd ai-service
# Activate your virtual environment (venv\Scripts\activate or source venv/bin/activate)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Terminal 2 (Backend API):**
```bash
cd server
npm install
node index.js
```

**Terminal 3 (Frontend Client):**
```bash
cd project
npm install
npm run dev
```
