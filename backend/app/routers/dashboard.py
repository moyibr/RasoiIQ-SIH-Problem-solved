from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.dashboard import DashboardSummaryResponse, DailyStat
from app.models.production import FoodConsumptionLog, ProductionLog
from app.models.rescue import RescueEvent
import datetime

router = APIRouter()

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    today = datetime.datetime.now().date()
    
    from app.services.shelf_life_context import calculate_urgency
    from app.models.food_category import FoodCategory

    # Active rescue
    active_rescue_events = db.query(RescueEvent, FoodCategory).join(
        FoodCategory, RescueEvent.category_id == FoodCategory.id
    ).filter(RescueEvent.status == 'ACTIVE').all()
    
    active_rescue = 0
    for se, cat in active_rescue_events:
        rem, urgency = calculate_urgency(cat.name, se.batch_created_at)
        if urgency != "EXPIRED":
            active_rescue += 1
            
    # Let's compute kg_rescued, etc. Just sum for today.
    rescued_today = db.query(RescueEvent).filter(RescueEvent.status.in_(['DELIVERED', 'MATCHED']), RescueEvent.detected_at >= today).all()
    kg_rescued_today = sum(s.quantity_kg for s in rescued_today) if rescued_today else 0.0
    
    kg_wasted_today = sum(s.quantity_kg for s in db.query(RescueEvent).filter(RescueEvent.status == 'EXPIRED', RescueEvent.detected_at >= today).all())
    
    trend = []
    for i in range(6, -1, -1):
        d = today - datetime.timedelta(days=i)
        
        rescued = db.query(RescueEvent).filter(RescueEvent.status.in_(['DELIVERED', 'MATCHED']), RescueEvent.detected_at >= d, RescueEvent.detected_at < d + datetime.timedelta(days=1)).all()
        kg_rescued = sum(s.quantity_kg for s in rescued) if rescued else 0.0
        
        wasted = db.query(RescueEvent).filter(RescueEvent.status == 'EXPIRED', RescueEvent.detected_at >= d, RescueEvent.detected_at < d + datetime.timedelta(days=1)).all()
        kg_wasted = sum(s.quantity_kg for s in wasted) if wasted else 0.0
        
        trend.append(DailyStat(
            date=d.isoformat(),
            kg_rescued=kg_rescued,
            kg_wasted=kg_wasted,
            meals_served=int(kg_rescued / 0.35),
            co2_saved_kg=kg_rescued * 2.5
        ))
        
    from sqlalchemy import extract
    from app.models.delivery import Delivery

    ngos_served_this_month = db.query(Delivery.ngo_id).filter(
        Delivery.status == 'DELIVERED',
        extract('month', Delivery.delivered_at) == today.month,
        extract('year', Delivery.delivered_at) == today.year
    ).distinct().count()

    # Derived from Andaza's MAE (~48.8) and baseline (~295)
    baseline_mae = 48.8
    baseline_demand = 295.0
    forecast_accuracy_pct = round(100.0 - ((baseline_mae / baseline_demand) * 100.0), 1)

    return DashboardSummaryResponse(
        kg_rescued_today=round(kg_rescued_today, 2),
        kg_wasted_today=round(kg_wasted_today, 2),
        active_rescue_count=active_rescue,
        ngos_served_this_month=ngos_served_this_month,
        forecast_accuracy_pct=forecast_accuracy_pct,
        co2_saved_today_kg=round(kg_rescued_today * 2.5, 2),
        cost_saved_today_inr=round(kg_rescued_today * 50.0, 2),
        weekly_trend=trend
    )
