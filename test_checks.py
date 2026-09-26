import sys
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.append(str(Path("backend").resolve()))
from app.main import app

client = TestClient(app)

print("--- Check 3: 3 Kitchens, Same Date (2026-09-25) ---")
for kitchen in ["K1_MainCampus", "K2_HostelBlockA", "K3_HostelBlockB"]:
    resp = client.get(f"/andaza/forecast?kitchen_id={kitchen}&date=2026-09-25")
    if resp.status_code == 200:
        print(f"{kitchen}: {resp.json()['predicted_customers']}")
    else:
        print(f"Error for {kitchen}: {resp.status_code}")

print("\n--- Check 4: 1 Kitchen (K1_MainCampus), 3 Dates ---")
# 2026-09-22 is Tuesday (Weekday)
# 2026-09-26 is Saturday (Weekend)
# 2026-10-02 is Gandhi Jayanti (Festival/Holiday)
for date, desc in [("2026-09-22", "Weekday"), ("2026-09-26", "Weekend"), ("2026-10-02", "Festival")]:
    resp = client.get(f"/andaza/forecast?kitchen_id=K1_MainCampus&date={date}")
    if resp.status_code == 200:
        print(f"{date} ({desc}): {resp.json()['predicted_customers']}")
    else:
        print(f"Error for {date}: {resp.status_code}")

print("\n--- Check 5: GET /forecast 404 ---")
resp = client.get("/forecast")
print(f"Status: {resp.status_code}")
