# AegisRx PharmAnalytics

AegisRx PharmAnalytics is a professional, high-performance desktop business intelligence and analytics application built specifically for pharmaceutical sales auditing and data analysis. It enables seamless ingestion of raw Excel sales spreadsheets, maps associations between prescribing doctors and selling pharmacies, tracks customer relation events, and generates branded PDF reports.

---

## Technical Architecture & Core CS Domains

AegisRx PharmAnalytics is architected to run entirely locally as a sandboxed, low-latency desktop environment. The system design spans multiple Computer Science domains, ensuring high reliability, safety, and performance.

### 1. Software Engineering (SE) & Design Patterns
- **Process Separation & Concurrency**: The application separates concerns into three distinct layers:
  - **Renderer Process**: Built with React (TypeScript) and Vite. Handles UI rendering and state management.
  - **Main Process**: Controls window lifecycle, system shortcuts, and OS integrations (e.g., native notifications, window controls).
  - **API Server Process**: Runs an embedded Hono server to handle heavy CPU-bound tasks like parsing massive Excel files without freezing the frontend UI.
- **Single-Instance Locking Pattern**: Ensures only one instance of the app runs at a time. Attempts to open a second instance redirect the user to the active window.
- **Dynamic Migration Pattern**: An initialization handler checks the SQLite schema and patches older database files dynamically to add columns such as `spouseBirthDate`, `childrenBirthDates`, `hospitalName`, and other hospital details without losing existing records.

### 2. Database Management Systems (DBMS)
- **Local Relational Engine**: Powered by SQLite for zero-configuration, transactional storage.
- **ORM & Type Safety**: Managed using Drizzle ORM to provide complete type safety from database query results up to UI components.
- **Dynamic Column Patching**: On startup, the system issues safe `PRAGMA table_info` schema calls to inspect columns and injects missing fields using `ALTER TABLE` if columns are missing.
- **Relational Integrity**:
  - **Doctor Table**: Stores full contact details, qualifications, specializations, and personal details (spouse, anniversary, children names, and dates).
  - **Pharmacy Table**: Maps pharmacies, their drug licenses, GST numbers, and associated doctor IDs.
  - **Notification Table**: Maintains event history, read/unread states, and cleared states.

### 3. Computer Networks (CN)
- **Localhost API Loopback Interface**:
  - Hono API Server: Listens exclusively on local loopback `http://localhost:3001` or `http://127.0.0.1:3001`.
  - Dev Interface: Vite runs on port `http://localhost:5173`.
- **CORS Safety**: Requests are bound and validated to ensure only the local Electron renderer process can communicate with the server.
- **API Endpoints**: Full CRUD endpoints for Doctors, Pharmacies, Linkages, Uploads, Settings, and Notifications.

### 4. Operating Systems (OS)
- **Process Lifecycle Management**: Integrates directly with Windows OS processes. Handles cleanup of subprocesses during termination (`taskkill` and window closing events).
- **Persistent Local Storage**: Stores application configurations, log files, and SQLite databases in the user's roaming AppData directory:
  `C:\Users\<Username>\AppData\Roaming\aegisrx-v1`
- **Native OS Toast Notifications**: Integrates with the Windows Action Center API to dispatch scheduled events.

### 5. Cybersecurity & Cryptography
- **Local Loopback Boundary**: The local port binding ensures that all data remains strictly local, preventing remote access to sensitive pharmaceutical data.
- **Strict Input Validation**: Client-side and server-side validators check registration numbers, GSTIN numbers, and phone numbers.
- **Data Sanitization**: Cleans uploaded data arrays, mapping fields dynamically and preventing SQL injection vectors via parameterized Drizzle ORM builders.

### 6. Machine Learning (ML) & Predictive Ingestion
- **Smart Column Prediction Heuristics**: During the upload of Excel Sales Reports, Doctor Master data, or Pharmacy Master spreadsheets, the Hono parser uses classification heuristics to map unstructured column headers to target database fields (e.g., matching "DOB", "Birth Date", "D.O.B" to the `birthDate` field).

---

## Core System Features

- **Dynamic Excel Sheet Ingestion**: Instantly upload Sales Reports, Doctor Master data, or Pharmacy Master spreadsheets. The Hono parsing engine performs structural header matching and imports records.
- **Advanced Business Intelligence Dashboard**: View total revenue, units sold, free goods ratios, and active listings. Chart components display revenue share by pharmacy, top products, and doctor-wise sales.
- **Doctor Selection Filter**: Tailor your charts and tables using the quick search input and scrollable doctor selector checkboxes in the analytics view.
- **Automated Prescribing Joins**: Doctor profiles merge manually assigned medicines with automatically tracked pharmacy sales to show what products are sold through linked stores.
- **3-Day Event Span Notification Engine**: A background worker checks events dynamically within a 3-day window:
  - `t + 0` (Today)
  - `t + 1` (Tomorrow)
  - `t + 2` (Day After Tomorrow)
  - Tracks and stores state in the database, ensuring marked-as-read and cleared notifications persist even if the application restarts.
- **Professional Document Exports**: Download clean CSV sheets or build customized, branded PDF directories. Addresses and contact information wrap dynamically to prevent truncation, and currency values use standardized "RS. " formatting.

---

## Setup and Development

### Prerequisites
- Node.js (version 18 or above recommended)
- Windows OS (required for native toast notification integration)

### Installation
Install the project dependencies:
```bash
npm install
```

### Running in Development
Start Vite and Electron concurrently in development mode:
```bash
npm run dev
```

For running Electron developer tools in the background:
```bash
npm run electron:dev
```

### Building for Production
Compile the React frontend and pack the Electron application into a Windows installer:
```bash
npm run build
```
This command compiles the files into `dist-electron` and `dist` folders, and packages the executable installer into the `release` folder.

---

## Database Migration and Schema

The application uses Drizzle ORM to manage its SQLite schema. Column structures can be customized in `electron/db/schema.ts`. To apply migrations or view the local schema tables:
```bash
npx drizzle-kit generate
npx drizzle-kit push
```
