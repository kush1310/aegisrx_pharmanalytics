import urllib.request
import json
import sqlite3
import os

print("--- Authenticating to get token ---")
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
        res = json.loads(response.read().decode('utf-8'))
        token = res["data"]["token"]
except Exception as e:
    print(f"Auth failed: {e}")
    exit(1)

# Find upload ID from DB that has transactions
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/suratpharma.db'))
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT uploadId FROM SalesTransaction GROUP BY uploadId HAVING COUNT(*) > 0 LIMIT 1")
row = cursor.fetchone()
conn.close()

if not row:
    print("No sales uploads found in DB.")
    exit(1)

upload_id = row[0]
print(f"Testing with Sales Upload ID: {upload_id}")

try:
    req = urllib.request.Request(
        f"http://localhost:3001/api/excel/pandas-analytics?uploadId={upload_id}",
        headers={
            'Authorization': f'Bearer {token}'
        }
    )
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print("API Response Success:", res_data.get("success"))
        if not res_data.get("success"):
            print("Error Details:", res_data.get("error"))
        else:
            data = res_data.get("data", {})
            print("Keys in data:", list(data.keys()))
            for key in data:
                print(f"\n--- {key} (Top 3 rows) ---")
                rows = data[key]
                print(f"Total rows: {len(rows)}")
                for r in rows[:3]:
                    print(r)
except Exception as e:
    print(f"Failed to hit endpoint: {e}")
