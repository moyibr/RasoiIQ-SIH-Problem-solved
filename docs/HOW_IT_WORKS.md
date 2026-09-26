# RasoiIQ - How It Works 🧠

This document is your cheat sheet for presenting RasoiIQ. It breaks down the core technical modules in simple terms for a 3rd-year CS student, explaining exactly where the code lives, how the data flows, the math behind it, and how to defend it during judge Q&A.

---

## 1. Demand Forecasting (Andaza Engine)

**What it does:**
Predicts how many customers will show up at an institutional kitchen (like a college hostel) tomorrow and the next 7 days, so the kitchen doesn't overcook or undercook.

**Where the code lives:**
- **Backend Model:** `backend/app/services/andaza.py` (loads the trained XGBoost model and preprocessor).
- **Backend API:** `backend/app/routers/andaza.py` (`GET /andaza/forecast`).
- **Frontend UI:** `frontend/src/app/andaza/page.tsx` and the `ForecastChart` component.

**Data Flow:**
1. User requests a forecast on the frontend for `K1_MainCampus`.
2. Frontend calls `GET /andaza/forecast` via `api.ts`.
3. The backend fetches historical weather, holidays, and past 7-day lagged data for that specific location.
4. It feeds this array into the pre-trained XGBoost (`.joblib` file) via `model.predict()`.
5. The predicted customer count is returned and plotted on the Recharts UI.

**Formulas/Assumptions:**
- **Model:** XGBoost Regressor.
- **Lag Features:** It uses `demand_yesterday`, `demand_7_days_ago`, and a 7-day moving average (`demand_ma7`) to catch weekly patterns.
- **Cold-Start Assumption:** If tomorrow's exact temperature isn't known, we use a historical monthly "climatology average" fallback.

**Top 5 Judge Questions:**
1. **Q:** *Why XGBoost and not Deep Learning (LSTM)?* 
   **A:** XGBoost handles tabular data (like holidays + lag features) better and trains much faster with less data than LSTMs, while providing clear feature importance.
2. **Q:** *What happens if historical data is missing?* 
   **A:** The system imputes missing weather using seasonal averages and fills lag values with rolling means to ensure the model always gets a valid vector.
3. **Q:** *How do you map customers to food quantity?* 
   **A:** Our production plan multiplies predicted customers by a standard portion size (e.g., 0.4 kg/meal) plus a small safety buffer (e.g., 5%).
4. **Q:** *Did you train this model yourself?* 
   **A:** Yes, the model was trained on a synthetic dataset representing institutional kitchen consumption, which was engineered to reflect realistic weekly and seasonal variance.
5. **Q:** *What is your error rate?*
   **A:** The Mean Absolute Error (MAE) on our test set is ~49 customers/day, which is highly accurate for a batch-cooking kitchen.

---

## 2. Food Quality Check (Computer Vision)

**What it does:**
Allows users to upload a photo of food to instantly calculate a "Freshness Score" (0-100) and decide if the food is safe to donate or if it's spoiling.

**Where the code lives:**
- **Backend API:** `backend/app/routers/quality.py` (`POST /quality/analyze`).
- **Frontend UI:** `frontend/src/app/quality/page.tsx`.

**Data Flow:**
1. User uploads an image on the frontend, which sends it as a `multipart/form-data` payload.
2. `quality.py` reads the image into memory using `cv2.imdecode` (OpenCV).
3. The image is resized and converted from BGR to HSV (Hue, Saturation, Value) color space.
4. The algorithm calculates the variance of the Value channel (texture) and counts the ratio of "dark/bruised pixels".
5. A score is returned. If the user provided a `rescue_event_id`, the backend automatically updates that item's urgency to `HIGH` in the SQLite database if the score is low.

**Formulas/Assumptions:**
- **Dark Spot Ratio:** `dark_pixels / total_pixels`. If this ratio is high, freshness drops.
- **Texture Variance:** High variance in the V channel indicates uneven coloration (bruising/spoilage).
- **Lightweight CPU Assumption:** Instead of a heavy CNN (like YOLO/ResNet) that requires a GPU, we use deterministic color space math so it runs instantly on any server.

**Top 5 Judge Questions:**
1. **Q:** *Does this use Machine Learning?* 
   **A:** No, to ensure it runs instantly on cheap servers without GPUs, it uses deterministic OpenCV color and texture heuristics. However, the architecture allows a CNN to be hot-swapped into the `analyze()` function later.
2. **Q:** *Why HSV color space instead of RGB?* 
   **A:** HSV separates the color (Hue) from the lighting (Value). This makes our algorithm robust against different lighting conditions in a kitchen.
3. **Q:** *How does this tie into the platform?* 
   **A:** If food is marked "Near-Spoilage", the backend automatically bumps its dispatch urgency to RED, prioritizing it in the routing engine.
4. **Q:** *What types of food does it work best on?* 
   **A:** Currently, it works best on produce and grains where spoilage manifests as dark spots or texture degradation.
5. **Q:** *What happens if the image is blurry?* 
   **A:** Extremely low variance across the whole image would flag it, but currently, we assume reasonable camera focus. Adding a laplacian variance check for blur is a future addition.

---

## 3. ESG & Sustainability Analytics

**What it does:**
Calculates the environmental and social impact of the food rescued by the platform (CO2 saved, meals donated) and generates a printable dashboard.

**Where the code lives:**
- **Backend API:** `backend/app/routers/reports.py` (`GET /reports/esg-analytics`).
- **Frontend UI:** `frontend/src/app/esg-report/page.tsx` (using Recharts).

**Data Flow:**
1. Frontend loads the ESG page and requests `/reports/esg-analytics`.
2. Backend queries the `RescueEvent` table for all items marked `MATCHED` or `DELIVERED` (saved) vs `EXPIRED` (wasted).
3. It loops through the records, applying constants to calculate CO2, meals, and financial value.
4. It groups the data by `YYYY-MM` to build a time-series array.
5. Frontend renders this array into dynamic bar charts and metric cards.

**Formulas/Assumptions:**
- **Meals Donated:** `Total Kg Saved / 0.4 kg` (FSSAI institutional assumption of 400g per meal).
- **CO2e Avoided:** `Total Kg Saved * 2.5 kg` (FAO 2013 global average: 1kg of food waste = 2.5kg CO2e).
- **Waste Prevention Rate:** `Saved / (Saved + Wasted) * 100`.

**Top 5 Judge Questions:**
1. **Q:** *Where do the CO2 and meal constants come from?* 
   **A:** The 2.5kg CO2 multiplier is from the UN FAO Food Wastage Footprint report. The 0.4kg meal size is based on standard FSSAI institutional portion guidelines.
2. **Q:** *Is the ESG data real-time?* 
   **A:** Yes, it directly queries the live transactional SQL database, so the moment a food packet is delivered, the CO2 saved chart updates.
3. **Q:** *Can NGOs use this report?* 
   **A:** Yes, the dashboard includes a "Download PDF" hook, allowing kitchens or NGOs to export their ESG impact for CSR compliance or tax benefits.
4. **Q:** *How do you prevent double counting?* 
   **A:** The SQL query strictly filters by `status.in_(['DELIVERED', 'MATCHED'])`. Cancelled or pending events are ignored.
5. **Q:** *Why is this feature important?* 
   **A:** Gamification and ESG reporting drive adoption. Corporations adopt platforms faster if it directly helps their ESG compliance metrics.

---

## 4. Processing Unit Monitor (IoT Simulator)

**What it does:**
Monitors conditions inside a food processing unit (like a cold storage room). It catches temperature spikes or machine downtime before food spoils.

**Where the code lives:**
- **Database Model:** `backend/app/models/iot.py` (`IoTSensorData` table).
- **Backend API:** `backend/app/routers/iot.py` (Ingest and simulate endpoints).
- **Frontend UI:** `frontend/src/app/iot-monitor/page.tsx`.

**Data Flow:**
1. A sensor (or our Simulator button) POSTs a JSON payload with temp, humidity, and energy to `/iot/ingest`.
2. The backend saves the reading to SQLite and runs "rule-based" checks (e.g., is temp > 5°C?).
3. If a rule fails, the backend returns a list of alert strings in the HTTP response.
4. The frontend `/iot-monitor` dashboard polls `/iot/data` every 10 seconds to update the live LineChart, and renders active alerts.

**Formulas/Assumptions:**
- **Safe Temp Zone:** Assumed to be 0°C to 5°C (standard cold storage).
- **Downtime Threshold:** >15 minutes triggers an alert, as prolonged machine stoppage threatens processing yields.
- **Simulation Randomness:** Pressing "Simulate" has an 80% chance of normal data and a 20% chance of injecting a deliberate anomaly to demo the alerts.

**Top 5 Judge Questions:**
1. **Q:** *Is this actually connected to real sensors?* 
   **A:** It is "IoT-Ready". We provide a standard HTTP POST endpoint (`/iot/ingest`). Any ESP32 or Raspberry Pi can push JSON to it right now. For the demo, we use a simulator.
2. **Q:** *Why didn't you use MQTT for IoT?* 
   **A:** HTTP REST is sufficient for a prototype polling at 10-second intervals. In production, we would switch to an MQTT broker (like Mosquitto) with WebSockets for true real-time streaming.
3. **Q:** *What happens when a temperature alert fires?* 
   **A:** Currently, it alerts the dashboard operator. In a full deployment, this would trigger an automated SMS/email to the floor manager via Twilio.
4. **Q:** *How does IoT help reduce food waste?* 
   **A:** If a cold room fails, hundreds of kilos of raw ingredients spoil before they even reach the kitchen. Upstream monitoring prevents this.
5. **Q:** *Is the database going to fill up instantly?* 
   **A:** IoT data is voluminous. In production, we would use a time-series database (like InfluxDB or TimescaleDB) to automatically downsample older data, rather than keeping every second in PostgreSQL/SQLite.
