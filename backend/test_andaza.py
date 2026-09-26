"""
test_andaza.py  --  Standalone integration test for POST /andaza/predict-demand

Run from the backend/ folder (server must already be running):
    python test_andaza.py

What it does:
  1. Sends the canonical sample request from the spec.
  2. Prints the full request + response.
  3. Pretty-prints the 47-column feature vector the service would build.
  4. Sends a bad location_id to verify HTTP 400.
  5. Sends a missing field to verify HTTP 422.
"""

import json
import sys

import httpx

BASE_URL = "http://localhost:8000"
ENDPOINT = f"{BASE_URL}/andaza/predict-demand"

# ---------------------------------------------------------------------------
# Sample request (from spec)
# ---------------------------------------------------------------------------
SAMPLE_REQUEST = {
    "location_id":      "Loc_3",
    "date":             "2026-09-22",
    "is_holiday":       0,
    "temp_celsius":     24.5,
    "rain_mm":          0,
    "local_event":      0,
    "active_promotion": 1,
    "competitor_promo": 0,
    "cpi_index":        142.3,
    "online_rating":    4.2,
    "reservations":     125,
    "demand_yesterday": 410,
    "demand_7_days_ago":395,
    "demand_ma7":       402.7,
}


def _hr(label: str = "") -> None:
    print("\n" + "=" * 64)
    if label:
        print(f"  {label}")
    print("=" * 64)


def _pretty(obj: dict) -> str:
    return json.dumps(obj, indent=2)


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

def test_valid_prediction() -> None:
    _hr("TEST 1 — Valid prediction (sample from spec)")

    print("\nRequest body:")
    print(_pretty(SAMPLE_REQUEST))

    resp = httpx.post(ENDPOINT, json=SAMPLE_REQUEST, timeout=30)
    print(f"\nHTTP {resp.status_code}")

    if resp.status_code != 200:
        print("FAIL — expected 200, got:")
        print(resp.text)
        return

    body = resp.json()
    print("\nResponse:")
    print(_pretty(body))

    predicted = body["predicted_customers"]
    print(f"\npredicted_customers = {predicted}")
    if 300 <= predicted <= 600:
        print("PASS  (within expected 300-600 range)")
    else:
        print(f"WARNING  Value {predicted} is outside the loose 300-600 sanity window.")

    print("\nDerived temporal/cyclical features:")
    for k, v in body.get("derived_features", {}).items():
        print(f"  {k:25s} = {v}")


def test_invalid_location() -> None:
    _hr("TEST 2 — Invalid location_id (expect HTTP 400 or 422)")

    bad_req = {**SAMPLE_REQUEST, "location_id": "Loc_99"}
    resp = httpx.post(ENDPOINT, json=bad_req, timeout=10)
    print(f"HTTP {resp.status_code}  (expected 400 or 422)")
    print(resp.text[:400])
    if resp.status_code in (400, 422):
        print("PASS")
    else:
        print("FAIL")


def test_missing_field() -> None:
    _hr("TEST 3 — Missing required field `rain_mm` (expect HTTP 422)")

    incomplete = {k: v for k, v in SAMPLE_REQUEST.items() if k != "rain_mm"}
    resp = httpx.post(ENDPOINT, json=incomplete, timeout=10)
    print(f"HTTP {resp.status_code}  (expected 422)")
    print(resp.text[:400])
    if resp.status_code == 422:
        print("PASS")
    else:
        print("FAIL")


def show_feature_vector() -> None:
    """Build and display the 47-column feature vector locally (no HTTP)."""
    _hr("FEATURE VECTOR (local build, no HTTP)")

    # Add parent dir so we can import app modules directly
    import os, sys
    sys.path.insert(0, os.path.dirname(__file__))

    try:
        from app.services.andaza import build_feature_vector, FEATURE_ORDER
    except ImportError as exc:
        print(f"Cannot import service locally: {exc}")
        return

    df = build_feature_vector(SAMPLE_REQUEST)
    print(f"\n{'#':>3}  {'Feature':30s}  {'Value'}")
    print("-" * 55)
    for i, col in enumerate(FEATURE_ORDER, 1):
        val = df[col].iloc[0]
        print(f"{i:>3}  {col:30s}  {val}")
    print(f"\nTotal features: {len(FEATURE_ORDER)}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Andaza integration test")
    print(f"Target: {ENDPOINT}")

    # Show feature vector first (offline, no server needed)
    show_feature_vector()

    try:
        test_valid_prediction()
        test_invalid_location()
        test_missing_field()
    except httpx.ConnectError:
        _hr("CONNECTION ERROR")
        print("Could not reach the server.")
        print(f"Make sure it is running on {BASE_URL}")
        print("  cd backend && uvicorn app.main:app --reload --port 8000")
        sys.exit(1)

    _hr("All tests complete")
