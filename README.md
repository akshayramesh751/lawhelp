# NyayaConnect: Comprehensive Legal Services Platform

## The Goal
The primary goal of the **NyayaConnect** project is to democratize access to legal assistance. Navigating the legal landscape can be intimidating and complex for the average individual. This platform aims to bridge the gap between people seeking legal advice and qualified legal professionals by providing a transparent, easy-to-use digital marketplace. We aim to foster trust through verified profiles, user reviews, and a seamless consultation booking process.

## System Overview
NyayaConnect is engineered as a modern, decoupled full-stack web application. It operates using a Client-Server architecture, broken down into two main workspaces:

- **`/project` (Frontend Client)**: A React-based Single Page Application (SPA) providing the user interface. It focuses on performance, accessibility, and dynamic data rendering.
- **`/server` (Backend Node API)**: An Express.js REST application operating alongside a MongoDB NoSQL database to persistently store user, lawyer, and booking data safely.

## Core Workflows and How It Works

### 1. Discovery Workflow
- **The System**: Clients access the platform and are presented with a directory of available lawyers. The React frontend sends a `GET` request to the backend.
- **Implementation**: The Node.js server queries the MongoDB `Lawyers` collection and returns structured JSON. The frontend loops through this data to render interactive lawyer cards containing names, specialties, and ratings.

### 2. Evaluation Workflow
- **The System**: A client clicks on a specific lawyer to learn more.
- **Implementation**: The user is routed to a detailed `LawyerProfilePage`. The frontend requests a specific lawyer's full profile, which includes their Bar Council Registration credentials, educational background, pricing, and all historical user reviews.

### 3. Booking and Consultation Workflow
- **The System**: Once a client decides to proceed, they select an available time slot and submit a booking request.
- **Implementation**: The frontend posts form data securely to the backend `/api/bookings` endpoint. The server verifies the data, creates a new booking document in the database, and responds with a success status. 

### 4. Automated Notification Workflow
- **The System**: To reduce no-shows and keep clients informed, the system automatically dispatches notifications.
- **Implementation**: Upon a successful booking creation, the backend's notification service triggers the **Twilio API**. An asynchronous WhatsApp message or SMS is dispatched to the client's registered phone number confirming the consultation details.

## What Has Been Implemented So Far

- [x] **Monorepo Setup**: Separation of frontend and backend concerns.
- [x] **Database Schema Design**: Mongoose models created for `Lawyer`, `Review`, and `Booking`.
- [x] **Backend REST API**: Complete CRUD operations for fetching professionals, creating bookings, and posting reviews.
- [x] **Frontend UI Interfaces**: Responsive designs for the listing directory, detailed profiles, dashboard, and booking confirmation screens.
- [x] **Frontend API Integration**: Transitioned the React app from using hard-coded mock data to fetching real, dynamic data from the backend APIs.
- [x] **External Integrations**: Plumbed in the Twilio Node.js SDK to send automated messaging workflows.

## Running the Entire System Locally

You will need two terminal windows running concurrently:

**Terminal 1 (Backend):**
```bash
cd server
npm install
# Ensure your .env file is populated as per the server README
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd project
npm install
npm run dev
```
