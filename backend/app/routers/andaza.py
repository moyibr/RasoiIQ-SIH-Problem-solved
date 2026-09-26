"""
Andaza router — POST /predict-demand
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
import datetime

from app.schemas.andaza import PredictDemandRequest, PredictDemandResponse
from app.services import andaza as andaza_service
from app.services.andaza_context import KITCHEN_LOCATION_MAP, SEASONAL_WEATHER, RECENT_AVERAGES, PUBLIC_HOLIDAYS, LOCAL_EVENTS
from app.database import SessionLocal
from app.models.consumption import ConsumptionHistory
from sqlalchemy import func

router = APIRouter(tags=["Andaza"])

@router.get(
    "/forecast",
    response_model=PredictDemandResponse,
    summary="[Automated] Predict customer demand using auto-assembled features",
    description=(
        "This is the ONLY forecast endpoint the frontend should call. "
        "It accepts a kitchen_id and target date, auto-assembles all 13 features "
        "using climatology fallbacks and historical data, and calls the XGBoost model."
    ),
)
def auto_forecast(
    kitchen_id: str = Query(..., description="Kitchen ID, e.g. K1_MainCampus"),
    date: str = Query(..., description="Target date in YYYY-MM-DD format, e.g. 2026-09-25")
) -> PredictDemandResponse:
    # 1. Map Kitchen to Location
    location_id = KITCHEN_LOCATION_MAP.get(kitchen_id)
    if not location_id:
        raise HTTPException(status_code=400, detail=f"Invalid kitchen_id: {kitchen_id}")
    
    # Parse date to get month for weather fallback
    try:
        date_obj = datetime.date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
        
    month = date_obj.month
    
    # 2. Get Weather Fallbacks
    weather = SEASONAL_WEATHER.get(location_id, {}).get(str(month), {"temp_celsius": 25.0, "rain_mm": 0.0})
    # If the JSON loaded keys as string for int, handle it:
    if str(month) not in SEASONAL_WEATHER.get(location_id, {}):
        # try int
        weather = SEASONAL_WEATHER.get(location_id, {}).get(month, {"temp_celsius": 25.0, "rain_mm": 0.0})
        
    # 3. Get Recent Averages
    recent = RECENT_AVERAGES.get(location_id, {
        "reservations": 0, "cpi_index": 100.0, "online_rating": 4.0, "competitor_promo": 0
    })
    
    # 4. Get Calendar Features
    is_holiday = 1 if date in PUBLIC_HOLIDAYS else 0
    events = LOCAL_EVENTS.get(date, {"local_event": 0, "active_promotion": 0})
    
    # 5. Get Lag Features from DB
    db = SessionLocal()
    try:
        # demand_yesterday
        yesterday = date_obj - datetime.timedelta(days=1)
        record_1 = db.query(ConsumptionHistory).filter_by(location_id=location_id, date=yesterday).first()
        demand_yesterday = record_1.customer_count if record_1 else 300.0
        
        # demand_7_days_ago
        days_7_ago = date_obj - datetime.timedelta(days=7)
        record_7 = db.query(ConsumptionHistory).filter_by(location_id=location_id, date=days_7_ago).first()
        demand_7_days_ago = record_7.customer_count if record_7 else 300.0
        
        # demand_ma7 (mean of 7 days before)
        start_date = date_obj - datetime.timedelta(days=7)
        end_date = yesterday
        ma7_res = db.query(func.avg(ConsumptionHistory.customer_count)).filter(
            ConsumptionHistory.location_id == location_id,
            ConsumptionHistory.date >= start_date,
            ConsumptionHistory.date <= end_date
        ).scalar()
        demand_ma7 = float(ma7_res) if ma7_res else 300.0
        
    finally:
        db.close()
        
    # Assemble final request for predict
    inputs = {
        "location_id": location_id,
        "date": date,
        "is_holiday": is_holiday,
        "temp_celsius": weather["temp_celsius"],
        "rain_mm": weather["rain_mm"],
        "local_event": events["local_event"],
        "active_promotion": events["active_promotion"],
        "competitor_promo": recent["competitor_promo"],
        "cpi_index": recent["cpi_index"],
        "online_rating": recent["online_rating"],
        "reservations": recent["reservations"],
        "demand_yesterday": demand_yesterday,
        "demand_7_days_ago": demand_7_days_ago,
        "demand_ma7": demand_ma7
    }
    
    req = PredictDemandRequest(**inputs)
    
    try:
        predicted_customers, derived_features = andaza_service.predict(req.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (FileNotFoundError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    derived_features.update({
        "auto_derived": [
            "temp_celsius", "rain_mm", "competitor_promo", "cpi_index", 
            "online_rating", "reservations", "demand_yesterday", 
            "demand_7_days_ago", "demand_ma7", "is_holiday", 
            "local_event", "active_promotion"
        ]
    })
    
    return PredictDemandResponse(
        predicted_customers=predicted_customers,
        recommended_production=None,
        expected_rescue=None,
        location_id=location_id,
        date=date,
        derived_features=derived_features,
    )



@router.post(
    "/predict-demand",
    response_model=PredictDemandResponse,
    summary="Predict customer demand for a given date and location",
    description=(
        "Accepts kitchen manager inputs and returns Andaza's predicted "
        "customer count for the specified date and location, plus derived "
        "diagnostic features. `recommended_production` and `expected_rescue` "
        "are stubs until the production planning module is built."
    ),
)
def predict_demand(request: PredictDemandRequest) -> PredictDemandResponse:
    """
    Run one Andaza demand prediction.

    Raises
    ------
    HTTP 422  — automatic on Pydantic validation failure (invalid field values)
    HTTP 400  — if location_id is unknown (secondary guard; Pydantic catches first)
    HTTP 503  — if the model file is missing or xgboost is not installed
    """
    try:
        inputs = request.model_dump()
        predicted_customers, derived_features = andaza_service.predict(inputs)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (FileNotFoundError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return PredictDemandResponse(
        predicted_customers=predicted_customers,
        recommended_production=None,  # stub
        expected_rescue=None,         # stub
        location_id=request.location_id,
        date=request.date,
        derived_features=derived_features,
    )
