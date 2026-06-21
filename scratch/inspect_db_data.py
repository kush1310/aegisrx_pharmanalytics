import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/suratpharma.db'))
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get all uploads
cursor.execute("SELECT id, fileName, uploadDate FROM ExcelUpload")
uploads = cursor.fetchall()
print("=== UPLOADS IN DATABASE ===")
for u in uploads:
    print(f"ID: {u[0]}, Name: {u[1]}, Date: {u[2]}")

print("\n=== TOTALS BY UPLOAD ID IN SALESTRANSACTION ===")
cursor.execute("""
    SELECT uploadId, COUNT(*), SUM(amount), SUM(saleQty)
    FROM SalesTransaction
    GROUP BY uploadId
""")
for r in cursor.fetchall():
    print(f"Upload ID: {r[0]}, Count: {r[1]}, Total Amount: {r[2]}, Total Qty: {r[3]}")

# Inspect active pharmacies with doctorId for each upload
for u in uploads:
    u_id = u[0]
    cursor.execute("""
        SELECT COUNT(DISTINCT st.pharmacyId)
        FROM SalesTransaction st
        WHERE st.uploadId = ?
    """, (u_id,))
    total_pharms = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(DISTINCT st.pharmacyId)
        FROM SalesTransaction st
        JOIN Pharmacy p ON st.pharmacyId = p.id
        WHERE st.uploadId = ? AND p.doctorId IS NOT NULL
    """, (u_id,))
    linked_pharms = cursor.fetchone()[0]

    cursor.execute("""
        SELECT COUNT(DISTINCT p.doctorId)
        FROM SalesTransaction st
        JOIN Pharmacy p ON st.pharmacyId = p.id
        WHERE st.uploadId = ? AND p.doctorId IS NOT NULL
    """, (u_id,))
    linked_docs = cursor.fetchone()[0]

    cursor.execute("""
        SELECT SUM(st.amount)
        FROM SalesTransaction st
        JOIN Pharmacy p ON st.pharmacyId = p.id
        WHERE st.uploadId = ? AND p.doctorId IS NULL
    """, (u_id,))
    unlinked_amt = cursor.fetchone()[0] or 0.0

    cursor.execute("""
        SELECT SUM(st.amount)
        FROM SalesTransaction st
        JOIN Pharmacy p ON st.pharmacyId = p.id
        WHERE st.uploadId = ? AND p.doctorId IS NOT NULL
    """, (u_id,))
    linked_amt = cursor.fetchone()[0] or 0.0

    print(f"\nUpload ID {u_id} Details:")
    print(f"  Total Pharmacies: {total_pharms}")
    print(f"  Linked Pharmacies: {linked_pharms}")
    print(f"  Linked Doctors with sales: {linked_docs}")
    print(f"  Unlinked Revenue: {unlinked_amt}")
    print(f"  Linked Revenue: {linked_amt}")
    print(f"  Summed Revenue: {unlinked_amt + linked_amt}")

conn.close()
