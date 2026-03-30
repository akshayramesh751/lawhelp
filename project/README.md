# NyayaConnect Frontend Application

## The Goal
The goal of the NyayaConnect frontend is to transform the typically daunting task of securing legal help into an approachable, trustworthy, and modern digital experience. The design principles focus on a premium, responsive interface that builds user confidence. Our objective here is to give users immediate clarity through detailed, verified lawyer profiles and frictionless consultation scheduling across any device viewing dimension.

## System Overview and Under the Hood
The project is built on Vite, React, and TypeScript. It uses functional components exclusively, relying heavily on modern React Hooks (like `useEffect` and `useState`) to govern application lifecycle and state.

- **TypeScript**: Used rigorously to enforce type-safety—specifically for API responses—guaranteeing that complex nested objects (e.g., lawyer `specialities` arrays, `barReg` details) align tightly with backend Mongoose models.
- **Tailwind CSS**: The main instrument for managing visual aesthetics natively in JSX, establishing a unified professional design language.

## Application Workflows

### 1. Data Hydration Workflow
- **The System**: Instead of relying on static arrays, the React UI is a living entity requesting real-time remote updates.
- **Implementation**: When users navigate to `LawyerListingPage`, a React `useEffect` hook triggers an asynchronous fetch to the Node/Express backend (`/api/lawyers`). The response JSON sets local component state.
- **Goal Achieved**: Ensures users are always presented with an up-to-date, live directory of practicing lawyers rather than stale data.

### 2. User Journey: From Browsing to Booking
1. **The Navigation Flow**: A user begins on an aggregated dashboard or list of professionals.
2. **Deep Dive Profile**: Clicking a professional mounts the `LawyerProfilePage.tsx` component. The system reads the specific lawyer's `id` from the URL, executes an API call fetching just that lawyer's specific history and reviews, and selectively renders the complex data structure visually.
3. **The Interactive Form**: If the user desires a consultation, they transition to `BookingConfirmPage.tsx`. Forms capture the user's intent. The frontend validates the input defensively before transmitting a structured POST payload to the booking endpoints.

## What Has Been Implemented So Far

- [x] **API Connectivity Structure**: Completely replaced initial mock JSON arrays with dynamic endpoint fetching using JavaScript `fetch` or Axios for data population.
- [x] **Type Integrity**: Synchronized the locally defined `Lawyer` TypeScript interfaces directly with the returned database schema logic (fixing nested attribute errors).
- [x] **Premium UI Components**: Built out the React component trees for complex pages like `DashboardPage`, standardizing styling with Tailwind CSS.
- [x] **Specialized Detailed Views**: The `LawyerProfilePage` accurately maps and loops over nested backend arrays including reviews and areas of practice.
- [x] **Booking Interactivity**: Form submission workflow enabling a user to lock in time with a professional and relay data successfully backwards up the stack to the server.

## Local Development Workflow

Install necessary node modules to assemble your node bundle.
```bash
npm install
```

To run the local Vite build server to hot reload components upon save:
```bash
npm run dev
```

The server operates locally, optimally at [http://localhost:5173](http://localhost:5173). To compile TypeScript output to vanilla JavaScript arrays for production deployments:
```bash
npm run build
```
