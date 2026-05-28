# AegisRx PharmAnalytics

AegisRx PharmAnalytics is a professional, high-performance desktop business intelligence and analytics application built specifically for pharmaceutical sales auditing and data analysis. It enables seamless ingestion of raw Excel sales spreadsheets, maps associations between prescribing doctors and selling pharmacies, tracks customer relation events, and generates branded PDF reports.

## Technology Stack

The application is architected across multiple software engineering layers to run entirely locally as a desktop app:

- Core Shell: Electron for desktop application wrapping and OS integrations.
- Frontend Framework: React (TypeScript) and Vite for fast, hot-reloading user interfaces.
- UI Design System: Mantine UI, Tailwind CSS for modern layouts, and Tabler Icons.
- Local Server / API Layer: Hono server embedded inside Electron to handle API routes and heavy Excel parsing concurrently.
- Database: SQLite database managed through Drizzle ORM for local, low-latency relational queries.
- Analytics & PDF Utilities: Recharts for data visualizations, and jsPDF with autoTable for customized PDF exporting.

## Key Features

- Dynamic Excel Sheet Ingestion: Instantly upload Sales Reports, Doctor Master data, or Pharmacy Master spreadsheets. The Hono parsing engine performs structural header matching, predicts the file format, and imports records.
- Advanced Business Intelligence Dashboard: View total revenue, units sold, free goods ratios, and active listings. Chart components display revenue share by pharmacy, top products, and doctor-wise sales.
- Doctor Selection Filter: Tailor your charts and tables using the quick search input and scrollable doctor selector checkboxes in the analytics view.
- Automated Prescribing Joins: Doctor profiles merge manually assigned medicines with automatically tracked pharmacy sales to show what products are sold through linked stores, disabling manual unlinking to prevent data mismatches.
- Event Notifications: An automated background checker checks doctor birthdays, spouse anniversaries, and pharmacy owner birthdays. It queues native Windows Action Center notifications.
- Professional Document Exports: Download clean CSV sheets or build customized, branded PDF directories. Addresses and contact information wrap dynamically to prevent truncation, and currency values use standardized "RS. " formatting.

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
This command compiles the files into the `dist-electron` and `dist` folders and packages the executable installer into the `release` folder.

## Database Migration and Schema

The application uses Drizzle ORM to manage its SQLite schema. Column structures can be customized in `electron/db/schema.ts`. To apply migrations or view the local schema tables:
```bash
npx drizzle-kit generate
npx drizzle-kit push
```
