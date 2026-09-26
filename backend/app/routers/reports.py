import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.sustainability_aggregator import aggregate_sustainability_metrics
from app.services.llm_service import generate_narrative
from app.models.rescue import RescueEvent
from sqlalchemy import func
import calendar

router = APIRouter(prefix="/reports", tags=["Reports"])


def _parse_date_range(date_range: str):
    """Parses date_range string into (start, end) as datetime.date objects."""
    if date_range.endswith("d") and date_range[:-1].isdigit():
        days = int(date_range[:-1])
        end = datetime.date.today()
        start = end - datetime.timedelta(days=days - 1)
        return start, end
    elif ":" in date_range:
        parts = date_range.split(":")
        return datetime.date.fromisoformat(parts[0]), datetime.date.fromisoformat(parts[1])
    else:
        raise ValueError(f"Unsupported date_range format: {date_range}. Use 7d, 30d, or YYYY-MM-DD:YYYY-MM-DD")


@router.get("/sustainability")
def sustainability_report(
    date_range: str = Query(
        "30d",
        description="Supports: 7d, 30d, or YYYY-MM-DD:YYYY-MM-DD",
    ),
    db: Session = Depends(get_db),
):
    """
    Returns the sustainability report for the specified period.

    Response structure:
      - provenance: period, sources, assumptions, synthetic flags
      - metrics: aggregated DB data (the ONLY input to the LLM)
      - narrative: LLM-generated text (narrates metrics, invents nothing)
      - llm_error: null on success; error string if LLM call failed/unconfigured

    The LLM receives ONLY the metrics dict — it has zero DB access.
    """
    try:
        start_date, end_date = _parse_date_range(date_range)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Aggregate from DB — LLM gets only this dict
    metrics = aggregate_sustainability_metrics(db, start_date, end_date)

    # Call LLM with aggregated metrics only (no raw DB data passed)
    narrative, narrative_source, llm_error = generate_narrative(metrics)

    return {
        "provenance": {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "sources": [
                "rescue_events table (SQLite, seed data)",
                "processing_unit_logs table (processing_unit_dataset_v3_verified.csv)",
            ],
            "documented_assumptions": {
                "co2e_factor": "2.5 kg CO2e/kg — FAO (2013) Food Wastage Footprint",
                "meal_weight_kg": "0.4 kg/meal — FSSAI institutional portion guidance (stated assumption)",
                "forecast_mae": "48.8 customers/day — Andaza model test-set evaluation (Phase 2a)",
            },
            "is_synthetic_data": True,
            "synthetic_note": (
                "All kitchen rescue data is synthetic, generated for system demonstration. "
                "Processing unit data sourced from processing_unit_dataset_v3_verified.csv."
            ),
        },
        "metrics": metrics,
        "narrative": narrative,
        "narrative_source": narrative_source,
        "llm_error": llm_error,
    }

@router.get("/esg-analytics")
def get_esg_analytics(db: Session = Depends(get_db)):
    MEAL_WEIGHT_KG = 0.4
    CO2E_FACTOR = 2.5
    COST_PER_KG = 50.0 # Estimated cost saved per kg

    # All time stats
    saved_events = db.query(RescueEvent).filter(RescueEvent.status.in_(['DELIVERED', 'MATCHED'])).all()
    wasted_events = db.query(RescueEvent).filter(RescueEvent.status == 'EXPIRED').all()
    
    kg_saved = sum(e.quantity_kg for e in saved_events)
    kg_wasted = sum(e.quantity_kg for e in wasted_events)
    
    meals_donated = int(kg_saved / MEAL_WEIGHT_KG) if MEAL_WEIGHT_KG > 0 else 0
    co2e_avoided = kg_saved * CO2E_FACTOR
    cost_saved = kg_saved * COST_PER_KG
    waste_prevention_rate = (kg_saved / (kg_saved + kg_wasted) * 100) if (kg_saved + kg_wasted) > 0 else 0.0

    # Monthly trend (last 6 months)
    # We will do a simple grouping in Python
    from collections import defaultdict
    monthly_data = defaultdict(lambda: {"food_saved": 0.0, "meals_donated": 0, "co2_saved": 0.0, "month": "", "sort_key": ""})
    
    for e in saved_events:
        if e.detected_at:
            m_key = e.detected_at.strftime("%Y-%m")
            m_label = e.detected_at.strftime("%b")
            monthly_data[m_key]["food_saved"] += e.quantity_kg
            monthly_data[m_key]["month"] = m_label
            monthly_data[m_key]["sort_key"] = m_key

    # Format for Recharts
    trend = []
    for k in sorted(monthly_data.keys()):
        monthly_data[k]["meals_donated"] = int(monthly_data[k]["food_saved"] / MEAL_WEIGHT_KG)
        monthly_data[k]["co2_saved"] = monthly_data[k]["food_saved"] * CO2E_FACTOR
        trend.append(monthly_data[k])

    return {
        "overall": {
            "kg_food_saved": round(kg_saved, 2),
            "meals_donated": meals_donated,
            "co2e_avoided_kg": round(co2e_avoided, 2),
            "estimated_cost_saved": round(cost_saved, 2),
            "waste_prevention_rate_pct": round(waste_prevention_rate, 2)
        },
        "monthly_trend": trend[-6:] # last 6 months
    }
