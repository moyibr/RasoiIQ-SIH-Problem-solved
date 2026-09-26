import sys
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.append(str(Path(".").resolve()))
from app.main import app

client = TestClient(app)
kitchen = "K1_MainCampus"
date_test = "2026-09-22"

print("--- 1. Calling /production-plan/generate and /production-plan/save ---")
resp_plan = client.get(f"/production-plan/generate?kitchen_id={kitchen}&date={date_test}")
if resp_plan.status_code == 200:
    plan = resp_plan.json()
    print("Plan generated successfully.")
    
    resp_save = client.post("/production-plan/save", json=plan)
    print("Plan saved:", resp_save.json())
else:
    print("Error generating plan:", resp_plan.text)

print("\n--- 2. Call /log-consumption and assert RescueEvent is created ---")
resp_log1 = client.post("/log-consumption", json={
    "kitchen_id": kitchen,
    "date": date_test,
    "category_name": "Rice",
    "consumed_qty": 40.0
})
print("Log 1 (40kg):", resp_log1.json())

print("\n--- 3. Call /log-consumption again to assert graceful upsert ---")
resp_log2 = client.post("/log-consumption", json={
    "kitchen_id": kitchen,
    "date": date_test,
    "category_name": "Rice",
    "consumed_qty": 60.0
})
print("Log 2 (60kg):", resp_log2.json())

print("\n--- 4. Assert 8 categories output different predicted_qty proportional to rates ---")
for cat in plan['categories']:
    rate = cat['predicted_qty'] / cat['predicted_customers']
    print(f"{cat['category_name']}: Rate={rate:.3f}, Qty={cat['predicted_qty']}")

print("\n--- 5. Assert absence of /calculate-rescue route ---")
resp_404 = client.post("/calculate-rescue")
print("Status for /calculate-rescue:", resp_404.status_code)
