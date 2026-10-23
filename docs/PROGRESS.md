# TileTwin AI — Progress

## Current state

**Milestones 1–6 DONE (2026-10-23).** Next: Milestone 7 (Reports + PDF).

## Environment (2026-10-22, Windows 11)

| Tool | Version | Notes |
|---|---|---|
| node / npm | 22.18.0 / 11.13.0 | |
| dotnet | SDK 10.0.301 | net10.0; `dotnet-ef` 10.0.13 as a *local* tool (`dotnet-tools.json`) |
| python | 3.11.9 (`python`) | ml-service `.venv` |
| Docker Desktop | 4.96.1 (engine 29.9.2, compose v5.6.0) | `C:\Program Files\Docker\Docker\resources\bin` |
| Local PostgreSQL 17 / 18 | ports 5432 / 5433 | **not used** by this project |

Ports: Postgres 5434, API 5080, ML 8001, frontend 5180 (5173 is taken by another local app).

## Test results (last run 2026-10-22)

| Suite | Command | Result |
|---|---|---|
| Backend (xUnit, real Postgres `tiletwin_test`) | `dotnet test backend/TileTwin.slnx` | 49 passed, 0 failed (~70 s, mostly re-seeding 494k readings) |
| Frontend (Vitest) | `npm test` | 10 passed; `npm run build` OK |
| ML (pytest) | `.venv\Scripts\python -m pytest` | 11 passed (1 harmless Starlette/httpx deprecation warning) |

## Milestone 1 — environment + skeleton ✅

Compose Postgres 16.15 + pgvector 0.8.7 (host port 5434); empty API / frontend / ML apps with
health checks; `.env.example`; README.

## Milestone 2 — backend core ✅

- **Domain** (`TileTwin.Domain`): entities with `DataOrigin` + `SeedBatchId`, enums, roles,
  `MachineStatusCalculator` (Offline > Critical > Unknown > Warning > Normal; stale = >5 min).
- **Infrastructure**: `TileTwinDbContext` (Identity + business tables), migration `InitialCreate`,
  all business FKs `Restrict`. Deterministic `DemoSeeder` (fixed seed 20261022, Npgsql binary COPY,
  ~12 s for 493,561 readings). Reset deletes only `Synthetic` + `demo-v1` rows in one transaction;
  master data (site/zones/machines/sensors) is upserted so user rows referencing it survive;
  synthetic parents with user-created children are kept.
- **Scripted patterns** (`SignalModel`): HP-002 vibration/temperature drift → Critical;
  PUMP-002 flow gap → Unknown; CONV-003 flagged offline + no readings → Offline. Verified via API.
- **API**: `GET /api/health` (DB + feature flags), `GET /api/zones`, `GET /api/zones/{id}`,
  `GET /api/machines?zoneId&status`, `GET /api/machines/{id}` (sensors, limits, latest values,
  maintenance), `PUT /api/machines/{id}/state` (MaintenanceEngineer/Admin), `POST /api/auth/login`,
  `GET /api/auth/me`. Swagger UI at `/swagger`. Latest-reading lookup uses a LATERAL query (~7–10 ms).
- **Auth**: ASP.NET Core Identity + JWT (8 h), lockout after 5 failures, audit log for logins and writes.
  Dev users only in Development with `DEV_SEED_USER_PASSWORD` (local `.env` has a random one).
- **Config**: repo-root `.env` is loaded by the API; startup fails clearly if `POSTGRES_CONNECTION`
  or `JWT__SigningKey` is missing; logs which optional features are disabled.

### Decisions / deviations (please review)

- **Status precedence**: spec lists Unknown before Critical; implemented Critical above Unknown so a
  critical reading is never hidden by another sensor's missing data. Missing data is still never Normal.
- **Read endpoints are anonymous**; all writes need JWT + role. Reason: with `DEV_SEED_USER_PASSWORD`
  empty there are no users, and the spec requires non-AI modules to work with every optional variable empty.
- `SensorReadings` uses a `bigint` identity key (high volume) instead of GUID.
- Tables for Alerts, TileInspections, MlModels, WorkflowExecutions, Reports, Documents/Chunks and
  ObservationAttachments are added in the milestones that use them (not created empty up front).
- Swagger UI has no "Authorize" button yet; use curl/HTTP file with a bearer token for writes.

### Known limitations

- No live simulator yet → machines become `Offline` 5 min after seeding (Milestone 4 fixes this).
- Dev DB is seeded once; "Reset demo data" endpoint comes with Administration (Milestone 11).

## Milestone 3 — frontend shell + 3D twin ✅

- Dark control-room shell: SYNTHETIC DATA banner, 10-item navigation (React Router), TanStack Query
  polling every 7 s, loading / error (with retry) / empty states. Unbuilt modules show an honest
  "scheduled for Milestone N" page.
- **Overview**: machine counts per status (icon + label + colour), machines needing attention with
  reasons, "Show in 3D" and "Details", configuration status (API, DB, AI, knowledge search, dev users).
- **3D Digital Twin** (React Three Fiber + drei, lazy-loaded): procedural low-poly building, 5 zone
  floor regions with labels, presses, pumps, motors, conveyors, inspection stations, kiln, instanced
  storage racks. Layout from `3d-assets/asset-manifest.json` (served by the API at `/assets3d`).
  GLB `modelPath` support via `useGLTF` + Suspense with procedural fallback and a warning tag.
- Status colour on floor ring + beacon, plus an HTML label with icon and ID (keyboard-focusable);
  legend. Selecting a machine: cyan outline box, highlighted ring, animated camera fly-to, side panel
  loaded from `GET /api/machines/{id}` (status + reasons, latest readings with limits, maintenance).
- Controls: orbit/zoom/pan (CameraControls), reset camera, fit-to-factory, zone visibility toggles,
  search (machine or zone). Shared store `focusEntity(id)` + deep link `/twin?focus=ID`.
- Verified in Chrome: scene renders, label click opens the panel, deep link flies to MACHINE-HP-002.
  Console: only a three.js `THREE.Clock` deprecation warning from the library.

### Known limitations (M3)

- 3D rendering is not covered by automated tests (WebGL isn't available in jsdom); covered by the
  manual check above. Shell, overview and focus store are unit-tested.
- Machine labels of adjacent presses overlap at the default zoom.
- Status colours could only be checked as `Offline` in the browser, because the seeded data was
  already stale; the live simulator (M4) makes Normal/Warning/Critical/Unknown visible.

## Milestone 4 — machine monitoring ✅

- **Live simulator** (`SimulatorHostedService` → `SimulationEngine`): every 5 s writes one synthetic
  reading per live sensor (continues the HP-002 drift; PUMP-002 flow gap persists; machines flagged
  offline get none). On startup it backfills the downtime gap at 1-min resolution (max 7 days).
  Pause/resume: `GET/PUT /api/admin/simulator` (Admin). Disabled in tests via `Simulator__Enabled=false`.
- **Threshold alerts** (`AlertDetector`, domain, unit-tested): crossing a warning/critical limit opens an
  alert (value, threshold, detected UTC); no duplicate for the same machine+sensor+severity while
  Open/Acknowledged. Seed replays the history so HP-002 alerts carry their real crossing times
  (vibration warning ≈ −10.5 h, oil temp warning ≈ −4 h, vibration critical ≈ −2.5 h).
- **API**: `GET /api/alerts`, `POST /api/alerts/{id}/acknowledge` (Inspector/Engineer/Admin),
  `POST /api/alerts/{id}/resolve` (Engineer/Admin), history with user + comment, audit-logged;
  `GET /api/machines/{id}/readings?range=1h|24h|7d` downsampled in PostgreSQL with `date_bin`
  (30 s / 5 min / 30 min buckets, avg + min + max). Machines include `openAlertCount`.
- **UI**: Machine Monitoring list (search, status and zone filters, alerts column, Show in 3D,
  all active alerts), machine detail (range selector, one chart per sensor with avg line, min–max band,
  labelled warning/critical limit lines, tooltip, table view, alerts with acknowledge/resolve, maintenance
  history). Sidebar sign-in (JWT in sessionStorage). Verified in Chrome.

### Known limitations (M4)

- Live readings are 5-second points while history is 1-minute; charts downsample, so it is not visible.
- Alerts are never auto-resolved when a value returns within limits; a human resolves them (by design).
- The simulator adds ~850k rows/day while running; "Reset demo data" (M11) clears them.

## Milestone 5 — Remote Site Inspection ✅

- New tables (migration `InspectionExtras`): `ObservationAttachments` (demo attachments are generated
  SVGs labelled **SYNTHETIC PLACEHOLDER IMAGE**) and `ObservationEvents` (history: created, assigned,
  status changes, comments). Seeded deterministically; reset keeps observations that have user rows.
- API: `GET /api/inspection/zones` (open / high counts), `GET /api/observations` (zone, status,
  priority, search; max 200), `GET /api/observations/{id}` (corrective actions with overdue flag,
  attachments, history), `PATCH /api/observations/{id}` (Inspector/Admin; status, assignment, comment;
  audit-logged), `POST /api/inspection/summary` (deterministic `InspectionSummaryBuilder`, cites
  `OBS-xxxxxx` codes, returns focus entity IDs), `GET /api/observations/attachments/{id}` (SVG).
- UI: zone list with counts and "3D" (highlights the zone in the twin), filters, observations table,
  observation detail (actions, history, attachments, update form for Inspector/Admin), summary panel
  with "Show … in 3D". Scenario A verified in Chrome; written up in `docs/DEMO-SCRIPT.md`.

### Known limitations (M5)

- No upload of real attachments and no UI to add corrective actions (not required by the spec).
- Summary wording is template-based; optional LLM wording arrives with the AI assistant (M8).

## Milestone 6 — ML service + Predictive Maintenance ✅

- **ML service** (FastAPI + scikit-learn): one Isolation Forest per machine type on synthetic normal
  60-min windows (features: mean, std, slope per sensor). `GET /health`, `GET /models`, `POST /train`,
  `POST /predict` (422 "insufficient data" when a sensor has < 45 of 60 samples — never a fake score).
  CLI: `python -m app.train`, `python -m app.evaluate`. Models auto-train at first start (~10 s).
- **Finding**: Isolation Forest alone caught only ~5 % of sustained level shifts (values beyond the
  training range). Added a documented feature-range check (|z| above the 99.5th percentile seen on
  normal windows). Both results are in `docs/ML-EVALUATION.md` (synthetic data only, with caveats).
- **Backend**: `MlClient` (typed HttpClient, 10 s timeout, honest unavailable/insufficient states),
  `AnomalyScoringService` (last 60 one-minute samples per sensor), `AnomalyHostedService` (every 5 min +
  model registry sync to `MlModels`), `AnomalyScores` table (migration `MlScores`). A fresh anomaly
  (≤ 15 min) raises machine status to Warning ("Open ML anomaly — not a confirmed fault").
- **Predictive API**: `GET /api/predictive`, `GET /api/predictive/{id}` (patterns from 24 h trends,
  score + history, rule-based suggestions, data-quality warnings, alerts, maintenance, review label,
  failure-prediction "not implemented"), `POST /api/predictive/{id}/score` (signed in), `GET /api/ml/status`.
- **Domain**: `TrendAnalyzer`, `SuggestionRules` (documented in `docs/MAINTENANCE-RULES.md`), unit-tested.
- **UI**: Predictive Maintenance page (machine list with anomaly flags, score card with plain-English
  explanation, supporting charts, suggestions with rule IDs, data quality, the four-way distinction,
  alerts, maintenance). Overview shows ML service status. Verified live: only HP-002 is anomalous
  (largest deviation `VIB_mean`); PUMP-002 is not scored (missing flow data); CONV-003 skipped (offline).

### Known limitations (M6)

- Training data is a simple synthetic noise model; thresholds would need re-calibration on real data.
- Scores are stored every 5 minutes for 14 machines (~4k rows/day); no retention policy yet.

## Next

Milestone 7 — Reports (factory health, machine anomalies, maintenance history, site inspection) + PDF.
