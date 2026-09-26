"""
Synthetic Institutional Kitchen Demand Dataset Generator
==========================================================
Built for: SIH26234 - RasoiIQ (AI Food Waste Reduction & Redistribution)

This generator does NOT copy any real dataset's rows. It builds a synthetic
institutional-kitchen dataset whose BEHAVIOR is grounded in patterns and
relationships extracted from two real, citable sources:

1. Genpact / Analytics Vidhya "Food Demand Forecasting" dataset (Kaggle:
   kannanaikkal/food-demand-forecasting) -> structural fields and demand
   elasticity: category, price, discount, promotion (emailer), homepage
   feature flag, and center-level variation.

2. Restaurant Sales Report 2024-2025 pattern (Kaggle, rajatsurana979 family)
   -> daily contextual drivers: weather, special events, promotions layered
   on top of a daily sales base.

3. Real published research numbers (Federal University of Uberlandia
   university-restaurant time-series study, 2023) -> genuine seasonal
   indices: ~15% drop in dinner meals on Fridays, ~34% drop in lunch meals
   on Saturdays. These are hard-coded below as real, cited multipliers,
   not guessed ones.

Output: CSV files ready to hand to a forecasting model (Prophet / LSTM /
XGBoost) or to Claude Code to wire into the FastAPI backend.
"""

import numpy as np
import pandas as pd
from datetime import date, timedelta

rng = np.random.default_rng(seed=42)

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
START_DATE = date(2025, 4, 1)
NUM_DAYS = 365          # 12 months of history -> plenty for train/val split
KITCHENS = ["K1_MainCampus", "K2_HostelBlockA", "K3_HostelBlockB"]
MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"]

CATEGORIES = {
    # category: (base_daily_qty, unit, weather_sensitivity, price_per_unit)
    "Rice":              (120, "kg", "neutral", 45),
    "Dal":               (90,  "kg", "neutral", 60),
    "Vegetable_Curry":   (100, "kg", "comfort", 55),
    "Roti_Bread":        (600, "pcs", "comfort", 6),
    "Salad":             (40,  "kg", "hot_up",  30),
    "Dessert":           (35,  "kg", "neutral", 80),
    "Beverages":         (150, "L",  "hot_up",  20),
    "Snacks":            (60,  "kg", "rain_up", 50),
}

# Real cited seasonal indices (Uberlandia Univ. Restaurant study, 2023)
FRIDAY_DINNER_DROP = 0.15
SATURDAY_LUNCH_DROP = 0.34

# Genpact-derived demand elasticity (approximate direction/magnitude from
# the original competition's feature-importance findings: promotion +
# homepage-feature flags meaningfully lift order volume)
PROMOTION_LIFT = 0.22          # "emailer_for_promotion" equivalent
HOMEPAGE_FEATURE_LIFT = 0.15   # "homepage_featured" equivalent -> here:
                                # "today's special / featured menu item"
DISCOUNT_ELASTICITY = 0.9      # extra lift per 10% discount on procurement
                                # cost passed to a secondary-buyer channel

# Festival / event spike days (India-realistic sample; edit as needed)
FESTIVAL_DATES = {
    date(2025, 8, 15): "Independence Day",
    date(2025, 8, 27): "Ganesh Chaturthi",
    date(2025, 10, 2): "Gandhi Jayanti",
    date(2025, 10, 21): "Diwali",
    date(2025, 12, 25): "Christmas",
    date(2026, 1, 26): "Republic Day",
    date(2026, 3, 4):  "Holi",
}
FESTIVAL_SPIKE = 0.50

# Weather simulation (simple categorical Markov-ish daily draw)
WEATHER_STATES = ["Sunny", "Rainy", "Hot", "Cold", "Cloudy"]
WEATHER_PROBS =  [0.40,    0.20,    0.15,  0.10,   0.15]

# Overproduction buffer range (this is the ROOT PROBLEM being modeled -
# real kitchens use a flat "just in case" margin instead of a confidence-
# adjusted one; this generator bakes that inefficiency into the historical
# data so the forecasting model has something real to correct)
FLAT_BUFFER_MIN, FLAT_BUFFER_MAX = 0.12, 0.28

# Spoilage/wastage rate range (independent of overproduction)
SPOILAGE_MIN, SPOILAGE_MAX = 0.01, 0.05


# ---------------------------------------------------------------------------
# GENERATION
# ---------------------------------------------------------------------------
def weekday_multiplier(d: date, meal_type: str) -> float:
    """Weekend/weekday variation, with the two real cited effects applied."""
    dow = d.weekday()  # Mon=0 ... Sun=6
    mult = 1.0
    if dow in (5, 6):  # Sat/Sun general dip in institutional settings
        mult *= 0.85
    if dow == 4 and meal_type == "Dinner":       # Friday dinner
        mult *= (1 - FRIDAY_DINNER_DROP)
    if dow == 5 and meal_type == "Lunch":        # Saturday lunch
        mult *= (1 - SATURDAY_LUNCH_DROP)
    return mult


def weather_multiplier(weather: str, sensitivity: str) -> float:
    if sensitivity == "neutral":
        return 1.0
    if sensitivity == "hot_up" and weather == "Hot":
        return 1.25
    if sensitivity == "rain_up" and weather == "Rainy":
        return 1.20
    if sensitivity == "comfort" and weather in ("Rainy", "Cold"):
        return 1.15
    return 1.0


def seasonal_trend(day_index: int, total_days: int) -> float:
    """Mild gradual trend + slow sinusoidal seasonal wave across the year."""
    trend = 1.0 + 0.05 * (day_index / total_days)          # +5% drift over year
    seasonal = 1.0 + 0.06 * np.sin(2 * np.pi * day_index / 365)
    return trend * seasonal


rows = []
dates = [START_DATE + timedelta(days=i) for i in range(NUM_DAYS)]

for day_index, d in enumerate(dates):
    weather = rng.choice(WEATHER_STATES, p=WEATHER_PROBS)
    is_festival = d in FESTIVAL_DATES
    festival_name = FESTIVAL_DATES.get(d, "")

    for kitchen in KITCHENS:
        # small fixed per-kitchen scale difference (like Genpact's center_type/op_area)
        kitchen_scale = {"K1_MainCampus": 1.3, "K2_HostelBlockA": 1.0,
                          "K3_HostelBlockB": 0.8}[kitchen]

        for meal_type in MEAL_TYPES:
            for category, (base_qty, unit, sensitivity, price) in CATEGORIES.items():

                promotion_flag = int(rng.random() < 0.08)      # ~8% of days
                homepage_featured = int(rng.random() < 0.05)   # ~5% of days
                discount_pct = round(rng.choice([0, 0, 0, 5, 10, 15]), 1)

                mult = 1.0
                mult *= weekday_multiplier(d, meal_type)
                mult *= weather_multiplier(weather, sensitivity)
                mult *= seasonal_trend(day_index, NUM_DAYS)
                mult *= kitchen_scale
                if is_festival:
                    mult *= (1 + FESTIVAL_SPIKE)
                if promotion_flag:
                    mult *= (1 + PROMOTION_LIFT)
                if homepage_featured:
                    mult *= (1 + HOMEPAGE_FEATURE_LIFT)
                if discount_pct > 0:
                    mult *= (1 + DISCOUNT_ELASTICITY * (discount_pct / 100))

                noise = rng.normal(1.0, 0.06)
                actual_consumption = max(0.0, base_qty * mult * noise)

                # --- Historical production: flat "just in case" buffer
                # (this is deliberately naive/flat, modeling the ROOT PROBLEM;
                # the forecasting model you train is what replaces this logic)
                flat_buffer = rng.uniform(FLAT_BUFFER_MIN, FLAT_BUFFER_MAX)
                planned_production = actual_consumption * (1 + flat_buffer)

                spoilage_rate = rng.uniform(SPOILAGE_MIN, SPOILAGE_MAX)
                spoilage_qty = planned_production * spoilage_rate

                rescue_qty = max(
                    0.0, planned_production - actual_consumption - spoilage_qty
                )

                rows.append({
                    "date": d.isoformat(),
                    "day_of_week": d.strftime("%A"),
                    "is_weekend": int(d.weekday() >= 5),
                    "kitchen_id": kitchen,
                    "meal_type": meal_type,
                    "category": category,
                    "unit": unit,
                    "weather": weather,
                    "is_festival": int(is_festival),
                    "festival_name": festival_name,
                    "promotion_flag": promotion_flag,
                    "homepage_featured": homepage_featured,
                    "discount_pct": discount_pct,
                    "unit_price": price,
                    "planned_production_qty": round(planned_production, 2),
                    "actual_consumption_qty": round(actual_consumption, 2),
                    "spoilage_qty": round(spoilage_qty, 2),
                    "rescue_qty": round(rescue_qty, 2),
                })

df = pd.DataFrame(rows)

# ---------------------------------------------------------------------------
# LAG / ROLLING FEATURES (as discussed: 1-day, 7-day, 14-day averages)
# computed per kitchen+meal_type+category group
# ---------------------------------------------------------------------------
df = df.sort_values(["kitchen_id", "meal_type", "category", "date"]).reset_index(drop=True)
group_cols = ["kitchen_id", "meal_type", "category"]

df["lag_1d_consumption"] = df.groupby(group_cols)["actual_consumption_qty"].shift(1)
df["lag_7d_avg_consumption"] = (
    df.groupby(group_cols)["actual_consumption_qty"]
      .transform(lambda s: s.shift(1).rolling(7, min_periods=1).mean())
)
df["lag_14d_avg_consumption"] = (
    df.groupby(group_cols)["actual_consumption_qty"]
      .transform(lambda s: s.shift(1).rolling(14, min_periods=1).mean())
)
df["historical_wastage_pct"] = (
    df.groupby(group_cols)["spoilage_qty"]
      .transform(lambda s: s.shift(1).rolling(14, min_periods=1).mean())
) / df["lag_14d_avg_consumption"].replace(0, np.nan)

df = df.fillna(0)

# ---------------------------------------------------------------------------
# SAVE MAIN DATASET
# ---------------------------------------------------------------------------
out_path = "/mnt/user-data/outputs/kitchen_demand_dataset.csv"
df.to_csv(out_path, index=False)

# ---------------------------------------------------------------------------
# SEED NGO / RECIPIENT DATASET (Bengaluru coordinates, realistic spread)
# ---------------------------------------------------------------------------
ngos = pd.DataFrame([
    {"ngo_id": "NGO1", "name": "Akshaya Seva Trust",      "lat": 12.9716, "lon": 77.5946,
     "food_type_accepted": "veg_only",     "capacity_kg_per_day": 80,  "operating_hours": "08:00-20:00"},
    {"ngo_id": "NGO2", "name": "Bengaluru Food Bank",     "lat": 12.9352, "lon": 77.6146,
     "food_type_accepted": "veg_nonveg",   "capacity_kg_per_day": 150, "operating_hours": "09:00-18:00"},
    {"ngo_id": "NGO3", "name": "Shanti Community Kitchen","lat": 12.9784, "lon": 77.6408,
     "food_type_accepted": "veg_only",     "capacity_kg_per_day": 60,  "operating_hours": "07:00-19:00"},
    {"ngo_id": "NGO4", "name": "Hope Shelter Homes",      "lat": 12.9081, "lon": 77.6476,
     "food_type_accepted": "veg_nonveg",   "capacity_kg_per_day": 100, "operating_hours": "24hrs"},
    {"ngo_id": "NGO5", "name": "Uday Foundation Bengaluru","lat": 13.0206, "lon": 77.5760,
     "food_type_accepted": "veg_only",     "capacity_kg_per_day": 70,  "operating_hours": "08:00-21:00"},
])
ngo_path = "/mnt/user-data/outputs/seed_ngo_recipients.csv"
ngos.to_csv(ngo_path, index=False)

print(f"Main dataset: {out_path}  ({len(df):,} rows)")
print(f"NGO seed dataset: {ngo_path}  ({len(ngos)} rows)")
print("\nColumn summary:")
print(df.dtypes)
print("\nSample rows:")
print(df.head(8).to_string())
