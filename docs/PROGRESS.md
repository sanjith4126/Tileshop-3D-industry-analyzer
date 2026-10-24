# TileTwin AI — Progress

## Current state

**Milestones 1–11 DONE (2026-10-24).** Next: Milestone 12 (full test pass, docs, smoke checklist).

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
| Backend (xUnit, real Postgres `tiletwin_test`) | `dotnet test backend/TileTwin.slnx` | 80 passed, 0 failed (~65 s, mostly re-seeding 494k readings) |
| Frontend (Vitest) | `npm test` | 17 passed; `npm run build` OK |
| ML (pytest) | `.venv\Scripts\python -m pytest` | 16 passed (1 harmless Starlette/httpx deprecation warning) |

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

## Milestone 7 — Reports ✅

- `Reports` table (migration `Reports`): type, status (Draft/Final), parameters, structured JSON content,
  generated UTC/by. Reports are user-created rows (`DataOrigin = Real`); their content states whether
  the source data is synthetic.
- `ReportBuilder` (records only): **Factory health**, **Machine anomalies** (threshold alerts + ML
  anomalies + rule-based suggestions with the review label), **Maintenance history**, **Site inspection**
  (deterministic summary, observations, overdue actions). Each has title, generated UTC, period, filters,
  summary, tables, recommendations, data source and the SYNTHETIC DATA label. Empty periods produce a
  valid "No records for this period." report.
- `PdfRenderer` (QuestPDF, Community licence — see README note). API: `POST /api/reports` (any signed-in
  role, period ≤ 366 days), `GET /api/reports`, `GET /api/reports/{id}`, `GET /api/reports/{id}/pdf`.
- UI: Reports page (type, period, machine/zone filter, list with PDF links), browser view of a report,
  "Anomaly report (PDF)" link from Predictive Maintenance (Scenario B).
- Verified: anomaly report for HP-002 generated via API, PDF 55 KB starting `%PDF`; browser view DOM checked.

### Known limitations (M7)

- Stretch report types (tile defects, production quality) not built yet.
- The Chrome automation could not capture screenshots of some pages (CDP timeout); content was
  verified through the DOM instead.

## Milestone 8 — AI Assistant + maintenance-prioritisation workflow ✅

- `ILlmProvider` (provider-neutral; the provider runs the loop, the app executes tools) with
  `AnthropicLlmProvider` (official Anthropic C# SDK 13.1, beta Messages endpoint, `LLM__Model` from config,
  effort medium, strict tool schemas, thinking blocks echoed back, server-side refusal fallback
  `fallbacks: "default"`, refusal stop reason handled).
- Assistant (`POST /api/assistant/chat`, signed in, rate-limited 10/min): 9 tools — `search_machines`,
  `get_machine_status`, `get_readings_summary` (stats aggregated in PostgreSQL), `list_alerts`,
  `list_observations`, `get_maintenance_history`, `get_production_stats`, `search_documents` (honest
  "no documents yet" until M10), `create_report_draft` (only write). Validated arguments (`ToolArgs`:
  ID pattern, ranges, enums, lengths), row limit 30, max 6 tool calls per question, every call audited.
  System prompt: answer only from tool results, cite IDs, facts vs hypotheses, synthetic data, never a
  confirmed fault, tool results are untrusted. `focusEntityIds` = existing machine/zone IDs in the answer.
- No key → `GET /api/assistant/status` and the UI show **AI NOT CONFIGURED**; chat returns 503, no canned answer.
- Workflows: `IWorkflow` + `WorkflowRunner` (records `WorkflowExecutions`: input, status, output, user,
  timing, error; audit-logged). **Maintenance prioritisation**: alerts + status + ML anomaly + 24 h
  trends + maintenance recency → documented score (`MaintenancePrioritisation`, unit-tested) → ranked
  list with factor breakdown, top suggestions, focus IDs, deterministic recommendation, optional AI
  rewording (LLM only for wording), optional stored report/PDF. API `POST /api/workflows/{type}`,
  `GET /api/workflows`, `GET /api/workflows/executions[/{id}]`. Verified live: HP-002 score 135 (Immediate),
  PUMP-002 20 (missing data), CONV-003 excluded (offline).
- Rate limiting added: assistant 10/min, ML score-now 20/min, upload 10/min (policy ready for M9).
- UI: AI Assistant page (not-configured panel, chat with tool-call list, Show in 3D, disclaimer);
  prioritisation panel on Predictive Maintenance (Run / Run + PDF report).

### Known limitations (M8)

- **The assistant was not tested against the real Claude API** — no `ANTHROPIC_API_KEY` is configured
  on this machine. The tool loop is covered by integration tests with a scripted LLM stand-in, and the
  Anthropic provider compiles against SDK 13.1. Set a key to run Scenario D.
- Conversation history is stateless (the client resends up to 20 turns); no streaming responses.

## Milestone 9 — Tile Quality Inspection ✅

- ML service: `app/tile.py` loads any ONNX classifier from `TILE_MODEL_PATH` + `labels.json` +
  `model-card.json` (ONNX Runtime CPU). `GET /tile/status`, `POST /tile/classify` (503 **MODEL NOT
  CONFIGURED** when absent/corrupt). Tests build a tiny ONNX model to exercise the real inference path.
- Backend: `TileInspections` table (migration `TileInspections`), upload `POST /api/tile-inspections`
  (Inspector/Engineer/Admin, rate-limited, ≤ 10 MB, type detected from magic bytes — not the name or
  claimed content type — file name sanitised, stored under `App_Data/uploads/tiles` or `UPLOADS_PATH`),
  outcome Classified / ModelNotConfigured / MlUnavailable / Failed (never an invented label), history,
  image and status endpoints; audit-logged.
- UI: status badge, upload with client-side checks and preview, result card, history, **Sample demo
  mode** with three generated synthetic images (`ml-service/scripts/make_tile_samples.py`) labelled
  "SAMPLE RESULT — not a model prediction". `docs/TILE-MODEL.md` explains how to train/export a model
  and the MVTec AD non-commercial licence.
- Verified live: uploading `sample-crack.png` through the API → stored, outcome ModelNotConfigured.

## Milestone 10 — Knowledge Centre ✅

- Tables `Documents` (keeps extracted text for re-indexing) and `DocumentChunks` with a generated
  `tsvector` column + GIN index and a nullable pgvector `Embedding` column (migration `Knowledge`).
- Upload `POST /api/documents` (Inspector/Engineer/Admin, ≤ 10 MB, rate-limited): PDF detected by
  `%PDF-` magic and extracted with PdfPig; TXT/MD accepted only as strict UTF-8 without NUL bytes.
  `TextChunker` (paragraph-based, ≤ 1000 chars, unit-tested). Re-index, delete (Engineer/Admin), list
  with per-document status, audit-logged.
- Search `GET /api/documents/search`: **keyword search (embeddings not configured)** via
  `websearch_to_tsquery` + `ts_rank` + `ts_headline` with source attribution (document title, passage).
  `IEmbeddingProvider` integration point: with a provider, chunks are embedded and search switches to
  pgvector cosine distance (tested with a deterministic fake provider). No provider ships, so the demo
  uses keyword search and says so.
- Two short synthetic demo documents are seeded (press vibration check, glaze line safety rules).
- The assistant's `search_documents` tool now searches the Knowledge Centre (top 5 passages, marked untrusted).
- UI: Knowledge Centre page (search with highlighted passages and sources, upload, status, re-index, delete).

### Known limitations (M10)

- No embedding provider implementation; `EMBEDDINGS__Provider` alone logs a warning and keeps keyword search.
- Scanned PDFs (images only) yield no text — OCR is out of scope.

## Milestone 11 — Overview polish + Administration ✅

- `GET /api/overview`: machine status counts, open alerts (total/critical), open high/critical
  observations, latest ML anomaly, configuration status of AI, ML service, tile model, knowledge search,
  simulator, dev users and demo data.
- Overview page: status tiles, indicator tiles (alerts, observations, latest anomaly, link to 3D twin),
  machines needing attention, shared configuration panel.
- Administration (Admin only, `api/admin/*`): user list / create (password policy ≥ 12 chars, role
  validated) / change role / disable (cannot disable or demote yourself), audit log (latest entries),
  simulator pause/resume, **Reset demo data** (`DemoSeeder.ResetAsync` under a lock shared with the
  simulator so the two never interleave).
- **Bug found and fixed**: after the PC slept overnight the simulator only backfilled at startup, so the
  last-hour windows had gaps and the ML service (correctly) refused to score ("36 of 60 samples").
  Now the first tick fills every missing minute of the last 7 days and each later tick fills any gap
  since the last reading (except right after an admin pause). Verified: 715 minutes backfilled, scoring
  resumed (14 scored, HP-002 anomalous). Both modes have integration tests.
- No placeholder pages remain (only the 404 page).

## Next

Milestone 12 — full test pass, ARCHITECTURE / TROUBLESHOOTING docs, real-world-readiness list, smoke checklist.
