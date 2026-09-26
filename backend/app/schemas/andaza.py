"""
Pydantic schemas for Andaza — the AI demand forecasting engine.

PredictDemandRequest  : what the kitchen manager sends
PredictDemandResponse : what the API returns
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from typing import Optional

# All valid location IDs that the model was trained on
VALID_LOCATIONS = {f"Loc_{i}" for i in range(1, 27)}


class PredictDemandRequest(BaseModel):
    """
    All inputs needed to run one Andaza prediction.

    Temporal features (Day_of_Week, Month, etc.) are derived automatically
    from `date` inside the service -- the manager only needs to supply `date`.

    Lag features MUST come from historical records for the SAME location.
    """

    location_id: str = Field(
        ...,
        description="Location identifier, e.g. 'Loc_3'. Must be one of Loc_1 to Loc_26.",
        examples=["Loc_3"],
    )
    date: str = Field(
        ...,
        description="Prediction date in YYYY-MM-DD format.",
        examples=["2026-09-22"],
    )

    # -- Contextual inputs ----------------------------------------------------
    is_holiday: int = Field(..., ge=0, le=1, description="1 if public holiday, else 0.")
    temp_celsius: float = Field(..., ge=-20.0, le=60.0, description="Forecasted temperature in Celsius.")
    rain_mm: float = Field(..., ge=0.0, description="Expected rainfall in mm.")
    local_event: int = Field(..., ge=0, le=1, description="1 if a local event is happening, else 0.")
    active_promotion: int = Field(..., ge=0, le=1, description="1 if kitchen has an active promotion, else 0.")
    competitor_promo: int = Field(..., ge=0, le=1, description="1 if competitor has a promotion, else 0.")
    cpi_index: float = Field(..., gt=0.0, description="Consumer Price Index for the region.")
    online_rating: float = Field(..., ge=1.0, le=5.0, description="Current online rating (1.0 to 5.0).")
    reservations: int = Field(..., ge=0, description="Number of advance reservations.")

    # -- Lag / rolling features (location-specific historical data) -----------
    demand_yesterday: float = Field(
        ..., ge=0.0,
        description="Customer count for the same location on the previous day.",
    )
    demand_7_days_ago: float = Field(
        ..., ge=0.0,
        description="Customer count for the same location exactly 7 days ago.",
    )
    demand_ma7: float = Field(
        ..., ge=0.0,
        description="7-day moving average of customer counts for the same location. "
                    "Calculated using shift(1) before rolling(7) -- no leakage.",
    )

    @field_validator("location_id")
    @classmethod
    def validate_location(cls, v: str) -> str:
        if v not in VALID_LOCATIONS:
            raise ValueError(
                f"'{v}' is not a valid location. "
                f"Must be one of Loc_1 through Loc_26."
            )
        return v

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        import datetime
        try:
            datetime.date.fromisoformat(v)
        except ValueError:
            raise ValueError("date must be in YYYY-MM-DD format, e.g. '2026-09-22'.")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "location_id": "Loc_3",
                "date": "2026-09-22",
                "is_holiday": 0,
                "temp_celsius": 24.5,
                "rain_mm": 0,
                "local_event": 0,
                "active_promotion": 1,
                "competitor_promo": 0,
                "cpi_index": 142.3,
                "online_rating": 4.2,
                "reservations": 125,
                "demand_yesterday": 410,
                "demand_7_days_ago": 395,
                "demand_ma7": 402.7,
            }
        }
    }


class PredictDemandResponse(BaseModel):
    """
    Andaza prediction response.

    recommended_production and expected_rescue are stubs until the
    production planning module is built.
    Formula: Production = MAX(0, Forecast x (1 + buffer%) - usable_inventory)
    """

    predicted_customers: int = Field(
        ..., description="Andaza's predicted customer count for the requested date/location."
    )
    recommended_production: Optional[int] = Field(
        None,
        description="[STUB] Requires dynamic buffer % and usable inventory -- not yet implemented.",
    )
    expected_rescue: Optional[int] = Field(
        None,
        description="[STUB] Expected rescue after production. Not yet implemented.",
    )

    # -- Diagnostic fields (helpful for debugging / display) -----------------
    location_id: str
    date: str
    derived_features: dict = Field(
        default_factory=dict,
        description="The computed temporal and cyclical features used as model input.",
    )
