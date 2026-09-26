from pydantic import BaseModel

class RescueEventResponse(BaseModel):
    id: int
    kitchen_id: int
    kitchen_name: str
    category: str
    is_vegetarian: bool
    quantity_kg: float
    detected_at: str
    expiry_at: str
    rescue_window_hours: float
    urgency_level: str
    status: str
