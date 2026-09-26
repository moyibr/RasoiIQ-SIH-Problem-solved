import sys
from pathlib import Path
from sqlalchemy import create_engine
import pandas as pd
import json

sys.path.append(str(Path("backend").resolve()))
from app.database import engine
from app.services.andaza import predict
from app.routers.andaza import auto_forecast

print("--- 1. Raw ConsumptionHistory (Sept 10 - Oct 5, 2026) ---")
# Using pandas to query the db for quick inspection
df = pd.read_sql_query(
    "SELECT date, customer_count FROM consumption_history WHERE location_id = 'Loc_3' AND date >= '2026-09-08' AND date <= '2026-10-05' ORDER BY date",
    engine
)
for _, row in df.iterrows():
    print(f"{row['date']}: {row['customer_count']}")

print("\n--- 2. Ablation Test on Demand_7_Days_Ago ---")
# Let's get the base payload for 2026-09-22
# To get the base payload, I will just call the auto_forecast directly, wait, I can just use the TestClient again or build the dict.
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
resp = client.get("/andaza/forecast?kitchen_id=K1_MainCampus&date=2026-09-22")
base_features = resp.json()['derived_features']

# Now I'll call predict() using these base features. Wait, predict() requires the raw 13 inputs (PredictDemandRequest format), not the 47 derived features.
# Let's construct a raw input dict:
base_inputs = {
    "location_id": "Loc_3",
    "date": "2026-09-22",
    "is_holiday": 0,
    "temp_celsius": 24.5,
    "rain_mm": 0,
    "local_event": 0,
    "active_promotion": 0,
    "competitor_promo": 0,
    "cpi_index": 100.0,
    "online_rating": 4.0,
    "reservations": 100,
    "demand_yesterday": 433.0,
    "demand_7_Days_Ago": 261.0,
    "demand_ma7": 395.14
}

# The endpoint actually has its own logic for filling recent. 
# Let's just use a representative fixed input dictionary.
for test_val in [200.0, 400.0, 600.0]:
    test_inputs = {
        "location_id": "Loc_3",
        "date": "2026-09-22",
        "is_holiday": 0,
        "temp_celsius": 25.0,
        "rain_mm": 0.0,
        "local_event": 0,
        "active_promotion": 0,
        "competitor_promo": 0,
        "cpi_index": 142.3,
        "online_rating": 4.2,
        "reservations": 100,
        "demand_yesterday": 433.0,
        "demand_7_days_ago": test_val,
        "demand_ma7": 395.0
    }
    pred, _ = predict(test_inputs)
    print(f"Demand_7_Days_Ago = {test_val}: Predicted Customers = {pred}")

