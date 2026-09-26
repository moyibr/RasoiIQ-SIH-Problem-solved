from pydantic import BaseModel

class NGOMatchResponse(BaseModel):
    ngo_id: int
    name: str
    address: str
    contact_name: str
    food_preference: str
    capacity_kg: float
    distance_km: float
    match_score: float
    capacity_match: bool
    food_pref_match: bool
    lat: float
    lng: float

class MatchRequest(BaseModel):
    rescue_event_id: int
