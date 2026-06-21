import urllib.request
import json
import sqlite3
import os

print("--- Step 1: Logging in to get Auth Token ---")
token = None
try:
    login_data = json.dumps({
        "email": "admin@aegisrx.com",
        "password": "Admin@1234"
    }).encode('utf-8')
    
    req = urllib.request.Request(
        "http://localhost:3001/api/auth/login", 
        data=login_data, 
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        if res_data.get("success") and "data" in res_data:
            token = res_data["data"]["token"]
            print("Successfully authenticated and received JWT token.")
        else:
            print(f"Login failed: {res_data}")
except Exception as e:
    print(f"Failed to log in: {e}")

if not token:
    print("Could not proceed without token.")
    exit(1)

print("\n--- Step 2: Triggering Event Checking ---")
try:
    req = urllib.request.Request(
        "http://localhost:3001/api/notifications/check-events", 
        data=b"{}", 
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    with urllib.request.urlopen(req) as response:
        res_data = response.read().decode('utf-8')
        print(f"API Response: {res_data}")
except Exception as e:
    print(f"Failed to trigger API: {e}")

print("\n--- Step 3: Reading Notifications from Database ---")
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/suratpharma.db'))
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("""
    SELECT id, entityId, eventType, title, message, isRead, createdAt 
    FROM Notification 
    ORDER BY id DESC LIMIT 5
""")
rows = cursor.fetchall()

print("Latest Notifications in DB:")
for r in rows:
    print(f"ID: {r[0]} | Doctor ID: {r[1]} | Type: {r[2]}")
    print(f"  Title: {r[3]}")
    print(f"  Message: {r[4]}")
    print(f"  Read: {r[5]} | Created At: {r[6]}\n")

# Specifically check if we got HOSPITAL_OPENING_0
cursor.execute("""
    SELECT COUNT(*) FROM Notification 
    WHERE entityId = 4 AND eventType = 'HOSPITAL_OPENING_0'
""")
count = cursor.fetchone()[0]
if count > 0:
    print("SUCCESS: HOSPITAL_OPENING_0 notification successfully generated in the database!")
else:
    print("WARNING: HOSPITAL_OPENING_0 notification not found in the database. Please verify backend execution.")

conn.close()
