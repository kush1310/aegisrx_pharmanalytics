import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/suratpharma.db'))
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check total pharmacies and doctors
cursor.execute("SELECT COUNT(*) FROM Pharmacy")
print(f"Total Pharmacies: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(*) FROM Pharmacy WHERE doctorId IS NOT NULL")
print(f"Pharmacies with linked doctorId: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(*) FROM Doctor")
print(f"Total Doctors: {cursor.fetchone()[0]}")

cursor.execute("SELECT COUNT(*) FROM SalesTransaction")
print(f"Total Sales Transactions: {cursor.fetchone()[0]}")

cursor.execute("SELECT DISTINCT uploadId FROM SalesTransaction")
print(f"Upload IDs in SalesTransaction: {[r[0] for r in cursor.fetchall()]}")

# Check sales transactions joined with Pharmacy doctorId for uploadId = 4
cursor.execute("""
    SELECT count(*), sum(st.amount), p.doctorId
    FROM SalesTransaction st
    JOIN Pharmacy p ON st.pharmacyId = p.id
    WHERE st.uploadId = 4
    GROUP BY p.doctorId
""")
print("\nTransactions grouped by Pharmacy.doctorId for uploadId 4:")
for row in cursor.fetchall():
    print(f"Doctor ID: {row[2]}, Count: {row[0]}, Revenue: {row[1]}")

conn.close()
