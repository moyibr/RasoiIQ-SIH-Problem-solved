import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from app.models.ngo import NGO
from app.models.rescue import RescueEvent
from app.models.kitchen import Kitchen
from app.models.delivery import Delivery
from app.models.food_category import FoodCategory

from app.services.matching_context import (
    SCORING_WEIGHTS,
    ROAD_DISTANCE_MULTIPLIER,
    URBAN_SPEED_KMH,
    SAFETY_BUFFER_HOURS
)
from app.services.shelf_life_context import calculate_urgency

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_ngo_matches(db: Session, rescue_event: RescueEvent, ngos_list: List[NGO]) -> List[Dict[str, Any]]:
    # Get kitchen coordinates
    kitchen = db.query(Kitchen).filter(Kitchen.id == rescue_event.kitchen_id).first()
    category = db.query(FoodCategory).filter(FoodCategory.id == rescue_event.category_id).first()
    
    if not kitchen or not category:
        return []

    remaining_window_hours, urgency = calculate_urgency(category.name, rescue_event.batch_created_at)
    
    if urgency == "EXPIRED" or remaining_window_hours <= 0:
        return []

    now_utc = datetime.now(timezone.utc)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    today_ist = now_utc.astimezone(ist_tz).date()

    results = []

    for ngo in ngos_list:
        # 1. HARD FILTERS
        
        # Food Type
        if ngo.accepted_categories != "ALL":
            accepted = [c.strip() for c in ngo.accepted_categories.split(",")]
            if category.name not in accepted:
                continue

        # Distance
        straight_dist = haversine(kitchen.lat, kitchen.lng, ngo.lat, ngo.lng)
        actual_road_distance = straight_dist * ROAD_DISTANCE_MULTIPLIER
        if actual_road_distance > 15.0:
            continue

        # Capacity
        if ngo.capacity_kg < rescue_event.quantity_kg:
            continue

        # Expiry
        travel_time_hours = actual_road_distance / URBAN_SPEED_KMH
        if travel_time_hours + SAFETY_BUFFER_HOURS > remaining_window_hours:
            continue

        # Operating Hours
        delivery_eta = now_utc + timedelta(hours=travel_time_hours)
        delivery_eta_ist = delivery_eta.astimezone(ist_tz).time()
        
        try:
            start_h, start_m = map(int, ngo.operating_hours_start.split(':'))
            end_h, end_m = map(int, ngo.operating_hours_end.split(':'))
            op_start = datetime.strptime(ngo.operating_hours_start, "%H:%M").time()
            op_end = datetime.strptime(ngo.operating_hours_end, "%H:%M").time()
            
            if op_start <= op_end:
                if not (op_start <= delivery_eta_ist <= op_end):
                    continue
            else:
                # wraps around midnight
                if not (delivery_eta_ist >= op_start or delivery_eta_ist <= op_end):
                    continue
        except Exception:
            pass # fallback if parsing fails

        # 2. SCORING
        dist_score = (1 - (actual_road_distance / 15.0)) * 100
        capacity_score = (rescue_event.quantity_kg / ngo.capacity_kg) * 100
        margin_hours = remaining_window_hours - (travel_time_hours + SAFETY_BUFFER_HOURS)
        time_score = (margin_hours / remaining_window_hours) * 100
        food_type_score = 100.0

        raw_score = (
            dist_score * SCORING_WEIGHTS["distance"] +
            capacity_score * SCORING_WEIGHTS["capacity"] +
            time_score * SCORING_WEIGHTS["time"] +
            food_type_score * SCORING_WEIGHTS["food_type"]
        )

        # 3. Load Balancing Penalty
        deliveries_today = db.query(Delivery).filter(
            Delivery.ngo_id == ngo.id,
            Delivery.status == "DELIVERED"
        ).all()
        
        delivered_today = False
        for d in deliveries_today:
            if d.delivered_at:
                d_ist = d.delivered_at.astimezone(ist_tz).date()
                if d_ist == today_ist:
                    delivered_today = True
                    break
                    
        total_score = raw_score
        if delivered_today:
            total_score -= 15.0

        results.append({
            "ngo_id": ngo.id,
            "ngo_name": ngo.name,
            "contact_name": ngo.contact_name,
            "contact_phone": ngo.contact_phone,
            "match_score": round(max(0, total_score), 1),
            "distance_km": round(actual_road_distance, 1),
            "eta_minutes": int(travel_time_hours * 60),
            "match_reason": "Excellent capacity fit" if capacity_score > 80 else "Good distance and timing",
            "lat": ngo.lat,
            "lng": ngo.lng
        })

    # Sort DESC
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results
