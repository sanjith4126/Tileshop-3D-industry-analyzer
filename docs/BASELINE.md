# Baseline (Phase 1 of `docs/MASTER_PROMPT.md`)

Recorded **2026-10-30** on the project owner's Windows 11 laptop. The code is the state of commit
`fd3f56e` (the GitHub `main` at the time). This phase changed **no application code**: it only added
this document, `docs/MASTER_PROMPT.md`, the files under `docs/baseline/`, and pointers in `CLAUDE.md`,
`AGENTS.md` and `docs/PROGRESS.md`. The commit that adds them is tagged `baseline`.

Every result below comes from a command run on 2026-10-30, unless marked otherwise.

## 1. Gate

| Gate condition | Result |
|---|---|
| Project builds from the documented steps | ✅ `dotnet build` 0 warnings / 0 errors; `npm run build` OK; ML venv installed from pinned `requirements.txt` |
| Project runs from the documented steps | ✅ Postgres (compose), API, ML service and frontend started with the README "Run" commands; smoke test 20/20 |
| Baseline committed | ✅ this commit, tag `baseline` |

## 2. Technologies and versions

| Area | Technology | Version |
|---|---|---|
| OS | Windows 11 Home 10.0.26300 | |
| Runtimes | Node.js / npm | 22.18.0 / 11.13.0 |
| | .NET SDK (target `net10.0`) | 10.0.301 |
| | Python (ML service venv) | 3.11.9 |
| | Docker Desktop engine / compose | 29.9.2 / v5.6.0 |
| | Git | 2.56.0.windows.1 |
| Database | PostgreSQL (Docker image, host port 5434) | 16.15 |
| | Extensions | `vector` 0.8.7, `plpgsql` 1.0 |
| Backend | ASP.NET Core, EF Core + Npgsql, ASP.NET Core Identity + JWT bearer | 10.0.13 / Npgsql EF 10.0.3 |
| | Built-in OpenAPI document (`/openapi/v1.json`) + Swashbuckle Swagger UI | 10.0.13 / 10.3.1 |
| | QuestPDF (reports), PdfPig (PDF text extraction) | 2026.9.1 / 0.1.16 |
| | Anthropic C# SDK + hand-written Groq HTTP client (`ILlmProvider`) | 13.1.0 |
| Frontend | React, React Router, TanStack Query | 19.3.1 / 7.18.4 / 5.104.5 |
| | TypeScript, Vite, Tailwind CSS (Vite plugin) | 6.0.3 / 8.3.5 / 4.3.3 |
| | three, React Three Fiber, Drei, Recharts, lucide-react | 0.186.1 / 9.8.2 / 10.7.9 / 3.10.1 / 1.61.0 |
| | Fonts (Fontsource, self-hosted) | Archivo Variable, IBM Plex Sans, IBM Plex Mono |
| | Tests / lint | Vitest 5.0.5, Testing Library, jsdom 29.1.1 / oxlint 1.89.0 |
| ML service | FastAPI, Pydantic, uvicorn | 0.159.1 / 2.14.1 / 0.54.0 |
| | scikit-learn (Isolation Forest), numpy, joblib | 1.9.1 / 2.4.6 / 1.6.0 |
| | onnxruntime (tile classifier), Pillow | 1.31.0 / 13.0.0 |
| | Tests | pytest 9.1.1, httpx 0.28.1, onnx 1.23.2 |
| AI (optional) | Groq (`openai/gpt-oss-120b`, configured and live) or Anthropic Claude (not run live) | |

## 3. Solution and folder structure

```text
tiletwin-ai/
  backend/                       .NET solution TileTwin.slnx (4 projects)
    TileTwin.Api/                Controllers, Dtos, Services, Assistant, Workflows, Reports, Configuration, Program.cs
    TileTwin.Domain/             Entities, Status, Alerts, Inspections, Maintenance, Knowledge (domain rules)
    TileTwin.Infrastructure/     Data (DbContext, 8 migrations), Seeding, Simulation, Llm
    TileTwin.Tests/              Domain/ (unit) and Integration/ (WebApplicationFactory + real Postgres DB tiletwin_test)
  frontend/                      React SPA (Vite, port 5180)
    src/{api,auth,components,lib,pages,store,twin}/, theme.tsx, index.css, App.tsx, main.tsx
  ml-service/                    FastAPI (port 8001): app/{main,model,features,train,evaluate,synthetic,tile}.py, tests/
  3d-assets/                     asset-manifest.json (positions, rotations, scales of zones and machines)
  database/                      docker-compose.yml (Postgres 16 + pgvector), init script
  scripts/smoke.py               20 end-to-end API checks (Scenarios A–D)
  docs/                          PROGRESS, ARCHITECTURE, DEMO-SCRIPT, ML-EVALUATION, MAINTENANCE-RULES,
                                 TILE-MODEL, TROUBLESHOOTING, REAL-WORLD-READINESS, MASTER_PROMPT, BASELINE,
                                 baseline/ (schema.sql, openapi.v1.json, screenshots/), screenshots/ (README images)
  CLAUDE.md, AGENTS.md           original build specification (Claude / Codex copies)
  README.md, .env.example, dotnet-tools.json (dotnet-ef 10.0.13 local tool)
```

Processes at runtime: **Postgres** (Docker), **API** (also hosts the live simulator and the ML scoring
scheduler as in-process hosted services, `SimulatorHostedService` and `AnomalyHostedService`; reports are
rendered synchronously inside `POST /api/reports`), **ML service** (FastAPI), **Vite dev server** for the
SPA. There is no separate Worker process, reverse proxy or production web container.

## 4. How to build and run each part

The README is the documented procedure; these are its commands, as used for this baseline.

| Part | Build | Run |
|---|---|---|
| Configuration | `copy .env.example .env`, fill `POSTGRES_PASSWORD`, `JWT__SigningKey`, `DEV_SEED_USER_PASSWORD`; optional AI keys | — |
| Database | — | `docker compose -f database/docker-compose.yml --env-file .env up -d` (Docker Desktop must be running) |
| Backend | `dotnet tool restore`; `dotnet restore backend/TileTwin.slnx`; `dotnet build backend/TileTwin.slnx` | `dotnet run --project backend/TileTwin.Api --launch-profile http` (port 5080; migrations and the demo seed run on first start) |
| ML service | `python -m venv .venv`; `.venv\Scripts\python -m pip install -r requirements.txt` (in `ml-service/`) | `.venv\Scripts\python -m uvicorn app.main:app --port 8001` (trains demo models on first start) |
| Frontend | `npm install`; `npm run build` (in `frontend/`) | `npm run dev` → http://localhost:5180 (proxies `/api` and `/assets3d` to the API) |
| Smoke test | — | `python scripts/smoke.py` (services running) |

## 5. Build and test results (2026-10-30)

| Suite | Command | Result |
|---|---|---|
| Backend build | `dotnet build backend/TileTwin.slnx` (API stopped) | Build succeeded, **0 warnings, 0 errors** |
| Backend tests (xUnit, real Postgres) | `dotnet test backend/TileTwin.slnx --no-build` | **85 passed**, 0 failed, 0 skipped (1 m 44 s) |
| Frontend tests (Vitest) | `npx vitest run` in `frontend/` | **17 passed** (9 files) — see known issue K4 |
| Frontend lint | `npx oxlint` | exit 0: **0 errors, 8 warnings** (6 fast-refresh export hints, 1 effect dependency, 1 setState-in-effect) |
| Frontend build | `npm run build` (`tsc -b && vite build`) | OK; JS chunks: main 816 kB, TwinPage 1,085 kB (minified) |
| Frontend audit | `npm audit` | **0 vulnerabilities** |
| ML tests (pytest) | `.venv\Scripts\python -m pytest -q` in `ml-service/` | **16 passed**, 1 deprecation warning (Starlette/httpx) |
| End-to-end smoke | `python scripts/smoke.py` | **20/20 passed** (after K5 warm-up) |
| Browser check | headless Chrome, 15 screenshots (section 10) | all pages rendered; **0 console errors** in this run |

Not run at baseline (no tooling exists yet; Phase 3 adds it): CI, `dotnet list package --vulnerable`,
`pip-audit`, Playwright suite, axe accessibility scan, architecture tests.

## 6. Database schema

- Full DDL: [`docs/baseline/schema.sql`](baseline/schema.sql) (`pg_dump --schema-only`, 1,317 lines).
- Migrations applied (EF Core): `InitialCreate`, `AlertsAndSimulator`, `InspectionExtras`, `MlScores`,
  `Reports`, `Workflows`, `TileInspections`, `Knowledge`.
- Naming: PascalCase quoted table and column names (EF defaults), not snake_case.

Tables and row counts on 2026-10-30 (demo seed `demo-v1` plus live simulator data and records created
by tests of the running system):

| Table | Rows | Columns | Indexes |
|---|---:|---:|---:|
| AlertAcknowledgements | 0 | 8 | 2 |
| Alerts | 4 | 11 | 4 |
| AnomalyScores | 980 | 12 | 2 |
| AspNetRoleClaims | 0 | 4 | 2 |
| AspNetRoles | 4 | 4 | 2 |
| AspNetUserClaims | 0 | 4 | 2 |
| AspNetUserLogins | 0 | 4 | 2 |
| AspNetUserRoles | 4 | 2 | 2 |
| AspNetUserTokens | 0 | 4 | 1 |
| AspNetUsers | 4 | 16 | 3 |
| AuditLog | 67 | 6 | 2 |
| CorrectiveActions | 32 | 10 | 2 |
| DemoState | 1 | 5 | 1 |
| DocumentChunks | 2 | 8 | 3 |
| Documents | 2 | 15 | 1 |
| InspectionObservations | 25 | 14 | 4 |
| Inspections | 10 | 7 | 2 |
| MachineTypes | 5 | 4 | 1 |
| Machines | 16 | 10 | 3 |
| MaintenanceRecords | 36 | 10 | 2 |
| MlModels | 5 | 10 | 1 |
| ObservationAttachments | 17 | 8 | 2 |
| ObservationEvents | 81 | 8 | 2 |
| ProductionBatches | 22 | 10 | 3 |
| Reports | 7 | 10 | 2 |
| SensorDefinitions | 49 | 11 | 2 |
| SensorReadings | 1,127,257 | 7 | 3 |
| Sites | 1 | 4 | 1 |
| TileInspections | 7 | 16 | 2 |
| WorkflowExecutions | 7 | 9 | 2 |
| Zones | 5 | 6 | 2 |
| `__EFMigrationsHistory` | 8 | 2 | 1 |

Plant model at baseline: 1 site, 5 zones (`ZONE-RAW-A`, `ZONE-PRESS-A`, `ZONE-KILN-A`, `ZONE-GLAZE-A`,
`ZONE-MAINT-A`), 16 machines of 5 types (hydraulic presses, pumps, motors, conveyors, inspection
stations; codes such as `MACHINE-HP-002`), 49 sensors. This differs from the reference model in
Appendix A of the master prompt (section 6 says to keep the project's own codes unless they break the
rules; the audit decides).

## 7. API surface

44 paths under `/api` (no `/v1` prefix), documented by the built-in OpenAPI document; the full document
at baseline is saved as [`docs/baseline/openapi.v1.json`](baseline/openapi.v1.json). Swagger UI is at
`/swagger`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Plant | `GET /api/zones`, `GET /api/zones/{id}`, `GET /api/machines`, `GET /api/machines/{id}`, `GET /api/machines/{id}/readings`, `PUT /api/machines/{id}/state`, `GET /api/overview` |
| Alerts | `GET /api/alerts`, `POST /api/alerts/{id}/acknowledge`, `POST /api/alerts/{id}/resolve` |
| Inspection | `GET /api/inspection/zones`, `POST /api/inspection/summary`, `GET /api/observations`, `GET/PATCH /api/observations/{id}`, `GET /api/observations/attachments/{id}` |
| Predictive / ML | `GET /api/predictive`, `GET /api/predictive/{machineId}`, `POST /api/predictive/{machineId}/score`, `GET /api/ml/status` |
| Workflows | `GET /api/workflows`, `POST /api/workflows/{type}`, `GET /api/workflows/executions`, `GET /api/workflows/executions/{id}` |
| Reports | `GET/POST /api/reports`, `GET /api/reports/{id}`, `GET /api/reports/{id}/pdf` |
| Tile quality | `GET/POST /api/tile-inspections`, `GET /api/tile-inspections/status`, `GET /api/tile-inspections/{id}`, `GET /api/tile-inspections/{id}/image` |
| Knowledge | `GET/POST /api/documents`, `GET /api/documents/search`, `DELETE /api/documents/{id}`, `POST /api/documents/{id}/reindex` |
| Assistant | `GET /api/assistant/status`, `POST /api/assistant/chat` |
| Admin | `GET/POST /api/admin/users`, `PUT /api/admin/users/{id}`, `GET /api/admin/audit`, `GET/PUT /api/admin/simulator`, `POST /api/admin/reset-demo` |
| Health | `GET /api/health` |

Roles at baseline: `Viewer`, `Inspector`, `MaintenanceEngineer`, `Admin` (ASP.NET Core Identity). Read
endpoints are open without sign-in; write endpoints require a JWT with a suitable role.

## 8. Installed dependencies and licences

Direct dependencies only; versions are the installed ones. Transitive packages are not listed here
(`docs/DEPENDENCIES.md` is a later deliverable). Lock files: `frontend/package-lock.json` is committed;
the .NET projects have **no NuGet lock file**; Python uses exact `==` pins in `requirements.txt`.
`frontend/package.json` declares **caret ranges** (`^`), not exact pins.

### Frontend (npm)

| Package | Version | Licence | Kind |
|---|---|---|---|
| @fontsource-variable/archivo | 5.3.0 | OFL-1.1 | runtime |
| @fontsource/ibm-plex-mono | 5.3.0 | OFL-1.1 | runtime |
| @fontsource/ibm-plex-sans | 5.3.0 | OFL-1.1 | runtime |
| @react-three/drei | 10.7.9 | MIT | runtime |
| @react-three/fiber | 9.8.2 | MIT | runtime |
| @tanstack/react-query | 5.104.5 | MIT | runtime |
| lucide-react | 1.61.0 | ISC | runtime |
| react / react-dom | 19.3.1 | MIT | runtime |
| react-router | 7.18.4 | MIT | runtime |
| recharts | 3.10.1 | MIT | runtime |
| three | 0.186.1 | MIT | runtime |
| @tailwindcss/vite / tailwindcss | 4.3.3 | MIT | dev |
| @testing-library/jest-dom | 7.0.1 | MIT | dev |
| @testing-library/react | 16.3.3 | MIT | dev |
| @types/node, @types/react, @types/react-dom, @types/three | 24.19.2, 19.3.0, 19.3.0, 0.186.0 | MIT | dev |
| @vitejs/plugin-react | 6.1.2 | MIT | dev |
| jsdom | 29.1.1 | MIT | dev |
| oxlint | 1.89.0 | MIT | dev |
| typescript | 6.0.3 | Apache-2.0 | dev |
| vite | 8.3.5 | MIT | dev |
| vitest | 5.0.5 | MIT | dev |

### Backend (NuGet)

| Package | Version | Licence | Project |
|---|---|---|---|
| Microsoft.AspNetCore.Authentication.JwtBearer | 10.0.13 | MIT | Api |
| Microsoft.AspNetCore.OpenApi | 10.0.13 | MIT | Api |
| Microsoft.EntityFrameworkCore.Design | 10.0.13 | MIT | Api |
| PdfPig | 0.1.16 | Apache-2.0 | Api |
| **QuestPDF** | 2026.9.1 | **QuestPDF licence (`LICENSE.md`: Community / commercial)** | Api |
| Swashbuckle.AspNetCore.SwaggerUI | 10.3.1 | MIT | Api |
| Anthropic | 13.1.0 | Apache-2.0 | Infrastructure |
| Microsoft.AspNetCore.Identity.EntityFrameworkCore | 10.0.13 | MIT | Infrastructure |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.0.3 | PostgreSQL | Infrastructure |
| Pgvector.EntityFrameworkCore | 0.3.0 | MIT | Infrastructure |
| coverlet.collector | 6.0.4 | MIT | Tests |
| Microsoft.AspNetCore.Mvc.Testing | 10.0.13 | MIT | Tests |
| Microsoft.NET.Test.Sdk | 17.14.1 | MIT | Tests |
| xunit / xunit.runner.visualstudio | 2.9.3 / 3.1.4 | Apache-2.0 | Tests |

Not used at baseline: MediatR, AutoMapper, Fluent Assertions.

### ML service (pip)

| Package | Version | Licence |
|---|---|---|
| fastapi | 0.159.1 | MIT |
| uvicorn[standard] | 0.54.0 | BSD-3-Clause |
| pydantic | 2.14.1 | MIT |
| python-multipart | 0.0.32 | Apache-2.0 |
| scikit-learn | 1.9.1 | BSD-3-Clause |
| numpy | 2.4.6 | BSD-3-Clause (and bundled 0BSD/MIT/Zlib) |
| joblib | 1.6.0 | BSD-3-Clause |
| onnxruntime | 1.31.0 | MIT |
| pillow | 13.0.0 | MIT-CMU |
| onnx (tests) | 1.23.2 | Apache-2.0 |
| pytest (tests) | 9.1.1 | MIT |
| httpx (tests) | 0.28.1 | BSD-3-Clause |

## 9. Known errors and risks at baseline

Recorded as found; none were fixed in this phase. Classification into conformance rows happens in Phase 2.

| ID | Observed | Detail |
|---|---|---|
| K1 | **Overview "Reject rate · 7 days" shows `0.00%` with "0 of 0 tiles"** (2026-10-30, screenshot `01-overview-dark.jpg`) | Production batches exist only up to the seed date (2026-10-23); the live simulator writes sensor readings, not batches. With no batches in the window the card shows a number instead of "no data". Data-honesty issue. |
| K2 | Seeded history does not move with time | Batches, maintenance records, observations and their dates are fixed at the seed anchor (2026-10-23); only sensor readings, alerts and anomaly scores continue live. Time-window KPIs drift towards empty as days pass. |
| K3 | Console error "Attempted to synchronously unmount a root while React was already rendering" ×21 when leaving the 3D page | Seen in the 2026-10-27 screenshot run (once per 3D HTML label); from `@react-three/drei` `<Html>` 10.7.9. Not reproduced in the 2026-10-30 run. Harmless so far. |
| K4 | Vitest printed "no tests" once when run inside a combined shell command | Same command standalone: 17/17 passed, exit 0. Intermittent tooling issue, cause not yet known (a `[vitest-pool]: Timeout terminating forks worker` message is printed on most runs). |
| K5 | First smoke run right after a 2-day shutdown: 17/20 | The simulator back-fills missed minutes on start; machine-state checks pass once it has caught up (second run 20/20). |
| K6 | QuestPDF Community licence | Free only below USD 1 M revenue and not for publicly traded companies (master prompt section 4); a listed multinational would need a paid licence or another PDF library. |
| K7 | Frontend dependency ranges not pinned; no NuGet lock file | `package.json` uses `^` ranges (installed versions already drift: oxlint 1.89.0, vite 8.3.5); .NET restore is not locked. |
| K8 | pgvector extension and `Pgvector.EntityFrameworkCore` installed | Used only by the optional Knowledge Centre embedding path (embeddings not configured). |
| K9 | No single start command; Docker Desktop and three services are started by hand | After a reboot nothing runs until each is started (README "Run"). |
| K10 | Hero title wraps to three lines at 1440 px | Cosmetic (`01-overview-dark.jpg`). |
| K11 | Large frontend chunks | `TwinPage` 1,085 kB and main 816 kB minified (three.js, Recharts). |

## 10. Screenshots (1440 × 900, signed in as the DEV admin, dark theme unless noted)

Taken 2026-10-30 with headless Chrome (Playwright) against the running stack; 0 console errors.

| Screen | File |
|---|---|
| Overview (dark / light) | [`01-overview-dark.jpg`](baseline/screenshots/01-overview-dark.jpg), [`01-overview-light.jpg`](baseline/screenshots/01-overview-light.jpg) |
| 3D digital twin, MACHINE-HP-002 selected | [`02-twin-dark.jpg`](baseline/screenshots/02-twin-dark.jpg) |
| Remote site inspection | [`03-inspection-dark.jpg`](baseline/screenshots/03-inspection-dark.jpg) |
| Observation detail | [`04-observation-dark.jpg`](baseline/screenshots/04-observation-dark.jpg) |
| Machine monitoring | [`05-monitoring-dark.jpg`](baseline/screenshots/05-monitoring-dark.jpg) |
| Machine detail (MACHINE-HP-002) | [`06-machine-detail-dark.jpg`](baseline/screenshots/06-machine-detail-dark.jpg) |
| Tile quality inspection | [`07-tile-quality-dark.jpg`](baseline/screenshots/07-tile-quality-dark.jpg) |
| Predictive maintenance | [`08-predictive-dark.jpg`](baseline/screenshots/08-predictive-dark.jpg) |
| AI assistant | [`09-assistant-dark.jpg`](baseline/screenshots/09-assistant-dark.jpg) |
| Knowledge centre | [`10-knowledge-dark.jpg`](baseline/screenshots/10-knowledge-dark.jpg) |
| Reports | [`11-reports-dark.jpg`](baseline/screenshots/11-reports-dark.jpg) |
| Report view | [`12-report-view-dark.jpg`](baseline/screenshots/12-report-view-dark.jpg) |
| Administration | [`13-admin-dark.jpg`](baseline/screenshots/13-admin-dark.jpg) |
| Not found (404) | [`14-not-found-dark.jpg`](baseline/screenshots/14-not-found-dark.jpg) |
