import json
import logging
import httpx
import os
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a data analyst writing a sustainability report for a food waste reduction platform. "
    "Your task is ONLY to narrate the facts provided to you. "
    "Use only the numbers and facts provided in the context. "
    "Do not calculate, estimate, infer, or invent any figures, trends, causes, comparisons, "
    "recommendations, or facts that are not explicitly supported by the supplied context. "
    "If a metric value is 0 or 0.0, state it as zero - do not describe it as unavailable. "
    "Only describe a metric as unavailable if its value is explicitly null or None. "
    "Write in clear, professional prose suitable for an institutional sustainability report. "
    "Do not add a title — the caller will add that. Keep the response to 3-5 paragraphs."
)

def try_gemini(prompt: str) -> Optional[str]:
    """Primary: Hosted Google Gemini API"""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.warning("Gemini skipped: GEMINI_API_KEY not configured.")
        return None
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={api_key}"
    
    try:
        response = httpx.post(
            url,
            headers={"Content-Type": "application/json"},
            json={
                "systemInstruction": {
                    "parts": [{"text": SYSTEM_PROMPT}]
                },
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "temperature": 0.2
                }
            },
            timeout=15.0
        )
        response.raise_for_status()
        data = response.json()
        narrative = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        if narrative:
            return narrative
    except Exception as e:
        logger.warning(f"Gemini failed: {e}")
    return None


def generate_template(metrics: Dict[str, Any]) -> str:
    """Tier 2: Deterministic Template (Final Fallback)"""
    rescue_avail = metrics['metadata']['rescue_data_available']
    pu_avail = metrics['processing_unit']['data_available']
    
    paragraphs = []
    
    if rescue_avail:
        rescued = metrics['rescue']['kg_rescued']
        wasted = metrics['rescue']['kg_wasted_expired']
        co2e = metrics['impact']['co2e_avoided_kg']
        meals = metrics['impact']['meals_redistributed']
        paragraphs.append(
            f"During the reporting period, the platform facilitated the rescue of {rescued} kg of rescue food, "
            f"redistributing approximately {meals} meals. Simultaneously, {wasted} kg of food was recorded as expired or wasted. "
            f"The successful food recovery avoided an estimated {co2e} kg of CO2e emissions."
        )
        
        top = metrics.get('top_wasted_categories')
        if top:
            cats = ", ".join([f"{t['category']} ({t['kg_wasted']} kg)" for t in top])
            paragraphs.append(f"The top wasted food categories were: {cats}.")
            
    else:
        paragraphs.append(
            "No kitchen rescue data was recorded during this reporting period. "
            "Consequently, metrics for rescued food, redistributed meals, and avoided CO2e emissions are unavailable."
        )
        
    mae = metrics['forecast_performance']['mae_customers_per_day']
    paragraphs.append(
        f"The Andaza demand forecasting model operated with a Mean Absolute Error (MAE) of {mae} customers per day "
        "on the test set. (MAPE metric is not recorded)."
    )
        
    if pu_avail:
        y = metrics['processing_unit']['avg_process_yield_pct']
        d = metrics['processing_unit']['avg_downtime_pct']
        e = metrics['processing_unit']['total_energy_consumed_kwh']
        o = metrics['processing_unit']['total_net_good_output_kg']
        paragraphs.append(
            f"For the central processing unit, the average process yield was {y}%, with an average daily downtime of {d}%. "
            f"The unit consumed {e} kWh of energy to produce {o} kg of net good output."
        )
    else:
        paragraphs.append("Processing unit operational data is unavailable for this period.")
        
    return "\n\n".join(paragraphs)


def _get_cached_narrative() -> Optional[Tuple[str, str]]:
    """Loads a cached narrative if available for demo reliability."""
    cache_path = os.path.join(os.path.dirname(__file__), "..", "..", "demo_narrative_cache.json")
    try:
        if os.path.exists(cache_path):
            with open(cache_path, 'r') as f:
                data = json.load(f)
                narrative = data.get("narrative")
                source = data.get("narrative_source", "cached")
                if narrative:
                    return narrative, source
    except Exception as e:
        logger.warning(f"Failed to read narrative cache: {e}")
    return None


def generate_narrative(metrics: Dict[str, Any]) -> Tuple[str, str, Optional[str]]:
    """
    Structured ordered chain for narrative generation.
    Returns (narrative, narrative_source, error_message).
    """
    metrics_json = json.dumps(metrics, indent=2)

    prompt = (
        "Write a sustainability report narrative based solely on the following aggregated metrics. "
        "Do not invent any number or trend not explicitly present in this data.\n\n"
        f"=== METRICS CONTEXT (source of truth) ===\n{metrics_json}\n"
        "=== END OF CONTEXT ===\n\n"
        "Begin the narrative report now."
    )

    errors = []

    # Tier 1: Gemini
    narrative = try_gemini(prompt)
    if narrative:
        return narrative, "gemini", None
    errors.append("Gemini unavailable")

    # Tier 2 (Cache bypass for demo continuity)
    cached = _get_cached_narrative()
    if cached:
        narrative, source = cached
        return narrative, source, " -> ".join(errors) + " (fell back to cache)"

    # Tier 3: Template
    narrative = generate_template(metrics)
    return narrative, "template", " -> ".join(errors) + " (fell back to deterministic template)"
