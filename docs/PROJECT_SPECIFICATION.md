# SuratPharma Analytics Platform

## Comprehensive Project Specification Document

---

## 1. Executive Summary

### 1.1 Project Overview

**SuratPharma Analytics** is a desktop-based pharmaceutical analytics platform designed for a medicine manufacturer in Surat, India. The application provides comprehensive business intelligence by tracking relationships between **Doctors**, **Hospitals/Clinics**, and **Pharmacy Stores**, enabling detailed revenue attribution analysis from dealer sales data.

### 1.2 Business Objectives

- **Revenue Visibility**: Understand which doctors generate the most revenue through their associated pharmacies
- **Relationship Mapping**: Visualize the interconnected network of doctors, hospitals, and pharmacies
- **Data-Driven Decisions**: Provide actionable analytics from Excel-based dealer reports
- **Relationship Management**: Track important dates (birthdays, anniversaries) for key stakeholders

### 1.3 Target User

- **Primary User**: Non-technical business owner (pharmaceutical manufacturer)
- **Usage Context**: Daily/weekly analysis of sales data and relationship management
- **Technical Proficiency**: Basic computer literacy; requires intuitive, simple UI

---

## 2. Technical Architecture

### 2.1 Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON SHELL                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     REACT FRONTEND                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │   Mantine   │  │  Recharts   │  │  Framer Motion  │    │  │
│  │  │     UI      │  │   Charts    │  │   Animations    │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                         IPC BRIDGE                               │
│                              │                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   MAIN PROCESS (Node.js)                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │   Prisma    │  │   SQLite    │  │  Python Bridge  │    │  │
│  │  │     ORM     │  │     DB      │  │      IPC        │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │  PYTHON ENGINE    │
                    │  ┌─────────────┐  │
                    │  │   Pandas    │  │
                    │  │   NumPy     │  │
                    │  │ Matplotlib  │  │
                    │  │ ReportLab   │  │
                    │  └─────────────┘  │
                    └───────────────────┘
```

### 2.2 Component Breakdown

| Layer                  | Technology            | Purpose                             |
| ---------------------- | --------------------- | ----------------------------------- |
| **Desktop Runtime**    | Electron 28+          | Windows .exe packaging, native APIs |
| **Frontend Framework** | React 18 + TypeScript | Component-based UI                  |
| **UI Library**         | Mantine v7            | Clean, accessible components        |
| **State Management**   | Zustand               | Lightweight global state            |
| **Charts**             | Recharts              | Interactive data visualization      |
| **Animations**         | Framer Motion         | Subtle, professional transitions    |
| **Database**           | SQLite 3              | Local, file-based storage           |
| **ORM**                | Prisma                | Type-safe database access           |
| **Analytics Engine**   | Python 3.11           | Excel processing, ML analysis       |
| **Excel Processing**   | Pandas, OpenPyXL      | Data extraction and transformation  |
| **PDF Generation**     | ReportLab, Matplotlib | Report exports                      |

### 2.3 System Requirements

- **OS**: Windows 10/11 (64-bit)
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 500MB for application + data growth
- **Display**: 1920x1080 recommended (minimum 1366x768)

---

## 3. Database Schema Design

### 3.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│     DOCTOR      │       │   DOCTOR_HOSPITAL    │       │    HOSPITAL     │
├─────────────────┤       ├──────────────────────┤       ├─────────────────┤
│ id (PK)         │───────│ doctor_id (FK)       │───────│ id (PK)         │
│ name*           │       │ hospital_id (FK)     │       │ name*           │
│ contact*        │       │ relationship_type    │       │ address*        │
│ address*        │       │ (OWNER/VISITING)     │       │ primary_phone*  │
│ birth_date      │       │ created_at           │       │ secondary_phone │
│ is_married      │       └──────────────────────┘       │ reception_phone │
│ spouse_name     │                                       │ created_at      │
│ anniversary     │                                       │ updated_at      │
│ qualification*  │                                       └─────────────────┘
│ specialization* │                                               │
│ created_at      │                                               │
│ updated_at      │                                               │
└─────────────────┘                                               │
                                                                  │
                          ┌──────────────────────┐                │
                          │  HOSPITAL_PHARMACY   │                │
                          ├──────────────────────┤                │
                          │ hospital_id (FK)     │────────────────┘
                          │ pharmacy_id (FK)     │
                          │ distance_km          │
                          │ created_at           │
                          └──────────────────────┘
                                    │
                                    │
┌─────────────────┐                 │
│    PHARMACY     │─────────────────┘
├─────────────────┤
│ id (PK)         │       ┌──────────────────────┐       ┌─────────────────┐
│ name*           │       │   EXCEL_UPLOAD       │       │ ANALYTICS_CACHE │
│ owner_name*     │       ├──────────────────────┤       ├─────────────────┤
│ license_id*     │       │ id (PK)              │───────│ id (PK)         │
│ gst_number      │       │ file_name            │       │ upload_id (FK)  │
│ drug_license    │       │ file_hash (UNIQUE)   │       │ doctor_id       │
│ address*        │       │ upload_date          │       │ total_revenue   │
│ contact*        │       │ record_count         │       │ pharmacy_breakdown│
│ created_at      │       │ date_range_start     │       │ computed_at     │
│ updated_at      │       │ date_range_end       │       └─────────────────┘
└─────────────────┘       │ status               │
                          └──────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      NOTIFICATIONS                               │
├─────────────────────────────────────────────────────────────────┤
│ id (PK) | entity_type | entity_id | event_type | event_date    │
│ title | message | is_read | created_at                          │
└─────────────────────────────────────────────────────────────────┘

* = Required field
```

### 3.2 Table Definitions

#### 3.2.1 Doctor Table

```sql
CREATE TABLE doctors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    contact         TEXT NOT NULL,
    address         TEXT NOT NULL,
    birth_date      DATE,
    is_married      BOOLEAN DEFAULT FALSE,
    spouse_name     TEXT,
    anniversary     DATE,
    children_count  INTEGER DEFAULT 0,
    children_names  TEXT,  -- JSON array
    qualification   TEXT NOT NULL,
    specialization  TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.2.2 Hospital Table

```sql
CREATE TABLE hospitals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    address         TEXT NOT NULL,
    primary_phone   TEXT NOT NULL,
    secondary_phone TEXT,
    reception_phone TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.2.3 Pharmacy Table

```sql
CREATE TABLE pharmacies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    owner_name      TEXT NOT NULL,
    license_id      TEXT NOT NULL UNIQUE,
    gst_number      TEXT,
    drug_license    TEXT,
    address         TEXT NOT NULL,
    contact         TEXT NOT NULL,
    owner_birth_date DATE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Feature Specifications

### 4.1 Main Dashboard

#### 4.1.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ┌─────────┐   SURATPHARMA ANALYTICS            🔔 Notifications  ⚙️   │
│  │  LOGO   │                                                            │
├──┴─────────┴────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│   │   👨‍⚕️        │    │   🏥        │    │   💊        │                 │
│   │  DOCTORS    │    │  HOSPITALS  │    │  PHARMACY   │                 │
│   │             │    │             │    │   STORES    │                 │
│   │   125       │    │    48       │    │    312      │                 │
│   └─────────────┘    └─────────────┘    └─────────────┘                 │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  📊 UPLOAD EXCEL FOR ANALYTICS                    [Browse] [⬆️] │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    ANALYTICS DASHBOARD                           │   │
│   │  ┌─────────────────────┐  ┌─────────────────────────────────┐   │   │
│   │  │   TOP 10 DOCTORS    │  │      REVENUE BY PHARMACY        │   │   │
│   │  │   BY REVENUE        │  │         (PIE CHART)             │   │   │
│   │  │   ───────────────   │  │                                 │   │   │
│   │  │   1. Dr. Amit ₹30L  │  │            ████                 │   │   │
│   │  │   2. Dr. Priya ₹25L │  │          ██░░░░██               │   │   │
│   │  │   3. Dr. Raj ₹22L   │  │        ██░░░░░░░░██             │   │   │
│   │  └─────────────────────┘  └─────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌───────────────────────────────────────────────────────────────┐     │
│   │  📥 DOWNLOAD REPORT   [Weekly] [Monthly] [Quarterly] [Custom] │     │
│   └───────────────────────────────────────────────────────────────┘     │
│                                                                          │
│   ┌───────────────────────────────────────────────────────────────┐     │
│   │  📜 HISTORY                                                    │     │
│   │  ├── 📄 Sales_Jan_2026.xlsx  (Jan 15, 2026)           [🗑️]    │     │
│   │  ├── 📄 Sales_Dec_2025.xlsx  (Dec 20, 2025)           [🗑️]    │     │
│   │  └── 📄 Sales_Nov_2025.xlsx  (Nov 18, 2025)           [🗑️]    │     │
│   └───────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Doctor Management Module

#### 4.2.1 Doctor List View

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    DOCTORS                                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [+ Add Doctor]     🔍 [_Search doctors..._____________] [Filter ▼]     │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  ┌─────────┐                                                       │  │
│  │  │  👨‍⚕️     │  Dr. Amit Trivedi                                    │  │
│  │  │         │  Orthopedic Surgeon                                   │  │
│  │  └─────────┘  📱 +91 98765 43210  📍 Surat                        │  │
│  │               🏥 Happy Clinic + 7 hospitals         [✏️] [🗑️]     │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  ┌─────────┐                                                       │  │
│  │  │  👩‍⚕️     │  Dr. Priya Shah                                      │  │
│  │  │         │  Cardiologist                                         │  │
│  │  └─────────┘  📱 +91 98765 12345  📍 Surat                        │  │
│  │               🏥 3 hospitals                        [✏️] [🗑️]     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Showing 1-10 of 125 doctors                    [◀] [1] [2] [3] [▶]     │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Add Doctor Wizard (3-Step Modal)

**Step 1: Basic Information (Required)**

```
┌─────────────────────────────────────────────────────────────────┐
│  ADD NEW DOCTOR                                            [✕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1 of 3: Basic Information                                 │
│  ═══════●───────────────────────────────────────────────        │
│                                                                  │
│  Full Name *                                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Contact Number *                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ +91                                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Address *                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│                                          [Cancel]  [Next →]      │
└─────────────────────────────────────────────────────────────────┘
```

**Step 2: Personal Details (Optional - Can Skip)**

```
┌─────────────────────────────────────────────────────────────────┐
│  ADD NEW DOCTOR                                            [✕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 2 of 3: Personal Details (Optional)                       │
│  ─────────────═══════●──────────────────────────────────        │
│                                                                  │
│  Date of Birth                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📅 DD/MM/YYYY                                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Marital Status                                                  │
│  ○ Single    ● Married                                          │
│                                                                  │
│  ┌─ If Married ──────────────────────────────────────────────┐  │
│  │  Spouse Name                                               │  │
│  │  ┌───────────────────────────────────────────────────┐    │  │
│  │  │                                                    │    │  │
│  │  └───────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  │  Anniversary Date                                          │  │
│  │  ┌───────────────────────────────────────────────────┐    │  │
│  │  │ 📅 DD/MM/YYYY                                      │    │  │
│  │  └───────────────────────────────────────────────────┘    │  │
│  │                                                            │  │
│  │  Number of Children                                        │  │
│  │  ┌─────┐                                                   │  │
│  │  │  2  │  [−] [+]                                          │  │
│  │  └─────┘                                                   │  │
│  │  Child 1: ┌────────────────────────────────────┐           │  │
│  │           │                                     │           │  │
│  │           └────────────────────────────────────┘           │  │
│  │  Child 2: ┌────────────────────────────────────┐           │  │
│  │           │                                     │           │  │
│  │           └────────────────────────────────────┘           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                          [← Back]  [Skip]  [Next →]              │
└─────────────────────────────────────────────────────────────────┘
```

**Step 3: Professional Details (Required)**

```
┌─────────────────────────────────────────────────────────────────┐
│  ADD NEW DOCTOR                                            [✕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 3 of 3: Professional Details                              │
│  ──────────────────────────────────═══════●─────────────        │
│                                                                  │
│  Qualification *                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ MBBS, MD, MS, etc.                                ▼     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Specialization *                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Select specialization...                           ▼     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Common Specializations:                                         │
│  [Orthopedic] [Cardiologist] [Neurologist] [Pediatrician]       │
│  [Dermatologist] [ENT] [Ophthalmologist] [General Physician]    │
│                                                                  │
│                                                                  │
│                               [← Back]  [Save Doctor ✓]          │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.2.3 Doctor Profile Detail View

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Doctors    DR. AMIT TRIVEDI                    [✏️] [🗑️]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ┌─────────────┐                                                 │    │
│  │  │             │   Dr. Amit Trivedi                              │    │
│  │  │    👨‍⚕️       │   Orthopedic Surgeon                            │    │
│  │  │             │   MBBS, MS (Ortho)                              │    │
│  │  └─────────────┘                                                 │    │
│  │                                                                   │    │
│  │  📱 +91 98765 43210                                              │    │
│  │  📍 123, Medical Complex, Ring Road, Surat - 395001              │    │
│  │  🎂 15 March 1975 (Age: 50)                                      │    │
│  │  💒 Married to Mrs. Priya Trivedi | Anniversary: 20 Jan          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  [Profile] [Linked Hospitals] [Revenue Analytics] [Visit Log]   │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                   │    │
│  │  LINKED HOSPITALS & CLINICS                    [+ Link Hospital] │    │
│  │                                                                   │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │ 🏥 Happy Clinic                              OWNER          │  │    │
│  │  │    Ring Road, Surat                                         │  │    │
│  │  │    Nearby Pharmacies: MedPlus, Apollo, HealthMart           │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  │                                                                   │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │ 🏥 City Hospital                             VISITING       │  │    │
│  │  │    Adajan, Surat | Visits: Mon, Wed, Fri                    │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  │                                                                   │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │ 🏥 Sterling Hospital                         VISITING       │  │    │
│  │  │    Udhna, Surat | Visits: Tue, Thu, Sat                     │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  │                                                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Hospital Management Module

#### 4.3.1 Hospital List View

Similar grid layout as Doctor list with:

- Hospital name
- Address
- Contact numbers
- Number of linked doctors
- Edit/Delete actions

#### 4.3.2 Add Hospital (Single-Step Form)

```
┌─────────────────────────────────────────────────────────────────┐
│  ADD NEW HOSPITAL                                          [✕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Hospital/Clinic Name *                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Address *                                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Primary Contact Number *                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ +91                                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Secondary Contact Number                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ +91                                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Reception Number                                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ +91                                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│                                    [Cancel]  [Save Hospital ✓]   │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3.3 Hospital Detail View

- Basic hospital info
- List of linked doctors (with option to add new link)
- Requirement: Doctor must exist before linking

### 4.4 Pharmacy Management Module

#### 4.4.1 Pharmacy Registration Fields

| Field               | Type | Required |
| ------------------- | ---- | -------- |
| Pharmacy Name       | Text | ✓        |
| Owner Name          | Text | ✓        |
| License ID          | Text | ✓        |
| GST Number          | Text |          |
| Drug License Number | Text |          |
| Address             | Text | ✓        |
| Contact Number      | Text | ✓        |
| Owner Birth Date    | Date |          |

#### 4.4.2 Pharmacy Detail View

- Basic pharmacy info
- Linked nearby hospitals
- Option to add hospital linkage
- Through hospital links, shows indirect doctor connections

### 4.5 Analytics Engine

#### 4.5.1 Excel Upload Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. USER UPLOADS EXCEL                                          │
│     │                                                            │
│     ▼                                                            │
│  2. COMPUTE FILE HASH (SHA-256)                                 │
│     │                                                            │
│     ├──→ Hash exists in DB? ──→ BLOCK (Duplicate detected)     │
│     │                                                            │
│     ▼                                                            │
│  3. PYTHON ENGINE PARSES EXCEL                                  │
│     • Extract: Pharmacy name, Product, Quantity, Amount, Date   │
│     │                                                            │
│     ▼                                                            │
│  4. MAP DATA TO ENTITIES                                        │
│     • Pharmacy → Hospital (via hospital_pharmacy table)         │
│     • Hospital → Doctor (via doctor_hospital table)             │
│     │                                                            │
│     ▼                                                            │
│  5. COMPUTE REVENUE ATTRIBUTION                                 │
│     • Aggregate by Doctor                                        │
│     • Break down by Pharmacy                                     │
│     │                                                            │
│     ▼                                                            │
│  6. STORE IN ANALYTICS_CACHE                                    │
│     │                                                            │
│     ▼                                                            │
│  7. RENDER DASHBOARD                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.5.2 Revenue Attribution Algorithm

```python
# Pseudocode
for each sale_record in excel_data:
    pharmacy = match_pharmacy(sale_record.pharmacy_name)
    if pharmacy:
        hospitals = get_linked_hospitals(pharmacy.id)
        for hospital in hospitals:
            doctors = get_linked_doctors(hospital.id)
            for doctor in doctors:
                # Attribute revenue proportionally
                revenue_share = sale_record.amount / len(doctors)
                update_doctor_revenue(doctor.id, revenue_share, pharmacy.id)
```

#### 4.5.3 Analytics Dashboard Components

| Component              | Description                            |
| ---------------------- | -------------------------------------- |
| **Top 10 Doctors**     | Ranked list by total revenue           |
| **Revenue Pie Chart**  | Pharmacy contribution breakdown        |
| **Revenue Bar Chart**  | Monthly/quarterly trends               |
| **Doctor Detail Card** | Individual doctor's pharmacy breakdown |
| **Period Selector**    | Weekly/Monthly/Quarterly/Yearly/Custom |

### 4.6 Report Generation

#### 4.6.1 Report Contents

- Executive Summary
- Top Performers (Doctors)
- Revenue by Pharmacy
- Revenue by Hospital
- Detailed Transaction Log
- Charts and Graphs (embedded)
- Period-specific comparison (if applicable)

#### 4.6.2 Export Options

- Weekly Report
- Monthly Report
- Quarterly Report (3 months)
- Semi-Annual Report (6 months)
- Yearly Report
- Custom Date Range

### 4.7 History & Snapshots

#### 4.7.1 History Storage

Each Excel upload creates a snapshot:

- Original file reference
- Computed analytics data
- Timestamp
- Record count
- Date range covered

#### 4.7.2 History Actions

- **View**: Reload dashboard with historical data
- **Delete**: Remove snapshot and associated analytics

### 4.8 Notifications System

#### 4.8.1 Event Types

| Event       | Entity         | Trigger                   |
| ----------- | -------------- | ------------------------- |
| Birthday    | Doctor         | DOB matches today         |
| Birthday    | Pharmacy Owner | DOB matches today         |
| Anniversary | Doctor         | Anniversary matches today |

#### 4.8.2 Notification Center

```
┌─────────────────────────────────────────────────────────────────┐
│  🔔 NOTIFICATIONS                                          [✕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TODAY                                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🎂 Dr. Amit Trivedi's Birthday Today!                     │  │
│  │    Send wishes to: +91 98765 43210                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  THIS WEEK                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 💒 Dr. Priya Shah's Anniversary on Feb 12                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🎂 MedPlus Pharmacy Owner Birthday on Feb 14              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Search Implementation

### 5.1 Search Algorithm

Using **Fuse.js** for fuzzy search:

- Configurable threshold for matching
- Multi-field search (name, contact, address)
- Highlighting of matched terms
- Real-time results as user types

### 5.2 Search Configuration

```javascript
const fuseOptions = {
  keys: ["name", "contact", "address", "specialization"],
  threshold: 0.3,
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
};
```

---

## 6. UI/UX Guidelines

### 6.1 Color Palette

| Purpose        | Color      | Hex     |
| -------------- | ---------- | ------- |
| Primary        | Blue       | #2563EB |
| Secondary      | Green      | #10B981 |
| Background     | White      | #FFFFFF |
| Surface        | Light Gray | #F3F4F6 |
| Text Primary   | Dark Gray  | #1F2937 |
| Text Secondary | Gray       | #6B7280 |
| Success        | Green      | #22C55E |
| Warning        | Amber      | #F59E0B |
| Error          | Red        | #EF4444 |

### 6.2 Typography

- **Font Family**: Inter (Google Fonts)
- **Headings**: 600 weight, #1F2937
- **Body**: 400 weight, #374151
- **Captions**: 400 weight, #6B7280

### 6.3 Design Principles

1. **Simplicity First**: Minimal cognitive load
2. **Consistency**: Same patterns across modules
3. **Feedback**: Clear loading states, success/error messages
4. **Accessibility**: Large touch targets, readable fonts

---

## 7. Data Flow Diagrams

### 7.1 Doctor-Hospital-Pharmacy Relationship

```
┌──────────┐         ┌──────────────┐         ┌──────────┐
│  DOCTOR  │←───────→│   HOSPITAL   │←───────→│ PHARMACY │
└──────────┘ OWNS/   └──────────────┘  NEARBY  └──────────┘
             VISITS                     LINKED

Revenue flows: Pharmacy → Hospital → Doctor

Example:
Dr. Amit ←→ Happy Clinic (Owner) ←→ [MedPlus, Apollo, HealthMart]
Dr. Amit ←→ City Hospital (Visiting) ←→ [CureWell, PharmaOne]
```

### 7.2 Analytics Data Flow

```
              ┌─────────────┐
              │ Excel File  │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │   Parser    │
              │  (Python)   │
              └──────┬──────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
┌─────▼─────┐ ┌──────▼──────┐ ┌─────▼─────┐
│  Pharmacy │ │   Revenue   │ │   Date    │
│  Matching │ │ Attribution │ │   Range   │
└─────┬─────┘ └──────┬──────┘ └─────┬─────┘
      │              │              │
      └──────────────┼──────────────┘
                     │
              ┌──────▼──────┐
              │  Analytics  │
              │    Cache    │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  Dashboard  │
              │   Render    │
              └─────────────┘
```

---

## 8. Security Considerations

### 8.1 Local-Only Security

- No network authentication required
- All data stored locally in SQLite
- File-based encryption for sensitive data (optional)
- No internet connectivity required for core features

### 8.2 Data Integrity

- Foreign key constraints enforced
- Transaction-based operations
- Automatic backup before destructive operations

---

## 9. Performance Targets

| Metric                      | Target       |
| --------------------------- | ------------ |
| App Launch                  | < 3 seconds  |
| Search Response             | < 100ms      |
| List Load (100 items)       | < 500ms      |
| Excel Processing (10K rows) | < 5 seconds  |
| Report Generation           | < 10 seconds |
| Dashboard Render            | < 1 second   |

---

## 10. Deployment

### 10.1 Installer Package

- Windows NSIS installer (.exe)
- Bundled Python runtime
- SQLite included
- Desktop shortcut creation
- Start menu entry

### 10.2 Updates

- Manual update via new installer download
- Version checking (optional future feature)

---

## 11. Future Enhancements (Post-MVP)

1. **Cloud Backup**: Optional sync to cloud storage
2. **Multi-User**: Role-based access for assistants
3. **WhatsApp Integration**: Send birthday messages
4. **Mobile Companion**: View-only mobile app
5. **Predictive Analytics**: Revenue forecasting with ML
6. **Inventory Tracking**: Product-level analytics
7. **Migration to Java/Swing**: If performance optimization needed

---

_Document Version: 1.0_
_Last Updated: February 9, 2026_
_Project: SuratPharma Analytics Platform_
