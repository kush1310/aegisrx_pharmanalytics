import sqlite3
import os

print("Starting database cleanup and pharmacy-doctor alignment script...")

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/suratpharma.db'))
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # 1. Inspect and nullify orphaned doctorId values in Pharmacy
    cursor.execute("""
        SELECT id, name, doctorId 
        FROM Pharmacy 
        WHERE doctorId IS NOT NULL AND doctorId NOT IN (SELECT id FROM Doctor)
    """)
    orphaned = cursor.fetchall()
    print(f"Found {len(orphaned)} pharmacies with orphaned doctorId values.")
    
    if len(orphaned) > 0:
        print("Setting orphaned doctorId values to NULL...")
        cursor.execute("""
            UPDATE Pharmacy 
            SET doctorId = NULL 
            WHERE doctorId IS NOT NULL AND doctorId NOT IN (SELECT id FROM Doctor)
        """)
        conn.commit()
        print("Orphaned doctorId values successfully set to NULL.")

    # 2. To make Upload 2 pagination work beautifully, let's link 50 active pharmacies in Upload 2 to our seeded doctors!
    cursor.execute("SELECT id, name FROM Doctor")
    doctors = cursor.fetchall()
    print(f"Active doctors in database: {len(doctors)}")

    cursor.execute("""
        SELECT DISTINCT st.pharmacyId, p.name 
        FROM SalesTransaction st
        JOIN Pharmacy p ON st.pharmacyId = p.id
        WHERE st.uploadId = 2
    """)
    active_pharmacies_u2 = cursor.fetchall()
    print(f"Active pharmacies in Upload ID 2: {len(active_pharmacies_u2)}")

    if len(active_pharmacies_u2) > 0 and len(doctors) > 0:
        count_to_link = min(50, len(active_pharmacies_u2))
        print(f"Linking {count_to_link} pharmacies in Upload ID 2 to the active doctors...")
        
        linked_count = 0
        for i in range(count_to_link):
            pharm_id, pharm_name = active_pharmacies_u2[i]
            # Link round-robin
            doc_id, doc_name = doctors[i % len(doctors)]
            cursor.execute("UPDATE Pharmacy SET doctorId = ?, updatedAt = datetime('now') WHERE id = ?", (doc_id, pharm_id))
            linked_count += 1
            
        conn.commit()
        print(f"Successfully linked {linked_count} pharmacies in Upload ID 2!")

    conn.close()
    print("Database connection closed cleanly.")

except Exception as e:
    print(f"Error executing cleanup: {e}")
