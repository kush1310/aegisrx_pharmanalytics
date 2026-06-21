import urllib.request
import urllib.error
import json
import sqlite3
import os
import random

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
            print("Successfully authenticated.")
        else:
            print(f"Login failed: {res_data}")
except Exception as e:
    print(f"Failed to log in: {e}")

if not token:
    print("Could not proceed without token.")
    exit(1)

random_suffix = random.randint(1000, 9999)
pharmacy_payload = {
    "name": f"Test Pharmacy {random_suffix}",
    "ownerName": "Test Owner",
    "licenseId": "",  # Testing optional / empty license ID
    "address": "123 Test Street, Surat",
    "contact": "9988776655", # Correct 10-digit format
    "gstNumber": None,
    "drugLicense": None,
    "ownerBirthDate": None,
    "doctorId": None
}

print(f"\n--- Step 2: POSTing Pharmacy without License ID (Payload: {pharmacy_payload['name']}) ---")
created_id = None
try:
    post_data = json.dumps(pharmacy_payload).encode('utf-8')
    req = urllib.request.Request(
        "http://localhost:3001/api/pharmacies", 
        data=post_data, 
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        print(f"API Response: {res_data}")
        if res_data.get("success"):
            created_id = res_data["data"]["id"]
            print(f"SUCCESS: Pharmacy created with ID {created_id}!")
        else:
            print(f"ERROR: Failed to create pharmacy: {res_data.get('error')}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    try:
        error_body = e.read().decode('utf-8')
        print(f"Error Body: {error_body}")
    except Exception as read_err:
        print(f"Failed to read error body: {read_err}")
except Exception as e:
    print(f"Request failed: {e}")

if not created_id:
    exit(1)

print("\n--- Step 3: Inspecting Database for the Generated License ID ---")
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/suratpharma.db'))
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("""
    SELECT id, name, licenseId 
    FROM Pharmacy 
    WHERE id = ?
""", (created_id,))
row = cursor.fetchone()

if row:
    print(f"DB Record -> ID: {row[0]}, Name: {row[1]}, License ID: {row[2]}")
    if row[2].startswith("AUTO-"):
        print("SUCCESS: Auto-generated unique license ID successfully verified in database!")
    else:
        print(f"WARNING: License ID is '{row[2]}' which does not start with 'AUTO-'.")
else:
    print("ERROR: Row not found in database.")

# Clean up
cursor.execute("DELETE FROM Pharmacy WHERE id = ?", (created_id,))
conn.commit()
print("Cleaned up test pharmacy from database.")

conn.close()
