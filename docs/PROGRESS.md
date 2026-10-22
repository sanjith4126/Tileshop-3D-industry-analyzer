# TileTwin AI — Progress

## Current state

**Milestone 1 — DONE (2026-10-22).** Next: Milestone 2.

## Environment (2026-10-22, Windows 11)

| Tool | Version | Notes |
|---|---|---|
| node / npm | 22.18.0 / 11.13.0 | |
| dotnet | SDK 10.0.301 | projects target net10.0 |
| python | 3.11.9 (`python`) | ml-service `.venv` uses it |
| git | 2.56.0 | |
| Docker Desktop | 4.96.1 (engine 29.9.2, compose v5.6.0) | `docker.exe` is in `C:\Program Files\Docker\Docker\resources\bin` (may need a new terminal to be on PATH) |
| Local PostgreSQL 17 / 18 | ports 5432 / 5433 | **not used** by this project |

Port choices: Postgres 5434 (5432/5433 taken), API 5080, ML 8001, frontend 5180 (5173 taken by another local app).

## Milestone 1 — what works (verified 2026-10-22)

- `database/` — `pgvector/pgvector:pg16` container healthy on host port 5434; PostgreSQL 16.15,
  `vector` 0.8.7 enabled by `init/01-extensions.sql`; host connection with `.env` password verified.
- `backend/` — TileTwin.slnx: Api / Domain / Infrastructure / Tests (net10.0).
  `GET /api/health` → ok on <http://localhost:5080>; `/openapi/v1.json` → 200. `dotnet test` → 1 passed.
- `frontend/` — React 19 + TS + Vite 8 + Tailwind 4; SYNTHETIC DATA banner; shows API health through
  the `/api` proxy (verified at <http://localhost:5180/api/health>). `npm test` → 2 passed; `npm run build` OK.
- `ml-service/` — FastAPI, `GET /health` → ok on <http://localhost:8001>. `pytest` → 1 passed
  (1 Starlette deprecation warning about httpx in TestClient; harmless).
- `.env.example`, local `.env` (random secrets, git-ignored), `.gitignore`, README, `3d-assets/asset-manifest.json` stub.

## Known limitations

- Backend does not connect to the database yet (Milestone 2).
- Swagger UI not added yet; only the built-in OpenAPI JSON (Milestone 2).
- Other docs (ARCHITECTURE, DEMO-SCRIPT, TROUBLESHOOTING, ML-EVALUATION) come in later milestones.

## Next

Milestone 2 — domain, DbContext, migrations, deterministic seed, machine/zone endpoints,
health incl. DB, Swagger, JWT + roles, status-calculation tests.
