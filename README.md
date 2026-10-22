# TileTwin AI

Concept demo of an industrial digital twin, remote site inspection, machine monitoring,
predictive maintenance and AI assistant for the **TileTwin Demonstration Facility** — a
**fictional** tile plant. All data is synthetic. This is a prototype with no security audit;
do not deploy it as-is.

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
| Backend API | http://localhost:5080 (health: `/api/health`, OpenAPI: `/openapi/v1.json`) |
| ML service | http://localhost:8001 (health: `/health`) |
| Frontend | http://localhost:5180 (proxies `/api` to the backend) |

## First-time setup

```powershell
# 1. Config: copy and fill in (POSTGRES_PASSWORD must match the password in POSTGRES_CONNECTION)
copy .env.example .env

# 2. Database
docker compose -f database/docker-compose.yml --env-file .env up -d

# 3. Backend
dotnet restore backend/TileTwin.slnx

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

## Tests

```powershell
dotnet test backend/TileTwin.slnx
cd frontend; npm test
cd ml-service; .venv\Scripts\python -m pytest
```

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
