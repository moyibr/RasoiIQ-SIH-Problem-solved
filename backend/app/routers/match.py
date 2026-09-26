from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.ngo import NGO
from app.models.rescue import RescueEvent
from app.services.matching_engine import calculate_ngo_matches
from typing import List, Dict, Any

router = APIRouter()

@router.get("/rescue/{rescue_event_id}/matches")
def get_matches(rescue_event_id: int, db: Session = Depends(get_db)):
    rescue = db.query(RescueEvent).filter(RescueEvent.id == rescue_event_id).first()
    if not rescue:
        raise HTTPException(status_code=404, detail="Rescue event not found")
        
    ngos = db.query(NGO).filter(NGO.is_active == True).all()
    
    matches = calculate_ngo_matches(db, rescue, ngos)
    return matches
