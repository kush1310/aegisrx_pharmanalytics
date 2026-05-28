# SuratPharma Analytics - Database Entity Relationship Diagram

## Core Entities & Relationships

```mermaid
erDiagram
    DOCTOR ||--o{ DOCTOR_HOSPITAL : "owns/visits"
    HOSPITAL ||--o{ DOCTOR_HOSPITAL : "has"
    HOSPITAL ||--o{ HOSPITAL_PHARMACY : "near"
    PHARMACY ||--o{ HOSPITAL_PHARMACY : "linked"
    EXCEL_UPLOAD ||--o{ ANALYTICS_CACHE : "generates"
    DOCTOR ||--o{ ANALYTICS_CACHE : "has"

    DOCTOR {
        int id PK
        string name "Required"
        string contact "Required"
        string address "Required"
        date birth_date
        boolean is_married
        string spouse_name
        date anniversary
        int children_count
        json children_names
        string qualification "Required"
        string specialization "Required"
        datetime created_at
        datetime updated_at
    }

    HOSPITAL {
        int id PK
        string name "Required"
        string address "Required"
        string primary_phone "Required"
        string secondary_phone
        string reception_phone
        datetime created_at
        datetime updated_at
    }

    PHARMACY {
        int id PK
        string name "Required"
        string owner_name "Required"
        string license_id "Required, Unique"
        string gst_number
        string drug_license
        string address "Required"
        string contact "Required"
        date owner_birth_date
        datetime created_at
        datetime updated_at
    }

    DOCTOR_HOSPITAL {
        int id PK
        int doctor_id FK
        int hospital_id FK
        string relationship_type "OWNER or VISITING"
        datetime created_at
    }

    HOSPITAL_PHARMACY {
        int id PK
        int hospital_id FK
        int pharmacy_id FK
        float distance_km
        datetime created_at
    }

    EXCEL_UPLOAD {
        int id PK
        string file_name
        string file_hash "Unique, SHA-256"
        datetime upload_date
        int record_count
        datetime date_range_start
        datetime date_range_end
        string status
    }

    ANALYTICS_CACHE {
        int id PK
        int upload_id FK
        int doctor_id FK
        float total_revenue
        json pharmacy_breakdown
        datetime computed_at
    }

    NOTIFICATION {
        int id PK
        string entity_type "DOCTOR or PHARMACY_OWNER"
        int entity_id
        string event_type "BIRTHDAY or ANNIVERSARY"
        date event_date
        string title
        string message
        boolean is_read
        datetime created_at
    }
```

---

## Relationship Explanations

### Doctor ↔ Hospital (Many-to-Many)

- A doctor can work at multiple hospitals
- A hospital can have multiple doctors
- Relationship type: **OWNER** (owns the clinic) or **VISITING** (visits the hospital)

### Hospital ↔ Pharmacy (Many-to-Many)

- A hospital can have multiple nearby pharmacies
- A pharmacy can be near multiple hospitals
- Distance in kilometers stored for proximity reference

### Revenue Flow Chain

```
PHARMACY (sells products)
    ↓
HOSPITAL_PHARMACY (nearby linkage)
    ↓
HOSPITAL
    ↓
DOCTOR_HOSPITAL (doctor works here)
    ↓
DOCTOR (revenue attributed)
```

---

## Analytics Data Flow

```mermaid
flowchart TD
    A[Excel File Upload] --> B{Check Hash}
    B -->|Duplicate| C[Block Upload]
    B -->|New File| D[Parse with Pandas]
    D --> E[Extract Sales Data]
    E --> F[Match Pharmacies]
    F --> G[Find Linked Hospitals]
    G --> H[Find Linked Doctors]
    H --> I[Calculate Revenue Attribution]
    I --> J[Store in ANALYTICS_CACHE]
    J --> K[Render Dashboard Charts]
    J --> L[Create History Entry]
```

---

## Sample Data Flow Example

**Scenario**: Dr. Amit Trivedi's revenue calculation

1. **Dr. Amit** owns **Happy Clinic** and visits **City Hospital**, **Sterling Hospital**
2. **Happy Clinic** is near pharmacies: **MedPlus**, **Apollo Pharmacy**
3. **City Hospital** is near: **HealthMart**, **1mg Store**
4. **Sterling Hospital** is near: **CureWell Pharmacy**

**When Excel shows sales from MedPlus**:

- MedPlus → Happy Clinic → Dr. Amit
- Revenue attributed to Dr. Amit from MedPlus

**Total Revenue Report**:

```
Dr. Amit Trivedi: ₹30,00,000
├── MedPlus:        ₹12,00,000 (40%)
├── Apollo:         ₹8,00,000  (27%)
├── HealthMart:     ₹5,00,000  (17%)
├── 1mg Store:      ₹3,00,000  (10%)
└── CureWell:       ₹2,00,000  (6%)
```

---

## Key Constraints

| Table               | Constraint                                                     | Purpose                            |
| ------------------- | -------------------------------------------------------------- | ---------------------------------- |
| `doctors`           | name, contact, address, qualification, specialization NOT NULL | Ensure core data present           |
| `pharmacies`        | license_id UNIQUE                                              | Prevent duplicate pharmacy entries |
| `excel_uploads`     | file_hash UNIQUE                                               | Prevent duplicate file processing  |
| `doctor_hospital`   | (doctor_id, hospital_id) UNIQUE                                | One link per pair                  |
| `hospital_pharmacy` | (hospital_id, pharmacy_id) UNIQUE                              | One link per pair                  |

---

## Indexes for Performance

```sql
-- Fast lookups
CREATE INDEX idx_doctor_name ON doctors(name);
CREATE INDEX idx_hospital_name ON hospitals(name);
CREATE INDEX idx_pharmacy_name ON pharmacies(name);
CREATE INDEX idx_pharmacy_license ON pharmacies(license_id);

-- Relationship queries
CREATE INDEX idx_dh_doctor ON doctor_hospital(doctor_id);
CREATE INDEX idx_dh_hospital ON doctor_hospital(hospital_id);
CREATE INDEX idx_hp_hospital ON hospital_pharmacy(hospital_id);
CREATE INDEX idx_hp_pharmacy ON hospital_pharmacy(pharmacy_id);

-- Analytics queries
CREATE INDEX idx_analytics_upload ON analytics_cache(upload_id);
CREATE INDEX idx_analytics_doctor ON analytics_cache(doctor_id);

-- Notification scheduling
CREATE INDEX idx_notification_date ON notifications(event_date);
CREATE INDEX idx_notification_read ON notifications(is_read);
```

---

_Database Design Document for SuratPharma Analytics_
