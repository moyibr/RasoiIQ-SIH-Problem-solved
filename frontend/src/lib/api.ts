export interface ForecastPoint {
  date: string;
  predicted_kg: number;
  confidence_lower: number;
  confidence_upper: number;
}

export interface ForecastResponse {
  kitchen_id: number;
  category: string;
  unit: string;
  generated_at: string;
  predictions: ForecastPoint[];
}

export interface RescueEvent {
  id: number;
  kitchen_id: number;
  kitchen_name: string;
  category: string;
  is_vegetarian: boolean;
  quantity_kg: number;
  detected_at: string;
  expiry_at: string;
  rescue_window_hours: number;
  urgency_level: string;
  status: string;
}

export interface NGOMatch {
  ngo_id: number;
  ngo_name: string;
  contact_name: string;
  contact_phone: string;
  match_score: number;
  distance_km: number;
  eta_minutes: number;
  match_reason: string;
  lat: number;
  lng: number;
}

export interface Waypoint {
  lat: number;
  lng: number;
  label: string;
  type: string;
}

export interface RouteResponse {
  delivery_id?: number;
  waypoints: Waypoint[];
  total_distance_km: number;
  eta_minutes: number;
  route_polyline: number[][];
  route_geometry?: any;
  routing_method_used?: string;
}

export interface DailyStat {
  date: string;
  kg_rescued: number;
  kg_wasted: number;
  meals_served: number;
  co2_saved_kg: number;
}

export interface DashboardSummary {
  kg_rescued_today: number;
  kg_wasted_today: number;
  active_rescue_count: number;
  ngos_served_this_month: number;
  forecast_accuracy_pct: number;
  co2_saved_today_kg: number;
  cost_saved_today_inr: number;
  weekly_trend: DailyStat[];
}

// ---------------------------------------------------------------------------
// Andaza — Demand Prediction
// ---------------------------------------------------------------------------

/** Frontend form state — camelCase */
export interface PredictDemandRequest {
  locationId: string;       // → location_id
  date: string;             // → date  (same)
  isHoliday: number;        // → is_holiday
  tempCelsius: number;      // → temp_celsius
  rainMm: number;           // → rain_mm
  localEvent: number;       // → local_event
  activePromotion: number;  // → active_promotion
  competitorPromo: number;  // → competitor_promo
  cpiIndex: number;         // → cpi_index
  onlineRating: number;     // → online_rating
  reservations: number;     // → reservations  (same)
  demandYesterday: number;  // → demand_yesterday
  demand7DaysAgo: number;   // → demand_7_days_ago
  demandMa7: number;        // → demand_ma7
}

/** Backend response — mirrors PredictDemandResponse Pydantic schema */
export interface PredictDemandResponse {
  predicted_customers: number;
  recommended_production: number | null;  // stub — always null for now
  expected_rescue: number | null;         // stub — always null for now
  location_id: string;
  date: string;
  derived_features: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Processing Unit
// ---------------------------------------------------------------------------

export interface ProcessingUnitTrendPoint {
  date: string;
  day_of_week: string;
  process_yield_pct: number;
  downtime_pct: number;
  rejection_pct: number;
  energy_intensity_kwh_per_kg: number;
  net_good_output_kg: number;
  daily_profit_inr: number;
  root_cause: string;
}

export interface ProcessingUnitAggregates {
  avg_process_yield_pct: number;
  avg_downtime_pct: number;
  avg_rejection_pct: number;
  total_downtime_hours: number;
  total_energy_consumed_kwh: number;
  total_revenue_inr: number;
  total_cost_inr: number;
  total_profit_inr: number;
  total_waste_loss_inr: number;
  total_downtime_opportunity_loss_inr: number;
  total_net_good_output_kg: number;
  total_rejected_kg: number;
  period_energy_intensity_kwh_per_kg: number | null;
}

export interface ProcessingUnitMetrics {
  unit_id: number;
  date_range: { start: string; end: string };
  data_available: boolean;
  days_with_data: number;
  aggregates: ProcessingUnitAggregates | null;
  trend: ProcessingUnitTrendPoint[];
}

export interface FailedMetric {
  metric: string;
  value: number;
  threshold: string;
  direction: string;
}

export interface FlaggedDay {
  date: string;
  day_of_week: string;
  root_cause: string;
  failed_metrics: FailedMetric[];
  downtime_hours: number;
  net_good_output_kg: number;
  daily_profit_inr: number;
}

export interface FlaggedDaysResponse {
  unit_id: number;
  total_flagged_days: number;
  thresholds: Record<string, string>;
  flagged_days: FlaggedDay[];
}

// ---------------------------------------------------------------------------
// Sustainability Report
// ---------------------------------------------------------------------------

export interface SustainabilityMetrics {
  metadata: {
    period_start: string;
    period_end: string;
    is_synthetic_data: boolean;
    rescue_data_available: boolean;
  };
  rescue: {
    total_events_detected: number;
    kg_rescued: number | null;
    kg_wasted_expired: number | null;
    rescue_rate_pct: number | null;
  };
  impact: {
    co2e_avoided_kg: number | null;
    co2e_factor_source: string;
    meals_redistributed: number | null;
    meal_weight_assumption_kg: number;
  };
  top_wasted_categories: Array<{ category: string; kg_wasted: number }> | null;
  forecast_performance: {
    model: string;
    mae_customers_per_day: number;
    mape: null;
    note: string;
  };
  processing_unit: {
    unit_id: number;
    days_in_period: number;
    avg_process_yield_pct: number | null;
    avg_downtime_pct: number | null;
    data_available: boolean;
  };
}

export interface SustainabilityReport {
  provenance: {
    period_start: string;
    period_end: string;
    sources: string[];
    documented_assumptions: Record<string, string>;
    is_synthetic_data: boolean;
  };
  metrics: SustainabilityMetrics;
  narrative: string | null;
  narrative_source?: string;
  llm_error: string | null;
}

const PRIMARY_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080';
const FALLBACK_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8081';
const BASE_URL = ''; // Callers prepend this, making the arg an endpoint path like '/route'

/** Backend origin. Use this for one-off fetches instead of hardcoding a host:port. */
export const API_BASE_URL = PRIMARY_URL;

async function fetchWithCheck(endpoint: string, options?: RequestInit) {
  try {
    const response = await fetch(`${PRIMARY_URL}${endpoint}`, options);
    if (response.ok) return response.json();
    if (response.status !== 404 && response.status !== 502) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    // If connection refused or network error, silently fall through to try fallback
  }

  // Fallback
  const response = await fetch(`${FALLBACK_URL}${endpoint}`, options);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const api = {
  getForecast: async (kitchenId: string, startDate: string, daysAhead: number = 7): Promise<ForecastResponse> => {
    // Generate dates
    const dates: string[] = [];
    const start = new Date(startDate);
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }

    // Fetch predictions in parallel
    const promises = dates.map(date => {
      const params = new URLSearchParams({ kitchen_id: kitchenId, date: date });
      return fetchWithCheck(`${BASE_URL}/andaza/forecast?${params.toString()}`);
    });

    const responses: PredictDemandResponse[] = await Promise.all(promises);

    // Map to old expected format for the chart
    const predictions: ForecastPoint[] = responses.map(res => {
      return {
        date: res.date,
        // The chart expects kg, we are returning customers. 
        // For demo purposes, let's just map customers to kg (e.g. 1 customer = 0.5kg) or just pass it as is.
        // Let's pass it as is and the chart can just show the raw number.
        predicted_kg: res.predicted_customers,
        confidence_lower: res.predicted_customers * 0.9,
        confidence_upper: res.predicted_customers * 1.1
      };
    });

    return {
      kitchen_id: 1,
      category: 'Overall Demand (Customers)',
      unit: 'customers',
      generated_at: new Date().toISOString(),
      predictions: predictions
    };
  },

  getRescue: (status?: string): Promise<RescueEvent[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchWithCheck(`${BASE_URL}/rescue${query}`);
  },

  createManualRescue: (data: { kitchen_id: number; category_name: string; quantity_kg: number; hours_remaining_override?: number }) => {
    return fetchWithCheck(`${BASE_URL}/rescue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  getMatches: (rescueEventId: number): Promise<NGOMatch[]> => {
    return fetchWithCheck(`${BASE_URL}/rescue/${rescueEventId}/matches`);
  },
  
  optimizeRoute: (kitchenId: number, deliveryIds: number[]): Promise<RouteResponse> => {
    return fetchWithCheck(`${BASE_URL}/route/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kitchen_id: kitchenId, delivery_ids: deliveryIds }),
    });
  },

  getRoute: (deliveryId?: number): Promise<RouteResponse> => {
    const params = new URLSearchParams();
    if (deliveryId) params.append('delivery_id', deliveryId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchWithCheck(`${BASE_URL}/route${query}`);
  },

  getDashboardSummary: (): Promise<DashboardSummary> => {
    return fetchWithCheck(`${BASE_URL}/dashboard/summary`);
  },

  getProductionPlan: (kitchenId: string, date: string): Promise<any> => {
    return fetchWithCheck(`${BASE_URL}/production-plan/generate?kitchen_id=${kitchenId}&date=${date}`);
  },

  saveProductionPlan: (plan: any): Promise<any> => {
    return fetchWithCheck(`${BASE_URL}/production-plan/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
  },

  /**
   * POST /andaza/predict-demand
   *
   * Explicit camelCase → snake_case mapping (matches PredictDemandRequest Pydantic schema exactly):
   *   locationId       → location_id
   *   date             → date
   *   isHoliday        → is_holiday
   *   tempCelsius      → temp_celsius
   *   rainMm           → rain_mm
   *   localEvent       → local_event
   *   activePromotion  → active_promotion
   *   competitorPromo  → competitor_promo
   *   cpiIndex         → cpi_index
   *   onlineRating     → online_rating
   *   reservations     → reservations
   *   demandYesterday  → demand_yesterday
   *   demand7DaysAgo   → demand_7_days_ago
   *   demandMa7        → demand_ma7
   */
  predictDemand: (req: PredictDemandRequest): Promise<PredictDemandResponse> => {
    const body = {
      location_id:       req.locationId,
      date:              req.date,
      is_holiday:        req.isHoliday,
      temp_celsius:      req.tempCelsius,
      rain_mm:           req.rainMm,
      local_event:       req.localEvent,
      active_promotion:  req.activePromotion,
      competitor_promo:  req.competitorPromo,
      cpi_index:         req.cpiIndex,
      online_rating:     req.onlineRating,
      reservations:      req.reservations,
      demand_yesterday:  req.demandYesterday,
      demand_7_days_ago: req.demand7DaysAgo,
      demand_ma7:        req.demandMa7,
    };
    return fetchWithCheck(`${BASE_URL}/andaza/predict-demand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  getProcessingUnitMetrics: (unitId: number, dateRange: string): Promise<ProcessingUnitMetrics> =>
    fetchWithCheck(`${BASE_URL}/processing-unit/${unitId}/metrics?date_range=${encodeURIComponent(dateRange)}`),

  getFlaggedDays: (unitId: number): Promise<FlaggedDaysResponse> =>
    fetchWithCheck(`${BASE_URL}/processing-unit/${unitId}/flagged-days`),

  getSustainabilityReport: (dateRange: string): Promise<SustainabilityReport> =>
    fetchWithCheck(`${BASE_URL}/reports/sustainability?date_range=${encodeURIComponent(dateRange)}`),

  analyzeQuality: async (imageFile: File, rescueEventId?: number): Promise<any> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    if (rescueEventId) {
      formData.append('rescue_event_id', rescueEventId.toString());
    }
    const response = await fetch(`${PRIMARY_URL}/quality/analyze`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
    return response.json();
  },

  getEsgAnalytics: (): Promise<any> => fetchWithCheck(`${BASE_URL}/reports/esg-analytics`),

  getIotData: (unitId: number = 1): Promise<any> => fetchWithCheck(`${BASE_URL}/iot/data?unit_id=${unitId}`),
  simulateIotData: (unitId: number = 1): Promise<any> => fetchWithCheck(`${BASE_URL}/iot/simulate?unit_id=${unitId}`, { method: 'POST' }),
};

