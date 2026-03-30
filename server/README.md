# NyayaConnect Backend API and Server Architecture

## The Goal
The backend for NyayaConnect is designed to be the robust, secure, and highly available engine powering the legal services marketplace. Our goal with this server architecture is to ensure data integrity for sensitive lawyer credentials, provide fast and reliable endpoints for frontend rendering, and automate asynchronous operational workflows like user notifications. This decoupled architecture allows for independent scaling of web services versus notification services.

## System Design and How It Works
The backend is fundamentally an Express.js Node application. It follows a traditional Model-View-Controller (MVC) directory structure, interacting with MongoDB Atlas as its primary persistence layer.

### System Workflow: The Request Lifecycle
1. **Routing Layer (`/routes`)**: The frontend sends an HTTP request (`GET`, `POST`, etc.) targeting a specific resource endpoint (e.g., `/api/lawyers`). The specialized router catches this.
2. **Controller Layer (`/controllers`)**: The router passes the request and its payload (such as booking details or search parameters) into a specific controller function. The controller is responsible for handling the core business logic.
3. **Model Layer (`/models`)**: If the request involves database interaction, the controller turns to Mongoose Object Data Modeling (ODM). It validates the incoming data structures against strict Mongoose Schemas (e.g., `Lawyer`, `Review`, `Booking`) to prevent corrupted data from entering the database.
4. **Database Operations**: Mongoose sends commands to the MongoDB Atlas cluster. Upon receiving data back, the controller formats this into a standard JSON response object and dispatches it back to the client.

### Operational Workflow: The Twilio Notification System
1. When a user finalizes a booking, the `BookingController` handles the incoming request.
2. After the new booking document is successfully created in the MongoDB database, the controller triggers a secondary, asynchronous service.
3. The server dynamically constructs a personalized message including the client's name, the lawyer's name, and the appointment time.
4. It calls the Twilio API Node SDK, passing your provisioned credentials (from `.env`).
5. Twilio dispatches a WhatsApp notification to the client's registered phone number to minimize no-shows.

## What Has Been Implemented So Far

- [x] **Database Schemas**: Strict Mongoose validation encompassing required fields (like `barReg` for lawyers) and relational IDs (linking a `Review` to a `Lawyer`).
- [x] **Lawyer Service Endpoints**: Fully operational CRUD API mapping to fetch professional directories or highly detailed individual profiles.
- [x] **Booking Workflows**: A secure mechanism to schedule consultations, storing the time, client, and lawyer references.
- [x] **Review Ecosystem**: An endpoint allowing users to post feedback and calculate average star ratings dynamically against specific legal providers.
- [x] **Twilio Message Pipeline**: A configured messaging service to trigger automated external SMS/WhatsApp communication flows.
- [x] **Seed Scripts**: Database population scripts (`seed.js`) developed to reliably insert test mock data into the cluster for local development and QA.

## Setup Instructions

### Environment Setup
Create a `.env` file containing fundamental connection variables.
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/nyayaconnect
TWILIO_ACCOUNT_SID=your_sid_here
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### Installation
Install the necessary NPM packages:
```bash
npm install
```

### Starting the Server
Start the development server with live-reloading:
```bash
npm run dev
```
