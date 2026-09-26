"""
Andaza Demand Prediction Service
==================================
Loads the pre-trained XGBoost Poisson model once at import time and
exposes a single public function: predict(inputs) -> int.

Feature derivation follows the exact training pipeline:
  - Temporal: Day_of_Week, Month, Day_of_Year, Is_Weekend
  - Annual_Seasonality = 1.0 + 0.08 x sin(2pi x Day_of_Year / 365)
  - Cyclical: Month_sin/cos, DOW_sin/cos
  - OHE: Location_ID_Loc_1 to Location_ID_Loc_26 (lexicographic order)
"""

from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Model loading (singleton via module-level cache)
# ---------------------------------------------------------------------------

# Resolve model path relative to the repo root regardless of CWD
_REPO_ROOT = Path(__file__).resolve().parents[3]  # .../backend/app/services/ -> repo root
_MODEL_PATH = _REPO_ROOT / "models" / "andaza_xgb_poisson.json"


def _load_model():
    """Load the XGBoost model lazily; import xgboost here so the rest of the
    app still starts if xgboost is not installed (will raise on first predict)."""
    try:
        import xgboost as xgb  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "xgboost is not installed. Run: pip install xgboost"
        ) from exc

    if not _MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Andaza model not found at {_MODEL_PATH}. "
            "Make sure 'models/andaza_xgb_poisson.json' is present in the repo root."
        )

    booster = xgb.Booster()
    booster.load_model(str(_MODEL_PATH))
    return booster


# Module-level singleton - loaded once per worker process
_model: Any = None


def get_model():
    global _model
    if _model is None:
        _model = _load_model()
    return _model


# ---------------------------------------------------------------------------
# Feature constants
# ---------------------------------------------------------------------------

# 26 OHE columns in the exact lexicographic order stored in the model JSON
_LOCATION_COLS: list[str] = sorted(
    [f"Location_ID_Loc_{i}" for i in range(1, 27)]
)

# Full feature order (must match model training exactly -- 47 features total)
FEATURE_ORDER: list[str] = [
    "Day_of_Week",
    "Month",
    "Day_of_Year",
    "Is_Weekend",
    "Annual_Seasonality",
    "Is_Holiday",
    "Temp_Celsius",
    "Rain_mm",
    "Local_Event",
    "Active_Promotion",
    "Competitor_Promo",
    "CPI_Index",
    "Online_Rating",
    "Reservations",
    "Demand_Yesterday",
    "Demand_7_Days_Ago",
    "Demand_MA7",
    "Month_sin",
    "Month_cos",
    "DOW_sin",
    "DOW_cos",
    *_LOCATION_COLS,  # 26 OHE columns -> total = 21 + 26 = 47
]

assert len(FEATURE_ORDER) == 47, f"Expected 47 features, got {len(FEATURE_ORDER)}"

_TWO_PI = 2.0 * math.pi


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

def build_feature_vector(inputs: dict) -> pd.DataFrame:
    """
    Derive all 47 model features from raw kitchen-manager inputs.

    Parameters
    ----------
    inputs : dict
        Keys map to fields on PredictDemandRequest (snake_case).

    Returns
    -------
    pd.DataFrame  --  one row, columns in FEATURE_ORDER
    """
    import datetime

    date_obj = datetime.date.fromisoformat(inputs["date"])

    # -- Temporal features ----------------------------------------------------
    day_of_week = date_obj.weekday()              # 0=Monday ... 6=Sunday
    month = date_obj.month                        # 1-12
    day_of_year = date_obj.timetuple().tm_yday    # 1-365/366
    is_weekend = int(day_of_week >= 5)            # Saturday=5, Sunday=6

    # Annual seasonality (fitted against training CSV, max error ~0.0002)
    annual_seasonality = 1.0 + 0.08 * math.sin(_TWO_PI * day_of_year / 365)

    # -- Cyclical encodings ---------------------------------------------------
    month_sin = math.sin(_TWO_PI * month / 12)
    month_cos = math.cos(_TWO_PI * month / 12)
    dow_sin   = math.sin(_TWO_PI * day_of_week / 7)
    dow_cos   = math.cos(_TWO_PI * day_of_week / 7)

    # -- One-hot encode location_id -------------------------------------------
    location_id = inputs["location_id"]
    ohe: dict[str, int] = {col: 0 for col in _LOCATION_COLS}
    col_name = f"Location_ID_{location_id}"
    if col_name not in ohe:
        # Should already be caught by Pydantic validator, but guard here too
        raise ValueError(
            f"Unknown location_id '{location_id}'. "
            f"Valid values: Loc_1 through Loc_26."
        )
    ohe[col_name] = 1

    # -- Assemble row dict in FEATURE_ORDER -----------------------------------
    row = {
        "Day_of_Week":        day_of_week,
        "Month":              month,
        "Day_of_Year":        day_of_year,
        "Is_Weekend":         is_weekend,
        "Annual_Seasonality": annual_seasonality,
        "Is_Holiday":         inputs["is_holiday"],
        "Temp_Celsius":       inputs["temp_celsius"],
        "Rain_mm":            inputs["rain_mm"],
        "Local_Event":        inputs["local_event"],
        "Active_Promotion":   inputs["active_promotion"],
        "Competitor_Promo":   inputs["competitor_promo"],
        "CPI_Index":          inputs["cpi_index"],
        "Online_Rating":      inputs["online_rating"],
        "Reservations":       inputs["reservations"],
        "Demand_Yesterday":   inputs["demand_yesterday"],
        "Demand_7_Days_Ago":  inputs["demand_7_days_ago"],
        "Demand_MA7":         inputs["demand_ma7"],
        "Month_sin":          month_sin,
        "Month_cos":          month_cos,
        "DOW_sin":            dow_sin,
        "DOW_cos":            dow_cos,
        **ohe,
    }

    # Enforce exact column order
    df = pd.DataFrame([row])[FEATURE_ORDER]
    return df


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def predict(inputs: dict) -> tuple[int, dict]:
    """
    Run one Andaza demand prediction.

    Parameters
    ----------
    inputs : dict
        Fields matching PredictDemandRequest.

    Returns
    -------
    (predicted_customers: int, derived_features: dict)
    """
    import xgboost as xgb  # type: ignore

    df = build_feature_vector(inputs)
    dmatrix = xgb.DMatrix(df)

    booster = get_model()
    raw = booster.predict(dmatrix)          # shape (1,), already a positive count (Poisson)
    predicted = int(round(float(raw[0])))

    # Return derived (non-OHE) features for diagnostic display
    derived = {}
    for col in FEATURE_ORDER[:21]:  # first 21 non-OHE columns
        val = df[col].iloc[0]
        derived[col] = float(val) if df[col].dtype == float else int(val)

    return predicted, derived
