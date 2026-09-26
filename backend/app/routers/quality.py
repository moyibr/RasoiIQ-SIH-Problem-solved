from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import cv2
import numpy as np
from app.database import get_db
from app.models.rescue import RescueEvent
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/quality", tags=["Quality Check"])

class QualityAnalysisResponse(BaseModel):
    score: int
    category: str
    reason: str
    updated_rescue_id: Optional[int] = None

@router.post("/analyze", response_model=QualityAnalysisResponse)
async def analyze_quality(
    image: UploadFile = File(...),
    rescue_event_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    # Read image
    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Lightweight CPU analysis - color/texture variance
    # Convert to HSV
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Calculate average brightness (V channel) and saturation (S channel)
    mean_v = np.mean(hsv[:, :, 2])
    
    # Look for dark spots (brown/black) common in spoilage
    # Lower V usually indicates darker, potential spoilage spots
    lower_dark = np.array([0, 0, 0])
    upper_dark = np.array([180, 255, 70])
    mask_dark = cv2.inRange(hsv, lower_dark, upper_dark)
    
    dark_ratio = np.sum(mask_dark > 0) / (img.shape[0] * img.shape[1])
    
    # Simple rule: more dark spots = lower freshness
    # Base score 100, reduce by dark_ratio scaled
    score = 100 - int(dark_ratio * 200)
    
    # Add some randomness for simulation if the image is too uniform
    if dark_ratio < 0.05:
        variance = np.var(hsv[:, :, 2])
        if variance < 500:
            score -= 10
            
    score = max(0, min(100, score))
    
    if score > 75:
        category = "Fresh"
        reason = "Visual analysis indicates healthy color and minimal dark spots."
    elif score > 40:
        category = "Near-Spoilage"
        reason = "Some discoloration detected. Should be redistributed immediately."
    else:
        category = "Spoiled"
        reason = "Significant dark spots and degradation detected."

    # Link to rescue
    if rescue_event_id:
        rescue = db.query(RescueEvent).filter(RescueEvent.id == rescue_event_id).first()
        if rescue:
            if category == "Near-Spoilage" or category == "Spoiled":
                rescue.urgency_level = "HIGH"
                rescue.notes = f"Quality Check: {category} (Score {score}). {reason}"
                db.commit()

    return QualityAnalysisResponse(
        score=score,
        category=category,
        reason=reason,
        updated_rescue_id=rescue_event_id
    )
