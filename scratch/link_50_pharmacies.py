import sqlite3
import os

print("Starting python pharmacy-doctor linking script (targeted)...")

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/suratpharma.db'))
print(f"Connecting to database at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Fetch doctors
    cursor.execute("SELECT id, name FROM Doctor")
    doctors = cursor.fetchall()
    print(f"Found {len(doctors)} doctors in database.")

    # 2. Fetch pharmacies that have active sales in uploadId = 4 (or whatever active uploads exist)
    cursor.execute("""
        SELECT DISTINCT st.pharmacyId, p.name 
        FROM SalesTransaction st
        JOIN Pharmacy p ON st.pharmacyId = p.id
        WHERE st.uploadId = 4
    """)
    active_pharmacies = cursor.fetchall()
    print(f"Found {len(active_pharmacies)} pharmacies with active transactions in uploadId = 4.")

    if len(active_pharmacies) == 0:
        print("No active transactions in uploadId = 4. Fetching active pharmacies across all uploads.")
        cursor.execute("""
            SELECT DISTINCT st.pharmacyId, p.name 
            FROM SalesTransaction st
            JOIN Pharmacy p ON st.pharmacyId = p.id
        """)
        active_pharmacies = cursor.fetchall()

    # 3. Link up to 50 active pharmacies to random doctors
    count_to_link = min(50, len(active_pharmacies))
    print(f"Linking {count_to_link} target pharmacies to realistic doctors...")

    linked_count = 0
    for i in range(count_to_link):
        pharm_id, pharm_name = active_pharmacies[i]
        # Assign doctor round-robin
        doc_id, doc_name = doctors[i % len(doctors)]
        cursor.execute("UPDATE Pharmacy SET doctorId = ?, updatedAt = datetime('now') WHERE id = ?", (doc_id, pharm_id))
        linked_count += 1

    conn.commit()
    print(f"\n--- TARGETED PHARMACY LINKING SUCCESSFUL ---")
    print(f"Successfully linked {linked_count} active pharmacies to {len(doctors)} doctors!")

    # Show a small sample of the links
    cursor.execute("""
        SELECT p.name as pharmacyName, d.name as doctorName
        FROM Pharmacy p
        JOIN Doctor d ON p.doctorId = d.id
        LIMIT 10
    """)
    sample = cursor.fetchall()

    print('\nSample Links Established (First 10):')
    for idx, row in enumerate(sample):
        print(f"{idx + 1}. [Pharmacy] {row[0]} ---> [Doctor] {row[1]}")
    print('------------------------------------\n')

    conn.close()
    print("Database connection closed cleanly.")

except Exception as err:
    print(f"Error linking pharmacies: {err}")
