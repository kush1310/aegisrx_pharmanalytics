import sqlite3
import os
from datetime import datetime

# Path to database
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../data/suratpharma.db'))
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get today's month and day, and format dates
today = datetime.now()
today_date_str = today.strftime("%Y-%m-%d") # e.g. 2026-06-11
other_date_str = "2020-05-15"

print("--- Testing Hospital Anniversary Notifications ---")
print(f"Today's date for testing: {today_date_str}")

# Find first doctor
cursor.execute("SELECT id, name FROM Doctor LIMIT 1")
doc = cursor.fetchone()

if not doc:
    print("No doctors found in database to test with.")
    conn.close()
    exit(1)

doc_id, doc_name = doc
print(f"Target Doctor: {doc_name} (ID: {doc_id})")

# Update doctor with multiple hospitals
hospitals_count = 2
hospital_names = '["City Heart General", "Metro Health Clinic"]'
hospital_opening_dates = f'["{today_date_str}", "{other_date_str}"]'

cursor.execute("""
    UPDATE Doctor 
    SET hospitalsCount = ?, hospitalNames = ?, hospitalOpeningDates = ?
    WHERE id = ?
""", (hospitals_count, hospital_names, hospital_opening_dates, doc_id))

# Clear existing notifications and dismissals for this doctor's hospital opening to allow clean testing
cursor.execute("""
    DELETE FROM Notification 
    WHERE entityId = ? AND entityType = 'DOCTOR' AND eventType LIKE 'HOSPITAL_OPENING%'
""", (doc_id,))

cursor.execute("""
    DELETE FROM DismissedNotification 
    WHERE entityId = ? AND entityType = 'DOCTOR' AND eventType LIKE 'HOSPITAL_OPENING%'
""", (doc_id,))

conn.commit()

# Verify state
cursor.execute("SELECT hospitalsCount, hospitalNames, hospitalOpeningDates FROM Doctor WHERE id = ?", (doc_id,))
updated = cursor.fetchone()
print("\n--- Verified DB State ---")
print(f"Doctor ID: {doc_id}")
print(f"Hospitals Count: {updated[0]}")
print(f"Hospital Names: {updated[1]}")
print(f"Hospital Opening Dates: {updated[2]}")
print("\nSuccess! Database has been prepped for manual testing.")
print("To trigger the notification checking:")
print("1. Go to the Notifications page in the app UI.")
print("2. Click 'Check Events'.")
print("3. Verify that the anniversary notification for 'City Heart General' is triggered and displays under the 'Anniversaries' tab.")

conn.close()
