"""
Sustainability Metrics Aggregator
===================================
CRITICAL: This module aggregates ONLY from the database.
The LLM receives the output of this function; it does NOT access the DB directly.

Emission factor source:
  CO2e factor = 2.5 kg CO2e per kg food waste avoided.
  Source: FAO (2013) "Food Wastage Footprint: Impacts on Natural Resources"
          (global average food waste CO2e, mixed food categories).
  This is a stated approximation; actual CO2e varies by food type.

Meal weight assumption:
  avg_meal_weight_kg = 0.4 kg
  Source: Stated assumption based on FSSAI recommended meal portion sizes
          for institutional kitchens (breakfast: ~0.3kg, lunch: ~0.5kg average).

Forecast performance:
  MAE = 48.8 customers/day (from Andaza model test evaluation).
  MAPE: not stored; exposed as null.
  Mean daily demand (training set) = 295 customers used as denominator
  for relative error only. We expose MAE directly, NOT a derived "accuracy %".

Null vs Zero policy:
  - 0 means confirmed zero activity in that period.
  - null means the data source is entirely absent / not applicable.
"""

import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc

from app.models.rescue import RescueEvent
from app.models.food_category import FoodCategory
from app.models.processing_unit import ProcessingUnitLog

# ---- Documented constants ----
CO2E_FACTOR_KG_PER_KG = 2.5
# Source: FAO (2013) Food Wastage Footprint: Impacts on Natural Resources
# Global average CO2e per kg food waste avoided (mixed food, includes production+transport+decomposition)

MEAL_WEIGHT_KG = 0.4
# Assumption: average institutional meal weight per serving (FSSAI guidance)

ANDAZA_MAE = 48.8
# Andaza model test-set MAE: 48.8 customers/day (validated in Phase 2a verification)
# Reference baseline demand: ~295 customers/day (training-set mean)


def aggregate_sustainability_metrics(
    db: Session,
    start_date: datetime.date,
    end_date: datetime.date,
) -> Dict[str, Any]:
    """
    Aggregates all sustainability metrics for [start_date, end_date] inclusive.
    Returns a strongly-typed dict suitable to pass directly to the LLM.

    DB access happens ONLY here. The LLM sees only this dict.
    """
    start_dt = datetime.datetime.combine(start_date, datetime.time.min)
    end_dt = datetime.datetime.combine(end_date, datetime.time.max)

    # ── Rescue rescued (DELIVERED or MATCHED status = rescued) ──────────────
    rescued_events = db.query(RescueEvent).filter(
        RescueEvent.status.in_(["DELIVERED", "MATCHED"]),
        RescueEvent.detected_at >= start_dt,
        RescueEvent.detected_at <= end_dt,
    ).all()
    kg_rescued = sum(e.quantity_kg for e in rescued_events) if rescued_events else 0

    # ── Rescue wasted / expired ─────────────────────────────────────────────
    expired_events = db.query(RescueEvent).filter(
        RescueEvent.status == "EXPIRED",
        RescueEvent.detected_at >= start_dt,
        RescueEvent.detected_at <= end_dt,
    ).all()
    kg_wasted = sum(e.quantity_kg for e in expired_events) if expired_events else 0

    # ── Total rescue detected ───────────────────────────────────────────────
    all_events = db.query(RescueEvent).filter(
        RescueEvent.detected_at >= start_dt,
        RescueEvent.detected_at <= end_dt,
    ).all()
    total_rescue_events = len(all_events)

    # ── CO2e avoided ────────────────────────────────────────────────────────
    co2e_avoided_kg = round(kg_rescued * CO2E_FACTOR_KG_PER_KG, 2)

    # ── Meals redistributed ─────────────────────────────────────────────────
    meals_redistributed = int(kg_rescued / MEAL_WEIGHT_KG) if kg_rescued > 0 else 0

    # ── Top 3 most-wasted food categories ───────────────────────────────────
    top_wasted_raw = (
        db.query(FoodCategory.name, sqlfunc.sum(RescueEvent.quantity_kg).label("total_wasted"))
        .join(RescueEvent, RescueEvent.category_id == FoodCategory.id)
        .filter(
            RescueEvent.status == "EXPIRED",
            RescueEvent.detected_at >= start_dt,
            RescueEvent.detected_at <= end_dt,
        )
        .group_by(FoodCategory.name)
        .order_by(sqlfunc.sum(RescueEvent.quantity_kg).desc())
        .limit(3)
        .all()
    )
    top_wasted_categories = [
        {"category": name, "kg_wasted": round(float(qty), 2)}
        for name, qty in top_wasted_raw
    ] if top_wasted_raw else []

    # ── Processing unit efficiency (Unit 1, same period) ────────────────────
    pu_logs = db.query(ProcessingUnitLog).filter(
        ProcessingUnitLog.unit_id == 1,
        ProcessingUnitLog.date >= start_date,
        ProcessingUnitLog.date <= end_date,
    ).all()

    if pu_logs:
        n = len(pu_logs)
        pu_avg_yield = round(sum(l.process_yield_pct for l in pu_logs) / n, 2)
        pu_avg_downtime = round(sum(l.downtime_pct for l in pu_logs) / n, 2)
        pu_total_energy = round(sum(l.energy_consumed_kwh for l in pu_logs), 1)
        pu_total_output = round(sum(l.net_good_output_kg for l in pu_logs), 2)
        pu_days = n
    else:
        pu_avg_yield = None
        pu_avg_downtime = None
        pu_total_energy = None
        pu_total_output = None
        pu_days = 0

    # ── Data availability flags (null vs zero) ───────────────────────────────
    # The DB query successfully ran, so this is a legitimate 0, not "unavailable".
    rescue_data_available = True

    return {
        # ── Provenance metadata ──────────────────────────────────────────────
        "metadata": {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "is_synthetic_data": True,
            "synthetic_note": (
                "Kitchen rescue data is synthetic, generated for system demonstration. "
                "Processing unit data sourced from processing_unit_dataset_v3_verified.csv."
            ),
            "rescue_data_available": rescue_data_available,
        },
        # ── Kitchen rescue metrics ──────────────────────────────────────────
        "rescue": {
            "total_events_detected": total_rescue_events,
            "kg_rescued": round(float(kg_rescued), 2),
            "kg_wasted_expired": round(float(kg_wasted), 2),
            "rescue_rate_pct": (
                round(kg_rescued / (kg_rescued + kg_wasted) * 100, 1)
                if (kg_rescued + kg_wasted) > 0 else 0.0
            ),
        },
        # ── Derived environmental/social impact ─────────────────────────────
        "impact": {
            "co2e_avoided_kg": co2e_avoided_kg,
            "co2e_factor_source": (
                "FAO (2013) Food Wastage Footprint: Impacts on Natural Resources — "
                "2.5 kg CO2e per kg food waste avoided (global average, mixed food categories)"
            ),
            "meals_redistributed": meals_redistributed,
            "meal_weight_assumption_kg": MEAL_WEIGHT_KG,
            "meal_weight_source": "Stated assumption: FSSAI institutional meal portion guidance",
        },
        # ── Top wasted categories ────────────────────────────────────────────
        "top_wasted_categories": top_wasted_categories,
        # ── Forecast performance ─────────────────────────────────────────────
        "forecast_performance": {
            "model": "Andaza (XGBoost Poisson)",
            "mae_customers_per_day": ANDAZA_MAE,
            "mape": None,  # Not stored; genuinely unavailable
            "note": (
                "MAE = 48.8 customers/day on held-out test set (Phase 2a verification). "
                "MAPE not stored. Do NOT express as an accuracy percentage."
            ),
        },
        # ── Processing unit efficiency ────────────────────────────────────────
        "processing_unit": {
            "unit_id": 1,
            "unit_name": "Central Processing Unit — Maize/Pulse Line",
            "days_in_period": pu_days,
            "avg_process_yield_pct": pu_avg_yield,
            "avg_downtime_pct": pu_avg_downtime,
            "total_energy_consumed_kwh": pu_total_energy,
            "total_net_good_output_kg": pu_total_output,
            "data_available": pu_days > 0,
        },
    }
