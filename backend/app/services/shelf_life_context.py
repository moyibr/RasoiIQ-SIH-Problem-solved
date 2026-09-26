from datetime import datetime, timezone
import math

# STATED ASSUMPTION: Typical safe-serving windows for prepared institutional cooked food. Not derived from a dataset.
SHELF_LIFE_HOURS = {
    "Rice": 4.0,
    "Dal": 5.0,
    "Vegetable_Curry": 5.0,
    "Roti_Bread": 6.0,
    "Salad": 2.0,
    "Dessert": 8.0,
    "Beverages": 6.0,
    "Snacks": 12.0
}

def calculate_urgency(category: str, batch_created_at):
    now = datetime.now(timezone.utc)

    # Rows seeded before batch_created_at existed, or created outside the normal
    # ingest path, can carry a NULL timestamp. Treat those as brand-new batches
    # rather than crashing the request.
    if batch_created_at is None:
        batch_created_at = now
    elif batch_created_at.tzinfo is None:
        batch_created_at = batch_created_at.replace(tzinfo=timezone.utc)
        
    shelf_life = SHELF_LIFE_HOURS.get(category, 24.0)
    
    hours_since_creation = (now - batch_created_at).total_seconds() / 3600.0
    remaining_window_hours = round(shelf_life - hours_since_creation, 2)
    
    if remaining_window_hours <= 0:
        urgency_level = "EXPIRED"
        remaining_pct = 0.0
    else:
        remaining_pct = remaining_window_hours / shelf_life
        if remaining_pct < 0.25:
            urgency_level = "RED"
        elif remaining_pct <= 0.60:
            urgency_level = "AMBER"
        else:
            urgency_level = "GREEN"
            
    return remaining_window_hours, urgency_level
