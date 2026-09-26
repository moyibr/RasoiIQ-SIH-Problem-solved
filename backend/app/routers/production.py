from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date as date_type, datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.food_category import FoodCategory
from app.models.inventory import InventoryLog
from app.models.kitchen import Kitchen
from app.models.production import ProductionLog, FoodConsumptionLog
from app.models.rescue import RescueEvent
from app.services.production_context import get_conversion_rate, get_spoilage_rate, FIXED_BUFFER_PCT
from app.routers.andaza import auto_forecast

router = APIRouter()

class ProductionPlanCategory(BaseModel):
    category_id: int
    category_name: str
    unit: str
    predicted_customers: int
    predicted_qty: float
    buffer_pct: float
    buffer_reasoning: str
    usable_inventory: float
    recommended_production_qty: float

class ProductionPlanResponse(BaseModel):
    kitchen_id: str
    date: date_type
    categories: List[ProductionPlanCategory]

@router.get("/production-plan/generate", response_model=ProductionPlanResponse)
def generate_production_plan(kitchen_id: str, date: date_type, db: Session = Depends(get_db)):
    try:
        andaza_res = auto_forecast(kitchen_id=kitchen_id, date=str(date))
        predicted_customers = andaza_res.predicted_customers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get forecast: {str(e)}")
    
    categories = db.query(FoodCategory).all()
    plan_categories = []

    for cat in categories:
        conv_rate = get_conversion_rate(cat.name)
        predicted_qty = predicted_customers * conv_rate
        
        inv = db.query(InventoryLog).filter(
            InventoryLog.category_id == cat.id,
            InventoryLog.date == date
        ).first()
        usable_inv = inv.usable_inventory if inv else 0.0

        prod_qty = max(0.0, predicted_qty * (1 + FIXED_BUFFER_PCT) - usable_inv)
        
        plan_categories.append(
            ProductionPlanCategory(
                category_id=cat.id,
                category_name=cat.name,
                unit=cat.unit,
                predicted_customers=predicted_customers,
                predicted_qty=round(predicted_qty, 2),
                buffer_pct=FIXED_BUFFER_PCT,
                buffer_reasoning=f"1.2 * relative_MAE (~16.5%)",
                usable_inventory=round(usable_inv, 2),
                recommended_production_qty=round(prod_qty, 2)
            )
        )

    return ProductionPlanResponse(kitchen_id=kitchen_id, date=date, categories=plan_categories)


@router.post("/production-plan/save")
def save_production_plan(plan: ProductionPlanResponse, db: Session = Depends(get_db)):
    k = db.query(Kitchen).filter(Kitchen.name == plan.kitchen_id).first()
    kid = k.id if k else 1

    for cat in plan.categories:
        plog = db.query(ProductionLog).filter(
            ProductionLog.kitchen_id == kid,
            ProductionLog.category_id == cat.category_id,
            ProductionLog.date == plan.date
        ).first()
        if plog:
            plog.planned_kg = cat.recommended_production_qty
        else:
            plog = ProductionLog(
                kitchen_id=kid,
                category_id=cat.category_id,
                date=plan.date,
                planned_kg=cat.recommended_production_qty
            )
            db.add(plog)
    db.commit()
    return {"status": "saved"}


class LogConsumptionRequest(BaseModel):
    kitchen_id: str
    date: date_type
    category_name: str
    consumed_qty: float

@router.post("/log-consumption")
def log_consumption(req: LogConsumptionRequest, db: Session = Depends(get_db)):
    cat = db.query(FoodCategory).filter(FoodCategory.name == req.category_name).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
        
    k = db.query(Kitchen).filter(Kitchen.name == req.kitchen_id).first()
    kid = k.id if k else 1

    # Read planned_qty from ProductionLog
    plog = db.query(ProductionLog).filter(
        ProductionLog.kitchen_id == kid,
        ProductionLog.category_id == cat.id,
        ProductionLog.date == req.date
    ).first()
    
    planned_qty = plog.planned_kg if plog else 0.0
    spoilage = get_spoilage_rate(cat.name) * planned_qty
    rescue_qty = max(0.0, planned_qty - req.consumed_qty - spoilage)
    
    # Upsert FoodConsumptionLog
    clog = db.query(FoodConsumptionLog).filter(
        FoodConsumptionLog.kitchen_id == kid,
        FoodConsumptionLog.category_id == cat.id,
        FoodConsumptionLog.date == req.date
    ).first()
    if clog:
        clog.consumed_qty = req.consumed_qty
    else:
        clog = FoodConsumptionLog(kitchen_id=kid, category_id=cat.id, date=req.date, consumed_qty=req.consumed_qty)
        db.add(clog)
        
    # Auto-generate RescueEvent
    if rescue_qty > 0.0:
        existing_se = db.query(RescueEvent).filter(
            RescueEvent.kitchen_id == kid,
            RescueEvent.category_id == cat.id,
            RescueEvent.batch_created_at >= datetime.combine(req.date, datetime.min.time()).replace(tzinfo=timezone.utc)
        ).first()
        
        if existing_se:
            existing_se.quantity_kg = rescue_qty
        else:
            se = RescueEvent(
                kitchen_id=kid,
                category_id=cat.id,
                quantity_kg=rescue_qty,
                batch_created_at=datetime.combine(req.date, datetime.min.time()).replace(tzinfo=timezone.utc),
                expiry_at=datetime.combine(req.date, datetime.min.time()).replace(tzinfo=timezone.utc) + timedelta(hours=cat.shelf_life_hours if cat.shelf_life_hours else 24),
                urgency_level="HIGH" if cat.shelf_life_hours and cat.shelf_life_hours <= 12 else "MEDIUM",
                status="ACTIVE",
                notes="Auto-calculated from consumption log"
            )
            db.add(se)

    db.commit()
    return {"status": "success", "rescue_calculated": rescue_qty}

@router.post("/replay-consumption")
def replay_consumption(kitchen_id: str, date: date_type, db: Session = Depends(get_db)):
    # Demo-helper route
    return {"status": "replayed"}
