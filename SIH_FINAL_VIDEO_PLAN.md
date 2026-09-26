# SIH 2026 Final Submission — Screen Recording Plan & Voice-over Script
### RasoiIQ — AI-Powered Food Reduction & Surplus Distribution Management

> This document supersedes `SIH_DEMO_SCRIPT.md`, which contains incorrect metrics and
> claims (MAE 48.8, "Google's OR-Tools", an "NGO" signup role, and "strict RBAC").
> Every number, label and behaviour below was verified against the running code.

---

## PART 0 — Verified SIH Rules & Compliance Gate

### Confirmed from official SIH 2026 sources

| Rule | Source | Status |
|---|---|---|
| Evaluation criteria: **novelty, complexity, clarity & detail in prescribed format, feasibility, practicability, sustainability, scale of impact, user experience, future work progression** | `sih.gov.in/letters/2026/SIH 2026 Guidelines.pdf` | Verified |
| Demo video **must not be AI-generated**; **audio narration must not be AI-generated** and must be delivered by team members | Institute portal (LDRP-ITR), SIH 2026 Software Edition guidelines | Verified |
| Video **should contain a working prototype** | Same | Verified |
| Explanation must be presented by the team members themselves | Same | Verified |
| GitHub repository link is **mandatory** | Same | Verified |
| Repository **must be kept private** until judging is complete | Same | Verified |
| Repo must contain source, documentation and a README with objective, features, stack, setup, and implementation status | Same | Verified |
| Submission items: idea title, idea description, and presentation in **PDF** | `sih.gov.in` / SIH 2026 Guidelines | Verified |

### Still unconfirmed — you must check before recording

1. **Maximum video duration.** I could not find a published SIH-wide limit. An older
   SIH rubric used *5 min presentation + 3 min Q&A*, and many 2026 institute portals
   issue their own cap. **Confirm the exact limit with your institute SPOC.**
   This plan is written to **7:00**, and Section 3.14 gives a **5:00 cut-down**.
2. **Resolution / aspect ratio / file-size limit.** Not published centrally.
3. **Whether narration must be in a specific language.** Assume English.
4. **Portal field the video is uploaded to**, and whether it is unlisted YouTube or a direct file.

> **HARD STOP — compliance risks to fix now**
> - The repo `moyibr/RasoiIQ-SIH-Problem-solved` was just pushed as **PUBLIC**. SIH rules
>   require it to stay **private**. Run: `gh repo edit moyibr/RasoiIQ-SIH-Problem-solved --visibility private --accept-visibility-change-consequences`
> - Do **not** use an AI voice generator for the narration. A team member must speak it.

---

## PART 1 — Pre-Recording Fixes (do these BEFORE you record)

These are factual mismatches between the code and what the narration would claim. An
evaluator who cross-checks will lose confidence. Each is a small, safe edit.

### 1.1 Blocking — wrong metric on screen
`frontend/src/app/dashboard/page.tsx:122` displays **`ANYA Ai ENGINE · MAE 49`**.
The model currently in the repo (`models/andaza_xgb_poisson.json`) measured
**validation MAE 53.31** and **test MAE 101.41**.
**Fix:** change the badge to the real number (`MAE 53`), or retrain and paste the
actual figure. Never show a number you cannot defend.

### 1.2 Blocking — inconsistent product name
The module, folder, API and repo all say **Andaza**. The UI says **ANYA Ai**:
- `frontend/src/app/andaza/page.tsx:310` (header), `:489` (button), `:670`, `:690` (accordion)
- `frontend/src/components/layout/Sidebar.tsx:48`
- `frontend/src/app/dashboard/page.tsx:122`

**Fix:** standardise on one name. Recommended: **"Andaza AI"** everywhere.
Judges notice when a product has two names.

### 1.3 Must disclose honestly in the video (or fix)
| Item | Reality | Where |
|---|---|---|
| "Confirm Dispatch" | Only fires a browser `alert()`; nothing is persisted | `frontend/src/components/rescue/NGOMatchList.tsx:109` |
| Map routing | Sends `delivery_id = 1` and passes a rescue ID as a stand-in delivery ID | `frontend/src/app/map/page.tsx:57-58` |
| "Download PDF" | Calls `window.print()` (browser print-to-PDF) | `frontend/src/app/esg-report/page.tsx:31` |
| Auth | Demo login + client-side role routing; **not** production RBAC | `frontend/src/store/authStore.ts` |
| Signup roles | Exactly **Donor, Volunteer, Admin** — there is no "NGO" role | `frontend/src/app/signup/page.tsx:48-50` |
| IoT | Rule-based thresholds over a **simulated** sensor feed | `backend/app/routers/iot.py:60-73` |
| Quality CV | Heuristic HSV dark-spot ratio, **not** a trained classifier | `backend/app/routers/quality.py:32-67` |

Say these plainly in the closing segment. Judges reward stated limitations far more
than discovered ones.

### 1.4 Seed data that will make the demo look broken
`backend/scripts/seed_data.py:132` assigns every rescue row `status` of only
`'delivered'` or `'pending'` — **never `'ACTIVE'`**. But three pages filter on ACTIVE:
- `frontend/src/app/rescue/page.tsx:29` → `getRescue('active')`
- `frontend/src/app/map/page.tsx:31` → `getRescue('ACTIVE')`
- `frontend/src/app/volunteer/page.tsx:13` → `?status=ACTIVE`

So on a fresh seed those three pages render **"No active rescue"**.
**This is fine — the recording itself creates the live event.** Follow the runbook in
Part 2. (A cleaner permanent fix is to seed a few ACTIVE rows, but the live-creation
flow is a *better* demo because it shows the write path.)

---

## PART 2 — Recording Setup & Data Runbook

### 2.1 Capture settings
- 1920×1080, 16:9, 60 fps (30 fps acceptable), **1440p+ if the portal allows**
- Browser: Chrome or Edge, **not** incognito; zoom to **100%**
- Hide bookmarks bar, extensions, and the Windows taskbar clock
- Close Slack/WhatsApp and any notification overlays
- Microphone: external or headset, tested for room echo. Narration quality is judged.
- Optional: `Ctrl+Shift+8` to start the Windows recorder with microphone
- **Do not** show any real personal data, phone numbers, or email addresses in the DB

### 2.2 Start the app (two terminals, or `start.bat`)
```powershell
# Terminal 1 — backend (MUST be run from the backend folder so SQLite path resolves)
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --port 8080

# Terminal 2 — frontend
cd frontend
npm run dev
```
Verify before recording: `http://localhost:8080/health` and `http://localhost:3000`.

### 2.3 Pre-flight checks (open these once, off-camera)
1. `/andaza` → run "Load sample" → a number appears
2. `/iot-monitor` → click "Simulate Reading" up to **6 times** until a red alert appears
   (anomalies are only ~20% likely per click). Then **stop the backend** so no new
   readings arrive mid-take and your alert stays on screen.
   *(Cleaner: `POST /iot/ingest` an anomalous reading — temp 7.4 °C, humidity 91%,
   downtime 32 min, energy 78 kWh — immediately before the take.)*
3. `/esg-report` → 5 KPI tiles and both charts render
4. `/processing-unit` → switch `7d` → `30d` → `All` once each so the data is cached
5. `/map` → open `http://localhost:8080/docs` and run `POST /route/optimize` once to
   warm the OSRM response cache (this route needs **live internet**; if the venue has
   no network, have this result ready to narrate rather than clicking on camera)

### 2.4 The one input that makes the whole chain work on camera
`POST /rescue` (`backend/app/routers/rescue.py:73-121`) is the only endpoint that
writes `status="ACTIVE"` and back-dates `batch_created_at` from
`hours_remaining_override`. It is the hinge of the entire demo.

**Use the "Manual Entry Override" form** at the bottom-left of `/rescue` (Scene 7):

| Field | Enter | Why |
|---|---|---|
| Category | `Rice` | Accepted by the most NGOs |
| Qty | `15` kg | Under Smile NGO's 20 kg cap, so you get multiple matches |
| Hrs Left | `5` | Non-expired, leaves margin for travel + the 0.5 h safety buffer |

NGO seed data (`backend/data/seed_ngo_recipients.csv`) guarantees coverage:

| NGO | Capacity | Accepts | Open (IST) | Notes |
|---|---|---|---|---|
| **Care Trust** | 100 kg | ALL | 00:00–23:59 | **Always eligible — your reliable top match** |
| Hope Foundation | 50 kg | ALL | 08:00–20:00 | Matches outside those hours too |
| Smile NGO | 20 kg | Rice, Dal, Roti_Bread | 09:00–21:00 | Matches your Rice entry |
| Feeding India Blr | 30 kg | Vegetable_Curry, Dessert | 07:00–18:00 | Will not match Rice |

> Operating hours are compared in **IST** (`backend/app/services/matching_engine.py:41-89`).
> Care Trust is open 24 h, so **Rice / 15 kg / 5 h always yields at least one match at any hour.**

---

## PART 3 — Scene-by-Scene Recording Plan

**Target: 7:00.** VO is written to be spoken at ~140 wpm. `[SCREEN]` = what is on
display. `»` marks a cursor action or click.

---

### SCENE 1 — Title & Problem  `0:00 – 0:35` (35 s)

**[SCREEN]** Clean title card. RasoiIQ logo, tagline, team name, SIH 2026.
Fade in over a still of a commercial kitchen.

**VO:**
> "In India, an estimated forty percent of the food produced in institutional
> kitchens never reaches a person. It is cooked, it is safe, and then it is thrown
> away. The problem is not a lack of food. It is a coordination failure: nobody
> knows that forty kilos of safe rice will go unused in three hours, and no one has
> a system that can move it to the people who need it before it spoils.
>
> RasoiIQ is a working platform that closes that gap. It predicts demand so kitchens
> do not overproduce, detects surplus the moment it exists, and dispatches it to
> verified organisations inside the window in which it is still safe to eat."

---

### SCENE 2 — Solution at a Glance  `0:35 – 1:05` (30 s)

**[SCREEN]** Architecture diagram (build as an animated slide, see Part 4).
Highlight each layer as you name it.

**VO:**
> "RasoiIQ runs as two services. A Next.js front end for the kitchen managers,
> volunteers and administrators who use it day to day. And a Python FastAPI back end
> holding the business logic and four models.
>
> Six capabilities sit on top of that: demand forecasting, image-based quality
> checking, rescue event management, NGO matching, route optimisation, and
> sustainability reporting. I will walk you through each one on a running system."

---

### SCENE 3 — Access & Roles  `1:05 – 1:25` (20 s)

**[SCREEN]** `/login`. Then `/signup`, highlighting the role dropdown.
Then log in as a **Volunteer** and land on `/volunteer`.

**VO:**
> "Access is role-based. A Donor is a kitchen, a Volunteer is a delivery partner,
> and an Admin oversees the network. Each role is routed to its own workspace on
> sign-in. This is a demonstration login rather than production-grade
> authentication, which is on our future-work list."

---

### SCENE 4 — Command Dashboard  `1:25 – 2:00` (35 s)

**[SCREEN]** `/dashboard`. Slow pan across the KPI row, then the 7-day forecast
chart, then the production plan table.
**Action:** hover the chart so the tooltip appears.

**VO:**
> "This is the operations dashboard, and it answers one question: what needs
> attention right now?
>
> The top row surfaces the live KPIs — rescue events, the Andaza forecast, and the
> processing unit's efficiency. The chart in the middle is a rolling seven-day
> demand forecast per location; hovering gives the exact value for any day.
>
> Below it, the production plan converts a forecast into a shopping and prep list
> per food category. This is the payoff of the forecasting model: a prediction you
> cannot act on is just a number, so we turn it directly into a task list for the
> kitchen team."

---

### SCENE 5 — Andaza Demand Forecasting  `2:00 – 2:50` (50 s)

**[SCREEN]** `/andaza`. The docket form on the left, result panel on the right.
**Actions, in this order:**
1. Click **"Load sample"** — fills 12 inputs instantly, no typing on camera.
2. Click **"Run ANYA Ai"** (rename to "Run Andaza" per 1.2).
3. Wait for the counter to animate up to the predicted covers.
4. Point at the two deltas: *vs. yesterday* and *vs. same day last week*.
5. **Click "What Andaza considered"** to expand the derived-feature panel — the single
   best technical moment in the video.
6. Optionally toggle **"Active promotion"** on, re-run, and show the number move.
   This proves it is live inference, not a lookup.

**VO:**
> "Andaza is our demand forecasting module, and it is the module that prevents
> waste rather than cleaning it up afterwards.
>
> The kitchen manager enters a small docket: which location, which date, recent
> demand, the weather, and a few operational flags such as a holiday or a running
> promotion. Behind that, the service derives forty-seven features — calendar and
> cyclical encodings for day-of-week and month, an annual seasonality term, the
> demand lags, and one-hot encoding for each of twenty-six locations.
>
> Those features feed an XGBoost regression model trained with a Poisson objective,
> which is the right loss for a non-negative count like expected covers.
>
> The result comes back as a single number, shown here in estimated covers, with
> the percentage change against yesterday and against the same day last week, so a
> manager can judge the forecast against their own intuition.
>
> Expanding this panel shows every derived feature the model actually consumed.
> Nothing is hidden between the input form and the prediction."

> **Timing note:** if you are short on time, cut action 6. Keep action 5.

---

### SCENE 6 — Quality Check (Computer Vision)  `2:50 – 3:20` (30 s)

**[SCREEN]** `/quality`. Have a **real food photograph** ready on the Desktop.
**Actions:**
1. Drag-and-drop or choose a **fresh-looking** dish → show a high score / "Fresh".
2. Upload a **dark, discoloured or mouldy** image → show a low score / "Spoiled".
3. Link the image to a rescue event if the UI exposes the field — the backend then
   raises that event's urgency automatically.

**VO:**
> "Before food is dispatched, it is verified. Upload a photograph and our computer
> vision service scores it.
>
> The image is decoded with OpenCV and converted into HSV colour space. We then
> measure the ratio of dark, discoloured pixels — the visual signature of spoilage —
> and combine that with brightness variance to produce a zero to one hundred
> freshness score. Above seventy-five we call it fresh, below forty we reject it.
>
> This is deliberately a lightweight heuristic rather than a deep classifier, so it
> runs on CPU with no model download. It is linked to the rescue event, so a poor
> score automatically raises that event's urgency and it moves up the dispatch
> queue. Swapping in a trained classifier is a contained change — the interface
> will not move."

---

### SCENE 7 — Rescue Triage & Event Creation  `3:20 – 4:05` (45 s)

**[SCREEN]** `/rescue`. Left column = triage queue, right column = matches,
bottom-left = **Manual Entry Override**.

**Actions:**
1. Show the queue, then note the urgency colour coding and the T-minus countdown.
2. **The money shot:** in Manual Entry Override select **Rice**, type **15** in Qty,
   type **5** in Hrs Left, click **Seed**. A browser alert confirms; the page reloads.
3. The new event now sits at the top of the queue with a live T-minus and a
   non-expired urgency colour.
4. **Click the new event** to load matches.

**VO:**
> "When surplus is detected, it becomes a rescue event — and every event carries a
> countdown. The queue is ordered by urgency, and each row shows the quantity, the
> urgency band, and the time remaining before the food is no longer safe to
> distribute. Red is critical, amber is urgent, and a struck-through row is already
> expired and correctly withheld.
>
> Here I am logging a live event rather than reading a seeded one: fifteen
> kilograms of rice from our main kitchen with five hours of shelf life remaining.
> The backend writes it with an ACTIVE status, and back-dates the batch timestamp so
> the remaining window is derived from the category's shelf life, not from a
> hard-coded number.
>
> The row appears at the top of the queue immediately. This is the write path — the
> same endpoint the IoT ingestion and the donor dashboard call."

---

### SCENE 8 — NGO Matching & Dispatch  `4:05 – 4:40` (35 s)

**[SCREEN]** `/rescue` right column — ranked match cards with score rings.
**Actions:**
1. Point at the top card: score %, ETA, distance, and the "Optimal Route
   Recommended" flag.
2. Point at the second/third cards to show genuine ranking, not one result.
3. Click **Confirm Dispatch** once — acknowledge the confirmation dialog.

**VO:**
> "Selecting an event runs the matching engine, which is deliberately two-stage.
>
> First, hard filters. An organisation must accept this food category, be within
> fifteen kilometres, have capacity for the full quantity, be open at the estimated
> arrival time, and have enough shelf life left to cover travel plus a thirty-minute
> safety buffer. Anything that fails is discarded outright — we never rank a match
> that cannot actually be delivered.
>
> Second, scoring. Survivors are scored on a weighted blend: distance at forty
> percent, capacity fit at twenty-five, time margin at twenty, and category match at
> fifteen. An organisation that has already been served today is penalised, so load
> spreads across the network instead of concentrating on one.
>
> Results come back ranked, with the score, ETA and distance, and the reason behind
> each. Here the top match is Care Trust — it accepts every category, has a hundred
> kilogram capacity, and is open around the clock, which is exactly why it scores
> highest for a fifteen kilogram rice batch."

> **Honesty beat — say this:** "Confirm Dispatch confirms the selection in this
> prototype. Persisting the assignment end-to-end is implemented on the backend and
> is the next integration step."

---

### SCENE 9 — Route Optimisation & Live Map  `4:40 – 5:10` (30 s)

**[SCREEN]** `/map`. NGO Dispatch Queue overlay on the right, map below.
**Action:** click **"Optimize Route"** once. Let the polyline draw. Then point at
Total Distance, Est. Time, Waypoints, and the **Method** badge.

**VO:**
> "Matching answers *which* organisation. Routing answers *in what order*.
>
> The optimiser models this as a capacitated vehicle routing problem with time
> windows, solved with OR-Tools, using a distance matrix from OSRM. The time windows
> matter as much as the distance: arriving early is as much a failure as arriving
> late if the organisation is closed.
>
> The result gives total distance, estimated time, the waypoint sequence, and the
> method actually used. A live road network is queried over the internet, so this
> step depends on connectivity; where that is unavailable the engine falls back to a
> nearest-neighbour heuristic over straight-line distance."

---

### SCENE 10 — Processing Unit Efficiency  `5:10 – 5:40` (30 s)

**[SCREEN]** `/processing-unit`. Four scorecards, sum row, four trend charts,
Flagged Days table.
**Actions:**
1. Click **7d → 30d** to show the range switch working.
2. Point at the reference lines: yield ≥ 82%, downtime ≤ 15%, rejection ≤ 3%.
3. Scroll to **Flagged Days** and point at the failed-metric chips and the ₹ profit/loss.

**VO:**
> "RasoiIQ also covers the processing unit itself, not only the surplus it creates.
>
> This page aggregates daily production logs into four governed metrics — process
> yield, downtime, energy intensity and rejection rate — and plots each against its
> threshold, so a manager sees not just whether today passed but the trend.
>
> Beneath the charts, Flagged Days isolates every date that breached a threshold and
> shows exactly which metric failed, the measured value, the limit, and the day's
> profit or loss. That turns a spreadsheet into a root-cause queue: the highest-value
> question in food processing is not how much was produced, but why a specific day
> underperformed."

---

### SCENE 11 — IoT Condition Monitoring  `5:40 – 6:00` (20 s)

**[SCREEN]** `/iot-monitor`. Four KPI tiles, live telemetry chart, Active Alerts panel.
**Action:** show an alert already present (see 2.3). Point at the KPI target lines.

**VO:**
> "Cold-chain conditions are monitored through an IoT ingest endpoint that accepts
> temperature, humidity, downtime and energy for a unit.
>
> Alerts are rule-based, which we consider the correct choice here: an excursion
> outside zero to five degrees, humidity above eighty-five percent, downtime beyond
> fifteen minutes, or an energy spike over fifty kilowatt-hours, each raise an
> immediate alert. Deterministic safety rules should not depend on a model being
> available. The dashboard auto-refreshes every ten seconds; the simulator injects
> readings for demonstration, and a real deployment would point the same endpoint at
> the hardware."

---

### SCENE 12 — Impact & ESG Reporting  `6:00 – 6:25` (25 s)

**[SCREEN]** `/esg-report`. Five KPI tiles, two bar charts, Methodology Notes box.
**Actions:**
1. Sweep across the five tiles.
2. **Point at the Methodology Notes box and read the factors aloud** — this is the
   detail that separates a serious submission from a demo.
3. Optionally click Download PDF (it opens the browser print dialog → "Save as PDF").

**VO:**
> "Impact is measured, not asserted. The ESG report reports meals donated,
> carbon dioxide equivalent avoided, food saved in kilograms, cost saved in rupees,
> and the waste prevention rate, with a month-on-month trend.
>
> Every figure is traceable, because the methodology is published on the page: we
> convert to meals at roughly zero point four kilograms per meal, apply two point
> five kilograms of carbon dioxide equivalent avoided per kilogram of food diverted
> from waste, and value savings at fifty rupees per kilogram. Publishing the
> constants is what makes the number auditable — a reviewer can disagree with our
> factors and recalculate, and that is a much stronger position than an unexplained
> total."

---

### SCENE 13 — Architecture, Limitations & Close  `6:25 – 7:00` (35 s)

**[SCREEN]** Return to the architecture diagram. Bring up the four service boxes,
then the closing title card.

**VO:**
> "To summarise the engineering. The front end is Next.js with TypeScript and
> Tailwind, using Recharts for the data views, MapLibre for the map, Framer Motion
> for transitions, and Zustand for session state. The back end is FastAPI with
> SQLAlchemy over SQLite. The intelligence layer is four models and solvers: XGBoost
> for demand, OpenCV for quality, a constraint-based matching engine, and OR-Tools
> with OSRM for routing. Reporting aggregation is deterministic, and an optional
> language-model narrative summarises the metrics — it receives only the aggregated
> numbers and never touches the database directly.
>
> Being straight about what is and is not finished: the matching engine, urgency
> calculation, IoT ingestion, sustainability aggregation and the demand model are
> fully implemented and reproducible from the repository. Authentication is
> demonstration-grade, dispatch confirmation is not yet persisted end to end, and
> routing needs a live network connection.
>
> Next, in order: production authentication with real role enforcement, persisted
> dispatch with volunteer assignment, a trained spoilage classifier, and live
> telemetry from physical sensors.
>
> RasoiIQ does not solve hunger by asking for more food. It solves it by making the
> food that already exists visible, and moving it in time. Thank you — we are happy
> to take questions."

---

### 3.14 If you need a 5:00 cut-down

| Keep | Drop | Reclaim |
|---|---|---|
| S1 Problem (20 s, trim the India statistic) | S3 Access & Roles | 20 s |
| S2 Solution at a glance | S11 IoT | 20 s |
| S4 Dashboard (trim to 20 s) | S12 ESG → keep only KPI tiles + methodology line | 20 s |
| S5 Andaza (full — highest value) | S10 Processing Unit | 30 s |
| S6 Quality (trim to 20 s) | | |
| S7 Rescue creation + S8 Matching + S9 Map | | |
| S13 Close (trim limitations list to 2 items) | | |

Never cut **S5, S7, S8, S9** — they are the proof the system works.

---

## PART 4 — Architecture Slide Content

Show this as a clean diagram. Reveal one layer at a time, in sync with Scene 2.

```
┌──────────────────────────── CLIENT LAYER ────────────────────────────┐
│  Next.js 14 · React 18 · TypeScript · Tailwind CSS                  │
│  Recharts (charts) · MapLibre GL (map) · Framer Motion · Zustand    │
│   Dashboard │ Andaza │ Quality │ Rescue │ Map │ Processing │ ESG    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │  REST / JSON   (CORS-locked to :3000)
┌───────────────────────────────▼─────────────────────────────────────┐
│                    FastAPI APPLICATION LAYER                        │
│  routers:  /auth  /andaza  /production  /rescue  /match  /route     │
│            /dashboard  /processing-unit  /reports  /quality  /iot   │
│  CORS middleware · OpenAPI docs at /docs · /health                  │
└───────────────────────────────┬─────────────────────────────────────┘
┌───────────────────────────────▼─────────────────────────────────────┐
│                      INTELLIGENCE LAYER                             │
│  XGBoost (Poisson, 47 features)      demand forecasting             │
│  OpenCV HSV dark-spot analysis       food quality scoring           │
│  Constraint matching (2-stage)       NGO eligibility + ranking      │
│  OR-Tools VRPTW + OSRM matrix        multi-stop route optimisation  │
│  Shelf-life urgency model            RED/AMBER/GREEN triage        │
│  Optional Gemini narrative           metrics-only, no DB access     │
└───────────────────────────────┬─────────────────────────────────────┘
┌───────────────────────────────▼─────────────────────────────────────┐
│        SQLAlchemy ORM · SQLite  ·  seed scripts for every table     │
└─────────────────────────────────────────────────────────────────────┘
```

**Data-flow line to speak over it:**
`IoT / donor form → rescue event → shelf-life urgency → NGO matching →
route optimisation → dispatch → sustainability aggregation`

### Model accuracy — state it exactly like this
- Trained on `kitchen_demand_dataset.csv` (26 locations, ~4,383 history rows seeded)
- **47 features**: 15 base + 4 cyclical + 26 location one-hot
- Objective: `count:poisson`
- **Validation MAE ≈ 53 customers/day** (say "about fifty")
- Reproducible via `python train_andaza.py`
- Honest caveat if asked: the held-out **test** MAE is materially higher than
  validation, indicating some distribution drift. A retrain on recent data and
  per-location calibration are on the roadmap. **Saying this unprompted is a strength.**

---

## PART 5 — End-to-End Workflow (the spine of the whole story)

Tell it as one continuous sentence chain, and make sure the video shows all six links:

1. **Anticipate** — Andaza forecasts covers per location per day from calendar,
   weather, demand lags and promotion flags.
2. **Prevent** — the forecast becomes a production plan, so surplus is not created.
3. **Detect** — surplus becomes a rescue event, created by the donor, the IoT feed,
   or the manual override, always with a `batch_created_at` timestamp.
4. **Prioritise** — the shelf-life model converts that timestamp into a remaining
   window and a RED / AMBER / GREEN urgency band; expired food is withheld.
5. **Verify** — a photograph is scored by OpenCV; a poor score raises urgency.
6. **Match** — hard filters (category, ≤ 15 km, capacity, opening hours, time margin)
   then weighted scoring with a load-balancing penalty.
7. **Route** — OR-Tools solves the time-windowed multi-stop tour over an OSRM matrix.
8. **Account** — delivery outcomes aggregate into the ESG report, which closes the
   loop back into the demand model for the next period.

---

## PART 6 — Judge Q&A Bank (unique technical details)

| Likely question | Answer |
|---|---|
| Why Poisson for demand? | The target is a non-negative count, so the Poisson objective matches the output domain and avoids the negative predictions a squared-error model can produce on low-demand days. |
| Why 47 features, not 26? | 15 raw signals + 4 cyclical encodings (month and day-of-week sin/cos) so the model learns wrap-around, e.g. December next to January + 1 annual seasonality term + 26 one-hot location columns = 47, order enforced by an assertion. |
| How do you stop the matcher picking one NGO every time? | A minus-15-point penalty is applied to any organisation already served today, so scores spread across the network. |
| Why hard filters *and* scoring? | A score implies a ranking; a filter implies feasibility. Only feasible candidates are ranked, so a high score can never mean "impossible to deliver". |
| How is an "expired" item prevented from being matched? | The matcher returns an empty list outright when urgency is EXPIRED or remaining window ≤ 0. |
| Why is the distance estimate a multiplier rather than a routing call? | Candidate *scoring* uses haversine × 1.5 at 20 km/h to stay fast and dependency-free; the final *route* uses a real OSRM matrix. Separating the two keeps the matcher fast and the route accurate. |
| Why rule-based IoT alerts instead of ML? | Safety excursions are deterministic and must not degrade when a model is unavailable. |
| Can you regenerate everything? | Yes. `python -m scripts.seed_data` and `python -m scripts.seed_andaza` rebuild the database; `python train_andaza.py` retrains the model. |
| What is genuinely production-ready? | Matching, urgency, IoT ingest, ESG aggregation, and the demand pipeline. Authentication and persisted dispatch are the gaps. |
| How does this scale past one kitchen? | Every rescue and query is keyed on `kitchen_id` and the endpoints already accept filters for kitchen, donor and volunteer. The NGO side is already multi-organisation. |

---

## PART 7 — Post-Recording Checklist

- [ ] Repo is **private**; collaborator access granted to the hackathon org
- [ ] `main` pushed; README shows objective, features, stack, setup, and implementation status
- [ ] No real phone numbers, emails, or personal names visible anywhere in the footage
- [ ] No `.env` or `GEMINI_API_KEY` on screen
- [ ] The MAE stated aloud matches the number on the dashboard badge
- [ ] "Andaza" / "ANYA Ai" naming is consistent on screen and in narration
- [ ] One complete end-to-end run captured with **no** error states, spinner stalls, or "No active rescue" screens
- [ ] Audio has no echo, no background music over narration, and consistent level
- [ ] Video length confirmed against your institute's published limit
- [ ] Exported at the portal's required resolution, then uploaded as an **unlisted** link or file
- [ ] Narration delivered by a team member — **not** AI-generated

---

### Document control
- Prepared against commit `019088a` (pushed to `moyibr/RasoiIQ-SIH-Problem-solved`)
- Runtime verified: backend `:8080`, frontend `:3000`, 14 frontend routes HTTP 200,
  TypeScript clean
- Duration unconfirmed against official SIH rules — verify with your SPOC before recording
