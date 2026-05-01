# NyayaConnect: Comprehensive Legal Services Platform

## 🎯 The Goal
The primary goal of **NyayaConnect** is to democratize access to legal assistance. Navigating the legal landscape can be intimidating and complex for the average individual. This platform aims to bridge the gap between people seeking legal advice and qualified legal professionals by providing a transparent, easy-to-use digital marketplace. We foster trust through verified profiles, user reviews, and a seamless consultation booking process.

---

## 🛠️ System Overview
NyayaConnect is engineered as a modern, decoupled full-stack web application. It operates using a Microservices architecture, broken down into three main workspaces:

- **`/project` (Frontend Client)**: A React-based Single Page Application (SPA) providing the user interface, styled with the stunning "Midnight Gilded" UI design system. It focuses on performance, accessibility, modern aesthetics, and dynamic data rendering.
- **`/server` (Backend Node API)**: An Express.js REST application operating alongside a MongoDB NoSQL database to persistently store user, lawyer, and booking data safely. It also handles initial document ingestion.
- **`/ai-service` (AI Document Microservice)**: A scalable Python/FastAPI backend dedicated solely to heavy NLP workloads. It handles Multi-language translation, India-specific PII anonymization, and advanced text normalization without blocking the main Node.js event loop.

---

## ✅ What Has Been Implemented So Far (Current State)

We have successfully established the foundational end-to-end workflows of the platform.

### Frontend Development (`/project`)
- **"Midnight Gilded" UI Design System**: A premium, highly aesthetic modern interface implemented across the platform.
- **Dynamic Views**: Responsive designs for the listing directory, detailed professional profiles, user dashboard, and booking confirmation screens.
- **Google Authentication Flow**: Secure OAuth login for seamless user onboarding.
- **Dynamic Availability UI**: Real-time availability slot generation (e.g., 4 PM–8 PM, Mon–Sat) for booking consultations.
- **Real Backend Integration**: React app fully fetches, renders, and mutates dynamic data via our Node APIs instead of mock data.
- **TypeScript Enhancements**: Strict typing across components (fixed JSX/prop mismatches) for robust development.

### Backend Infrastructure (`/server`)
- **Monorepo Structure**: Separation of concerns between frontend client and backend services.
- **MongoDB Atlas Integration**: Operational Mongoose ODM modeling with schemas for `User`, `Lawyer`, `Review`, and `Booking`.
- **Core RESTful API**: Bulletproof CRUD operations for directory fetching, creating bookings, and user management.
- **Email Notifications**: Email transporter logic (`utils/email.js`) configured for booking status updates and basic notifications.
- **Firebase Admin Integration**: Integrated backend administration (`utils/firebaseAdmin.js`) potentially for auth verification or managed data tracking.

### AI Document Processing Pipeline (`/ai-service` & `/server`)
- **Hybrid Extraction Engine**: Node.js extraction pipeline utilizing `pdf-parse` for digital PDFs and `tesseract.js` for scanned images.
- **Microservice Architecture**: Python FastAPI implementation totally decoupled from Node.js to ensure non-blocking, highly scalable NLP operations.
- **Privacy & Anonymization Engine**: Built using Microsoft Presidio combined with Custom India-Specific Regex (Aadhaar, PAN, Cheque). Masks sensitive PII while generating secure legal placeholders (`[PARTY_NAME]`, `[CHEQUE_REDACTED]`).
- **Indic Language Translation**: Lightweight, chunk-based Google Translate integration (`deep-translator`) with resilient fallback handling, auto language detection, and strict Unicode Normalization (NFKC) to prevent OCR hallucination on languages like Kannada.
- **Domain-Specific Post-Editing**: Pre-translation Anchor word mapping and post-translation Regex overrides (fixing hallucinated legal roles like "Finance Minister" to "Owner") to guarantee precise English context.

---

## 🚀 The Roadmap: Scaling for Enterprise & Multiple Users

To transition NyayaConnect from a fully-functional MVP to a highly scalable, production-ready enterprise application capable of handling thousands of concurrent users, the following architectural enhancements are planned.

### 1. In-Memory Caching (Redis)
- **Problem**: Querying MongoDB on every request to load the "Lawyer Directory" or user sessions is expensive and causes high latency at scale.
- **Solution**: Implement **Redis** as a distributed caching layer.
  - Cache the aggregated list of lawyers and their reviews.
  - Store temporary user sessions.
  - *Invalidation Strategy*: Clear specific cache keys via Mongoose middleware (e.g., when a lawyer updates their profile or gets a new review).

### 2. Message Brokers & Asynchronous Workers (BullMQ + Redis / RabbitMQ)
- **Problem**: Currently, when a user books a slot, the API waits for the Email service to respond before returning a `200 OK`. This blocks the thread and slows down the user experience.
- **Solution**: Extract 3rd-party network calls into background jobs.
  - The API instantly returns a "Booking Initiated" response.
  - A message is published to a job queue.
  - Background worker processes (separate from the main API) safely process the email dispatching, retrying on failure without affecting the user.

### 3. Real-Time WebSockets (Socket.io)
- **Problem**: Tracking updates for booking confirmations on the dashboard requires manual refreshing or heavy HTTP polling.
- **Solution**: Integrate **WebSockets (Socket.io)**. When a booking status is updated in the backend (from pending to confirmed/rejected), the server pushes an event directly to the specific user's active client socket, instantly updating their dashboard UI in real-time.

### 4. Application Load Balancing & Microservices
- **Solution**: Break the monolith API into domain-specific microservices (e.g., `User Service`, `Booking Service`, `Notification Service`).
  - Deploy multiple instances of the Node.js API using **Docker** and orchestration (like **Kubernetes** or **AWS ECS**).
  - Use an **NGINX** or **AWS Application Load Balancer (ALB)** to distribute incoming traffic evenly across NodeJS containers.

### 5. Database Scaling (MongoDB Replica Sets & Sharding)
- **Solution**: Transition from a single database cluster to a highly available architecture.
  - **Read Replicas**: Route heavy frontend `GET` requests (like searching for lawyers) to secondary read-only nodes. Route all `POST`/`PUT` requests to the primary node.
  - **Sharding**: If bookings exceed millions of rows, shard the `Bookings` collection linearly based on `lawyerId` or region.
  - Add compound indexes for frequent querying (e.g., fetching available slots by `lawyerId` + `date`).

### 6. Security, Rate Limiting & CDN Edge Computing
- **Solution**: 
  - Wrap the entire application in a CDN (e.g., **Cloudflare** or **AWS CloudFront**) to deliver static frontend assets and lawyer profile images from edge nodes geographically closest to the user.
  - Implement **Redis Rate Limiting** to protect endpoints (especially login and booking endpoints) from brute-force/DDoS attacks.
  - Establish complete JWT rotation mechanisms with secure, `HttpOnly` cookies.

### 7. CI/CD & Observability
- **Solution**: Introduce strict DevOps standard practices.
  - **Pipelines**: GitHub Actions / GitLab CI to run automated integration tests, ESLint, and TypeScript builds before every PR merge.
  - **Observability**: Use Datadog or the ELK stack to centralize API request logs and error monitoring. Set up Prometheus/Grafana to map CPU constraints in real-time.

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
# Ensure .env contains MONGO_URI, GOOGLE_CLIENT_ID, etc.
node index.js # or npm run dev
```

**Terminal 3 (Frontend Client):**
```bash
cd project
npm install
npm run dev
```

