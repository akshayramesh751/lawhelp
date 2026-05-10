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

## Detailed Technical Architecture & Workflow Specifications

The following sections provide a deep dive into the technical architecture and end-to-end workflows of the two primary subsystems of CaseCounsel (formerly NyayaConnect): the AI Document Summarizer and the Lawyer Booking Engine.

### 1. System Architecture: AI Document Summarizer
This subsystem is designed to handle complex legal NLP workloads seamlessly, focusing on deterministic accuracy over probabilistic generation to ensure strict legal fidelity.
* **Client Interface (React/Vite)**: The frontend accepts multiple document types (images, PDFs) via a drag-and-drop interface. It validates file sizes and types before dispatching a `multipart/form-data` request.
* **API Gateway (Node.js/Express)**: Acts as the primary orchestrator.
  * **Multer Middleware**: Safely processes incoming files in memory.
  * **Tesseract OCR Wrapper**: If images are uploaded, the Node.js layer concurrently runs Tesseract OCR across all images to extract raw text, mitigating the need to pass heavy binary image payloads to the Python service. PDFs are streamed directly as binary buffers.
* **AI Microservice (Python/FastAPI)**: The core processing engine isolated from the Node.js event loop.
  * **Ingestion Engine**: Uses `PyMuPDF` for native digital text extraction from PDFs. If the PDF is scanned (low text density), it rejects it and triggers OCR fallback.
  * **Preprocessing & Normalization Module**: Handles Unicode normalization (NFKC) and Kannada character fixes (merging broken conjuncts, converting numerals).
  * **Regex & PII Redaction Pipeline**: Applies custom Regex to redact structured PII (Aadhaar, PAN, Cheque numbers) and handles domain-specific deterministic term replacement before translation.
  * **Translation Pipeline**: Implements chunked translation processing to convert regional text (Kannada) to English.
  * **NLP Anonymization (Microsoft Presidio)**: Masks unstructured PII (Emails, Phones) post-translation while retaining context (Names, Organizations).
  * **Classification Engine**: A 3-Tier hierarchical engine (Header matching -> Keyword Sliding Window -> Zero-Shot ML) that categorizes the document (e.g., Rental Agreement, Employment Contract).

### 2. System Architecture: Lawyer Booking App
This subsystem serves as a robust marketplace connecting users with verified legal professionals. It is structured around a traditional RESTful API architecture optimized for speed and reliability.
* **Frontend Application (React/Vite)**:
  * Features the "Midnight Gilded" premium UI, ensuring a highly polished user experience.
  * Uses React Hooks for state management to handle filtering, dynamic calendar rendering, and form submissions.
* **Backend API (Node.js/Express)**:
  * Implements RESTful endpoints (`/api/lawyers`, `/api/bookings`, etc.) to handle CRUD operations.
  * **Caching Layer (Redis)**: Integrated to cache frequent query results, such as the lawyer directory and specialty filters, significantly reducing database read latency.
* **Database (MongoDB Atlas)**:
  * Uses Mongoose ODMs with strict schemas for `Users`, `Lawyers`, and `Bookings`.
  * Enforces relationships (e.g., a Booking belongs to a User and a Lawyer).
* **Notification System (Nodemailer)**:
  * An asynchronous utility that intercepts successful booking events and dispatches confirmation HTML emails via Gmail SMTP, confirming the appointment for both the user and the lawyer.

### 3. Workflow Explanation: AI Document Summarizer
This is the sequential step-by-step process of how a document is processed when a user uploads it.
1. **Upload & Validation**: The user drops a document (e.g., a Kannada rental agreement) into the UI. The React app validates it (max 5 images or 1 PDF) and sends an HTTP POST request to the Node.js `/api/upload` endpoint.
2. **Initial Parsing (Node.js)**: The `multer` middleware receives the file. 
   - *If Image*: Node.js triggers `tesseract.js` to run OCR, extracting raw text. It then sends this text payload to the Python `/extract` endpoint.
   - *If PDF*: Node.js streams the raw PDF binary to the Python service.
3. **Native Extraction (Python)**: The Python FastAPI service attempts to read the PDF using `PyMuPDF`. If digital text is found, it proceeds. If it's a scanned PDF, it falls back to OCR.
4. **Text Normalization**: The raw text undergoes rigorous cleanup: broken Kannada characters are fused, Unicode matras are mathematically aligned, and numerals are converted to standard Arabic.
5. **Pre-Translation Masking**: Custom Regex targets and masks highly sensitive IDs (like PAN and Aadhaar) so that the translation engine does not alter their formatting.
6. **Translation & Post-Processing**: The text is chunked into 1000-character blocks, sent to Google Translate, and stitched back together. Any translation anomalies (hallucinations) are stripped out.
7. **Contextual Anonymization**: Microsoft Presidio scans the English text to mask standard PII (phone numbers, email addresses).
8. **Classification**: The sanitized text enters the 3-Tier classification engine to determine the legal domain.
9. **Response**: The Node.js server receives the final sanitized text and its classification label, and relays this JSON payload back to the React frontend, which renders the results beautifully.

### 4. Workflow Explanation: Lawyer Booking App
This outlines the user journey from discovering a lawyer to successfully scheduling an appointment.
1. **User Authentication**: The user visits the application and logs in (via standard Auth/OAuth). The session is established.
2. **Directory Browsing**: The user navigates to the Lawyer Directory. The React frontend sends a GET request to `/api/lawyers`.
3. **Redis Caching**: The Node.js server intercepts the request, checks the Redis cache for existing directory data, and instantly returns it if available (cache hit), bypassing the MongoDB query.
4. **Filtering**: The user filters lawyers by specialty (e.g., "Family Law"). The UI updates the list dynamically based on the cached or fetched data.
5. **Selecting a Slot**: The user clicks a lawyer profile. The React app dynamically generates available evening slots (4 PM – 8 PM, Mon–Sat) based on current availability and past dates.
6. **Booking Submission**: The user selects a time and clicks "Book". The frontend sends a POST request with the user ID, lawyer ID, and timestamp to `/api/bookings`.
7. **Database Transaction**: The Node.js server validates the slot, creates a new Booking document in MongoDB, and updates the lawyer's availability.
8. **Notification Dispatch**: Upon successful database insertion, the Node.js server triggers the Nodemailer utility. It securely fetches the app password from environment variables and sends confirmation emails to the user and the lawyer.
9. **UI Update**: The Node.js server returns a `200 OK` status to the frontend. The React app shows a success modal, and the user's dashboard is updated with the upcoming appointment.
