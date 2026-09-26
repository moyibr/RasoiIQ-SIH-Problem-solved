from pydantic import BaseModel

class DailyStat(BaseModel):
    date: str
    kg_rescued: float
    kg_wasted: float
    meals_served: int
    co2_saved_kg: float

class DashboardSummaryResponse(BaseModel):
    kg_rescued_today: float
    kg_wasted_today: float
    active_rescue_count: int
    ngos_served_this_month: int
    forecast_accuracy_pct: float
    co2_saved_today_kg: float
    cost_saved_today_inr: float
    weekly_trend: list[DailyStat]
