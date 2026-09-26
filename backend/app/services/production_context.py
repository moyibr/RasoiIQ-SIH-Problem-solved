# Assumed footprint-to-food-quantity conversion rates (kg or units per customer)
# NOTE: These are STATED ASSUMPTIONS representing typical institutional-meal serving sizes, not model-derived.
CONVERSION_RATES = {
    "Rice": 0.18,
    "Dal": 0.12,
    "Vegetable_Curry": 0.15,
    "Roti_Bread": 2.0,
    "Salad": 0.06,
    "Dessert": 0.05,
    "Beverages": 0.25,
    "Snacks": 0.08
}

# Fixed spoilage estimates per category (2-4%)
SPOILAGE_RATES = {
    "Rice": 0.02,
    "Dal": 0.02,
    "Vegetable_Curry": 0.04,
    "Roti_Bread": 0.03,
    "Salad": 0.04,
    "Dessert": 0.03,
    "Beverages": 0.02,
    "Snacks": 0.02
}

# Andaza does not output native confidence intervals (Poisson prediction).
# MAE ~48.8 on a baseline of ~295 ≈ 16.5% relative error.
# We use a SINGLE honestly-derived buffer tier: 1.2 * relative_error = 19.8% (0.198)
# This is a conscious simplification from the originally planned multi-tier approach.
FIXED_BUFFER_PCT = 0.198

def get_conversion_rate(category_name: str) -> float:
    return CONVERSION_RATES.get(category_name, 0.1)

def get_spoilage_rate(category_name: str) -> float:
    return SPOILAGE_RATES.get(category_name, 0.02)
