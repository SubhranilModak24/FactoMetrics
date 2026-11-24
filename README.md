# FactoMetrics — CalSymPy Optimization Platform

An interactive manufacturing cost and investment optimization dashboard built with **Next.js**, **Tailwind CSS**, **Payload CMS**, and **Firebase (Google Auth + Firestore)**, powered by an **ASI 2022–23 SLSQP + SymPy** optimization model.

## Features

- **Sign-In & Workspace Access (`/`)**: Google Authentication via Firebase Auth, plus Guest (read-only) mode.
- **Dashboard & Simulator (`/dashboard`)**:
  - Interactive parameter sliders for **Capital Budget ($B$)**, **Production Mix Tolerance**, and **Sensitivity Multiplier**.
  - Live KPIs and charts calibrated to **ASI 2022–23 Factory #204795** (Products `4432000`, `4332008`, `4394900`, Unit Code `15`).
  - **Optimal Production & Investment Plan** table and **Factory Cost Pools** breakdown.
- **Codebase & Math (`/code`)**: Full 822-line `asi_2022_23_optimizer_simplified2.py` source viewer alongside SymPy symbolic verification cards (partial derivatives, directional derivative, 2nd-order Taylor series, and constraint residuals).
- **Saved Graphs (`/saved`)**: Save, search, filter, load, and delete optimization scenarios, synced per user to **Cloud Firestore** when signed in.

## Prerequisites

- **Node.js** `24.22.3+` (or `24.x`)
- **pnpm** `10.34.3+` (`corepack enable` or `npm install -g pnpm@10.34.3`)
- A **Firebase** project (optional for guest preview; required for Google Sign-In and Firestore sync)

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure Firebase credentials**:
   Copy `.env.example` to `.env.local` (or edit the existing `.env.local` in the project root) and fill in your Firebase Web App config:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```
   In the Firebase Console:
   - Enable **Google** under **Authentication → Sign-in method**.
   - Create a **Cloud Firestore** database.

## Running Locally

### Windows (PowerShell)
```powershell
pnpm exec next dev --port 3000
```

### macOS / Linux
```bash
pnpm dev
```

Open `http://localhost:3000` in your browser.

## Routes

| Route | Description |
| :--- | :--- |
| `/` | Sign-In page (Google Auth or Guest) |
| `/dashboard` | Optimization Dashboard & Simulator |
| `/code` | `asi_2022_23_optimizer_simplified2.py` & SymPy Math Verification |
| `/saved` | Saved Scenarios Library (Firestore synced) |
