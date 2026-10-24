# TileTwin AI

Concept demo of an industrial digital twin, remote site inspection, machine monitoring,
predictive maintenance and AI assistant for the **TileTwin Demonstration Facility** — a
**fictional** tile plant. All data is synthetic. This is a prototype with no security audit;
do not deploy it as-is.

> PDF reports will use QuestPDF. Its Community licence is free only for organisations under the
> revenue threshold — a company adopting this must check QuestPDF licensing.

## Prerequisites

| Tool | Version used |
|---|---|
| Docker Desktop (with `docker compose`) | 4.96 |
| .NET SDK | 10.0 |
| Node.js / npm | 22.x / 11.x |
| Python | 3.11+ |

## Ports

| Service | URL |
|---|---|
| PostgreSQL 16 + pgvector (Docker) | `localhost:5434` |
| Backend API | http://localhost:5080 (health: `/api/health`, Swagger UI: `/swagger`, OpenAPI: `/openapi/v1.json`) |
| ML service | http://localhost:8001 (health: `/health`) |
| Frontend | http://localhost:5180 (proxies `/api` to the backend) |

## First-time setup

```powershell
# 1. Config: copy and fill in (POSTGRES_PASSWORD must match the password in POSTGRES_CONNECTION)
copy .env.example .env

# 2. Database
docker compose -f database/docker-compose.yml --env-file .env up -d

# 3. Backend (migrations + demo seed run automatically on first API start)
dotnet tool restore
dotnet restore backend/TileTwin.slnx
# optional, to apply migrations by hand:
dotnet ef database update --project backend/TileTwin.Infrastructure --startup-project backend/TileTwin.Api

# 4. ML service
cd ml-service
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
cd ..

# 5. Frontend
cd frontend
npm install
cd ..
```

## Run (three terminals)

```powershell
dotnet run --project backend/TileTwin.Api --launch-profile http
cd ml-service; .venv\Scripts\python -m uvicorn app.main:app --port 8001
cd frontend; npm run dev
```

## Users and access

- Read endpoints are open (demo viewer). Every write endpoint requires a JWT with a suitable role
  (`Viewer`, `Inspector`, `MaintenanceEngineer`, `Admin`). Get one from `POST /api/auth/login`.
- There is **no default admin password**. Admins create further users in **Administration**. Dev users are created only when the environment is
  `Development` **and** `DEV_SEED_USER_PASSWORD` is set: `dev.viewer@tiletwin.local`,
  `dev.inspector@…`, `dev.maintenanceengineer@…`, `dev.admin@…` (all labelled DEV ONLY), password = that variable.

## Demo data

On first start the API seeds a deterministic synthetic dataset (fixed random seed): 1 site, 5 zones,
16 machines, 49 sensors, 7 days of 1-minute readings (~494k rows), 25 inspection observations,
maintenance records and production batches. Every row is `DataOrigin = Synthetic`, `SeedBatchId = demo-v1`.
Readings are anchored to the seed time. While the API runs, a simulator writes a reading per sensor
every 5 s and continues the scripted patterns; after a restart or PC sleep it fills missing minutes so
charts and ML windows stay complete. **Administration → Reset demo data** (Admin) deletes only
`Synthetic` rows of the demo batch in one transaction and re-seeds; user-created rows are kept.

## Tests

Backend integration tests use a real PostgreSQL database `tiletwin_test` (created automatically in
the docker compose Postgres), so start the database first.

```powershell
dotnet test backend/TileTwin.slnx
cd frontend; npm test
cd ml-service; .venv\Scripts\python -m pytest
```

## ML service

Models (one Isolation Forest per machine type) train automatically on synthetic data at first start
(a few seconds) and are stored in `ml-service/models/`. Manual commands:

```powershell
cd ml-service
.venv\Scripts\python -m app.train      # retrain
.venv\Scripts\python -m app.evaluate   # evaluate on synthetic data -> docs/ML-EVALUATION.md
```

The API scores every machine every 5 minutes. If the ML service is down, the UI says
"ML service unavailable" and shows no score. Evaluation numbers are on synthetic data only.

## AI assistant (optional)

Set `ANTHROPIC_API_KEY` and `LLM__Model` (e.g. `claude-opus-5-5`) in `.env` and restart the API.
Without them the assistant page shows **AI NOT CONFIGURED** and everything else still works. The
assistant runs server-side only, uses read-only tools (plus report drafts), at most 6 tool calls per
question, logs every tool call to `AuditLog`, and is rate-limited (10 requests/min per user). Server-side
refusal fallback (`fallbacks: "default"`) is enabled on the Claude requests.

## Repository layout

```
frontend/      React + TypeScript + Vite + Tailwind
backend/       ASP.NET Core API, Domain, Infrastructure, Tests
ml-service/    FastAPI ML service
3d-assets/     asset-manifest.json (+ optional GLB files)
database/      docker-compose.yml, init scripts (enables pgvector)
docs/          PROGRESS.md and project docs
```

See [docs/PROGRESS.md](docs/PROGRESS.md) for what currently works.
