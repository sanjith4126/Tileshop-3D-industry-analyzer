# TileTwin AI — Progress

## Current state

**Milestones 1–3 DONE (2026-10-22).** Next: Milestone 4 (simulator, charts, alerts).

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
| Backend (xUnit, real Postgres `tiletwin_test`) | `dotnet test backend/TileTwin.slnx` | 23 passed, 0 failed (~51 s, mostly re-seeding 494k readings) |
| Frontend (Vitest) | `npm test` | 5 passed; `npm run build` OK |
| ML (pytest) | `pytest` | 1 passed (M1) |

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

## Next

Milestone 4 — live simulator, time-series charts with limit lines, threshold alerts + acknowledgement.
