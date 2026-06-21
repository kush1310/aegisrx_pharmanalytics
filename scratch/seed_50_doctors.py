import sqlite3
import os

print("Starting python 50+ doctor seeding and pharmacy linking script...")

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/suratpharma.db'))
print(f"Connecting to database at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Clear existing seeded doctors to prevent duplicates if needed
    # We can delete doctors where specialization matches our seeded list or just add more.
    # To keep it extremely clean, let's delete doctors first so we have a fresh set of exactly 55 doctors.
    cursor.execute("DELETE FROM Doctor")
    print("Cleared existing Doctor table for fresh seed.")

    # 1. Seed 55 highly realistic, unique doctors
    indian_first_names = [
        "Ramesh", "Anita", "Sanjay", "Krina", "Rajesh", "Meera", "Hiren", "Divya",
        "Sunil", "Priyanka", "Vikram", "Deepa", "Arvind", "Nehal", "Ketan", "Payal",
        "Vijay", "Sonal", "Manoj", "Aarti", "Harish", "Kajal", "Ashok", "Ritu",
        "Dilip", "Nisha", "Prakash", "Gita", "Suresh", "Rekha", "Anil", "Jyoti",
        "Devendra", "Hema", "Sandip", "Komal", "Bharat", "Alpa", "Bhavesh", "Pooja",
        "Nitin", "Shweta", "Jayesh", "Dipti", "Tushar", "Roshni", "Pankaj", "Bijal",
        "Satish", "Varsha", "Ajay", "Usha", "Kishor", "Kiran", "Pradeep"
    ]
    
    surnames = [
        "Patel", "Shah", "Mehta", "Parikh", "Desai", "Joshi", "Naik", "Chawla",
        "Vyas", "Sharma", "Verma", "Trivedi", "Mishra", "Pandya", "Gajiwala", "Kapadia",
        "Sanghavi", "Choksi", "Dave", "Randeria", "Tailor", "Mistry", "Solanki", "Gohil",
        "Zaveri", "Doshi", "Sheth", "Kothari", "Surati", "Marfatia"
    ]
    
    specializations = [
        ("MD", "Cardiologist"),
        ("MBBS, DGO", "Gynecologist"),
        ("MD, DM", "Neurologist"),
        ("MD", "Pediatrician"),
        ("MBBS, MS", "Orthopedic"),
        ("MD", "Dermatologist"),
        ("MD", "General Physician"),
        ("MBBS", "General Practitioner"),
        ("MS", "Ophthalmologist"),
        ("BDS", "Dentist"),
        ("MD", "Oncologist"),
        ("MBBS, DDVL", "Dermatologist"),
        ("MD", "Endocrinologist"),
        ("MD", "Gastroenterologist")
    ]

    doctors_to_seed = []
    # Generate exactly 55 unique doctors
    used_names = set()
    while len(doctors_to_seed) < 55:
        fn = random = indian_first_names[len(doctors_to_seed) % len(indian_first_names)]
        ln = surnames[(len(doctors_to_seed) * 7) % len(surnames)]
        full_name = f"Dr. {fn} {ln}"
        
        if full_name not in used_names:
            used_names.add(full_name)
            contact = f"9{len(doctors_to_seed):09d}"
            address = f"Area {len(doctors_to_seed) % 10 + 1}, Surat"
            qual, spec = specializations[len(doctors_to_seed) % len(specializations)]
            doctors_to_seed.append((full_name, contact, address, qual, spec))

    cursor.executemany("""
        INSERT INTO Doctor (name, contact, address, qualification, specialization, isMarried, childrenCount, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 0, 0, datetime('now'), datetime('now'))
    """, doctors_to_seed)
    conn.commit()

    cursor.execute("SELECT id, name FROM Doctor")
    doctors = cursor.fetchall()
    print(f"Successfully seeded and fetched {len(doctors)} unique doctors.")

    # 2. Fetch pharmacies that have active sales in uploadId = 4
    cursor.execute("""
        SELECT DISTINCT st.pharmacyId, p.name 
        FROM SalesTransaction st
        JOIN Pharmacy p ON st.pharmacyId = p.id
        WHERE st.uploadId = 4
    """)
    active_pharmacies = cursor.fetchall()
    print(f"Found {len(active_pharmacies)} pharmacies with active transactions in uploadId = 4.")

    if len(active_pharmacies) == 0:
        cursor.execute("SELECT id, name FROM Pharmacy LIMIT 300")
        active_pharmacies = cursor.fetchall()

    # 3. Link up to 150 pharmacies to doctors (so we get a beautiful spread across all 55 doctors!)
    count_to_link = min(150, len(active_pharmacies))
    print(f"Linking {count_to_link} pharmacies to our 55 seeded doctors...")

    for i in range(count_to_link):
        pharm_id, pharm_name = active_pharmacies[i]
        # Assign doctors sequentially to ensure at least 50+ doctors get linked and show up in top doctors and doctor ratio table!
        doc_id, doc_name = doctors[i % len(doctors)]
        cursor.execute("UPDATE Pharmacy SET doctorId = ?, updatedAt = datetime('now') WHERE id = ?", (doc_id, pharm_id))

    conn.commit()
    print(f"\n--- Targeted 50+ Doctor Seeding Successful ---")
    print(f"Successfully seeded {len(doctors)} doctors and linked {count_to_link} active pharmacies!")

    # Verify how many unique doctors actually have active sales transactions
    cursor.execute("""
        SELECT COUNT(DISTINCT p.doctorId)
        FROM SalesTransaction st
        JOIN Pharmacy p ON st.pharmacyId = p.id
        WHERE st.uploadId = 4 AND p.doctorId IS NOT NULL
    """)
    active_doc_count = cursor.fetchone()[0]
    print(f"Number of active doctors with sales in uploadId = 4: {active_doc_count}")

    # Show a small sample of the links
    cursor.execute("""
        SELECT p.name as pharmacyName, d.name as doctorName
        FROM Pharmacy p
        JOIN Doctor d ON p.doctorId = d.id
        LIMIT 10
    """)
    sample = cursor.fetchall()

    print('\nSample Links (First 10):')
    for idx, row in enumerate(sample):
        print(f"{idx + 1}. [Pharmacy] {row[0]} ---> [Doctor] {row[1]}")
    print('------------------------------------\n')

    conn.close()

except Exception as err:
    print(f"Error seeding and linking doctors: {err}")
