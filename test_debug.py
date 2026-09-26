import sys
from pathlib import Path
from fastapi.testclient import TestClient
import json

sys.path.append(str(Path("backend").resolve()))
from app.main import app

client = TestClient(app)

kitchen = "K1_MainCampus"
dates = ["2026-09-22", "2026-09-26", "2026-10-02"]

for date in dates:
    print(f"\n--- Payload for {date} ---")
    resp = client.get(f"/andaza/forecast?kitchen_id={kitchen}&date={date}")
    if resp.status_code == 200:
        data = resp.json()
        derived = data['derived_features']
        print(f"Is_Weekend: {derived.get('Is_Weekend')}")
        print(f"Is_Holiday: {derived.get('Is_Holiday')}")
        print(f"Local_Event: {derived.get('Local_Event')}")
        print(f"Demand_Yesterday: {derived.get('Demand_Yesterday')}")
        print(f"Demand_7_Days_Ago: {derived.get('Demand_7_Days_Ago')}")
        print(f"Demand_MA7: {derived.get('Demand_MA7')}")
    else:
        print(f"Error: {resp.text}")
