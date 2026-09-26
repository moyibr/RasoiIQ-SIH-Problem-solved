from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.rescue import RescueEventResponse
from app.models.rescue import RescueEvent
from app.models.kitchen import Kitchen
from app.models.food_category import FoodCategory
from app.services.shelf_life_context import calculate_urgency
import datetime

router = APIRouter(prefix="/rescue", tags=["Rescue"])

@router.get("", response_model=list[RescueEventResponse])
def get_rescue(kitchen_id: int = None, status: str = "", donor_id: int = None, volunteer_id: int = None, db: Session = Depends(get_db)):
    query = db.query(RescueEvent, Kitchen, FoodCategory).join(
        Kitchen, RescueEvent.kitchen_id == Kitchen.id
    ).join(
        FoodCategory, RescueEvent.category_id == FoodCategory.id
    )
    
    if kitchen_id:
        query = query.filter(RescueEvent.kitchen_id == kitchen_id)
    if donor_id:
        query = query.filter(RescueEvent.donor_id == donor_id)
    if volunteer_id:
        query = query.filter(RescueEvent.volunteer_id == volunteer_id)
        
    events = query.all()
    
    responses = []
    for se, kit, cat in events:
        if status and se.status.lower() != status.lower():
            continue
            
        remaining_hours, urgency = calculate_urgency(cat.name, se.batch_created_at)
        
        responses.append({
            "id": se.id,
            "kitchen_id": se.kitchen_id,
            "kitchen_name": kit.name,
            "category": cat.name,
            "is_vegetarian": cat.is_vegetarian,
            "quantity_kg": se.quantity_kg,
            "detected_at": se.detected_at.isoformat() if se.detected_at else "",
            "expiry_at": se.expiry_at.isoformat() if se.expiry_at else "",
            "rescue_window_hours": remaining_hours,
            "urgency_level": urgency,
            "status": se.status
        })
        
    # Sort by remaining_window_hours ASC, pushing EXPIRED to the bottom
    def sort_key(item):
        if item["urgency_level"] == "EXPIRED":
            return (1, item["rescue_window_hours"])
        return (0, item["rescue_window_hours"])
        
    responses.sort(key=sort_key)
    
    return [RescueEventResponse(**r) for r in responses]

from pydantic import BaseModel
from typing import Optional
from app.services.shelf_life_context import SHELF_LIFE_HOURS
from fastapi import HTTPException

class ManualRescueRequest(BaseModel):
    kitchen_id: int
    category_name: str
    quantity_kg: float
    hours_remaining_override: Optional[float] = None
    donor_id: Optional[int] = None

@router.post("", response_model=RescueEventResponse)
def create_manual_rescue(req: ManualRescueRequest, db: Session = Depends(get_db)):
    kit = db.query(Kitchen).filter(Kitchen.id == req.kitchen_id).first()
    if not kit:
        raise HTTPException(status_code=404, detail="Kitchen not found")
        
    cat = db.query(FoodCategory).filter(FoodCategory.name == req.category_name).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
        
    now = datetime.datetime.now(datetime.timezone.utc)
    
    if req.hours_remaining_override is not None:
        shelf_life = SHELF_LIFE_HOURS.get(cat.name, 24.0)
        hours_elapsed = shelf_life - req.hours_remaining_override
        batch_created_at = now - datetime.timedelta(hours=hours_elapsed)
    else:
        batch_created_at = now

    new_event = RescueEvent(
        kitchen_id=kit.id,
        donor_id=req.donor_id,
        category_id=cat.id,
        quantity_kg=req.quantity_kg,
        status="ACTIVE",
        detected_at=now,
        batch_created_at=batch_created_at,
        expiry_at=batch_created_at + datetime.timedelta(hours=SHELF_LIFE_HOURS.get(cat.name, 24.0))
    )
    
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    
    remaining_hours, urgency = calculate_urgency(cat.name, new_event.batch_created_at)
    
    return RescueEventResponse(
        id=new_event.id,
        kitchen_id=kit.id,
        kitchen_name=kit.name,
        category=cat.name,
        is_vegetarian=cat.is_vegetarian,
        quantity_kg=new_event.quantity_kg,
        detected_at=new_event.detected_at.isoformat(),
        expiry_at=new_event.expiry_at.isoformat() if new_event.expiry_at else "",
        rescue_window_hours=remaining_hours,
        urgency_level=urgency,
        status=new_event.status
    )

class AcceptRescueRequest(BaseModel):
    volunteer_id: int

@router.patch("/{id}/accept")
def accept_rescue(id: int, req: AcceptRescueRequest, db: Session = Depends(get_db)):
    event = db.query(RescueEvent).filter(RescueEvent.id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Rescue event not found")
    if event.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Rescue event is not active")
    
    event.status = "ACCEPTED"
    event.volunteer_id = req.volunteer_id
    db.commit()
    return {"message": "Accepted successfully"}

@router.patch("/{id}/status")
def update_rescue_status(id: int, status: str, db: Session = Depends(get_db)):
    event = db.query(RescueEvent).filter(RescueEvent.id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Rescue event not found")
    
    event.status = status
    db.commit()
    return {"message": "Status updated successfully"}
