# TileTwin AI — Architecture

Concept demo for a **fictional** tile plant. Everything runs locally; only PostgreSQL runs in Docker.

```
 Browser (React 19 + Vite, :5180)
   │  /api, /assets3d  (Vite dev proxy)
   ▼
 ASP.NET Core API (.NET 10, :5080) ──────────────► Python ML service (FastAPI, :8001)
   │  controllers → services → domain rules           Isolation Forest per machine type
   │  hosted services: simulator (5 s),               ONNX tile classifier (optional model)
   │                   anomaly scoring (5 min)
   │  ILlmProvider ───────────────────────────────────► Anthropic Claude API (optional key)
   ▼
 PostgreSQL 16 + pgvector (Docker, :5434)
```

## Projects

| Path | Responsibility |
|---|---|
| `backend/TileTwin.Domain` | Entities (all business rows carry `DataOrigin` + `SeedBatchId`), enums, pure rules: `MachineStatusCalculator`, `AlertDetector`, `InspectionSummaryBuilder`, `TrendAnalyzer`, `SuggestionRules`, `MaintenancePrioritisation`, `TextChunker`. No I/O. |
| `backend/TileTwin.Infrastructure` | `TileTwinDbContext` (EF Core + Npgsql + Identity), migrations, deterministic `DemoSeeder`, `SignalModel`, `SimulationEngine`, `ReadingWriter` (binary COPY), `ILlmProvider` / `AnthropicLlmProvider`, `IEmbeddingProvider`. |
| `backend/TileTwin.Api` | Controllers (thin), services (queries/commands), DTOs, auth (JWT), reports (`ReportBuilder`, QuestPDF `PdfRenderer`), assistant tools, workflows, rate limits, timeouts, `.env` loading. |
| `backend/TileTwin.Tests` | xUnit: domain unit tests + integration tests against a real PostgreSQL database `tiletwin_test`. |
| `ml-service` | FastAPI: `/health`, `/models`, `/train`, `/predict` (anomaly), `/tile/status`, `/tile/classify`; training/evaluation CLIs; pytest. |
| `frontend` | React Router pages per module, TanStack Query polling (7 s), React Three Fiber twin, Recharts charts, Vitest. |
| `3d-assets` | `asset-manifest.json` (entity → type, position, rotation, scale, optional GLB `modelPath`), served at `/assets3d`. |
| `database` | `docker-compose.yml` (Postgres only), `init/01-extensions.sql` (pgvector). |

## Data flow

1. **Seed** (first start or *Reset demo data*): 7 days of 1-minute readings for 49 sensors written with
   PostgreSQL binary COPY; the alert rules are replayed over the history so alerts have real crossing
   times. Fixed random seed → identical values every reset.
2. **Simulator** (`SimulatorHostedService`, every 5 s): one reading per live sensor, continuing the
   scripted patterns (`SignalModel`); fills missing minutes after restarts or PC sleep; opens threshold
   alerts with de-duplication. Pausable from Administration.
3. **Status** is computed on read (`MachineStatusCalculator`): Offline > Critical > Unknown > Warning >
   Normal; missing data is never Normal; a fresh ML anomaly raises Normal to Warning.
4. **Anomaly scoring** (`AnomalyHostedService`, every 5 min, or "Score now"): last 60 one-minute samples
   per sensor → ML service → stored `AnomalyScores`. ML down → "ML service unavailable", never a score.
5. **Predictive view / workflow**: trends + alerts + score + maintenance history → documented rules
   (`docs/MAINTENANCE-RULES.md`). Deterministic; an LLM may only reword the recommendation.
6. **Assistant**: `AnthropicLlmProvider` runs a tool loop (max 6 calls) over read-only tools with
   validated arguments and row limits; every call is written to `AuditLog`. Entity IDs in the answer
   become `focusEntityIds` for "Show in 3D".
7. **3D twin**: the manifest gives layout; colours/labels come from `GET /api/machines`; any page calls
   `focusEntity(id)` (shared store) to fly the camera to a machine or zone.

## Key decisions

| Decision | Why |
|---|---|
| Reads anonymous, every write needs JWT + role | The spec requires non-AI modules to work with no optional variables; with no dev users there would be nobody to sign in. |
| Critical ranks above Unknown | A critical reading must never be hidden by another sensor's missing data. |
| Latest reading via `LEFT JOIN LATERAL` raw SQL | EF translated "latest per group" to a full-table `ROW_NUMBER` (600 ms → 8 ms). |
| Downsampling in SQL (`date_bin`, avg/min/max) | Charts get ≤ ~300 points per sensor; spikes stay visible in the min–max band. |
| Isolation Forest + feature-range check | Measured: Isolation Forest alone missed ~95 % of level shifts beyond the training range (`docs/ML-EVALUATION.md`). |
| FK delete behaviour `Restrict` everywhere | Resetting demo rows can never cascade into user-created rows; synthetic parents with user children are kept. |
| One shared lock for simulator ticks and reset | They never interleave writes. |
| `DataOrigin` on every business row | Reset deletes only `Synthetic` + `demo-v1`; the UI shows DEMO DATA badges. |
| Tile model and embeddings behind interfaces | No model or provider ships; the app shows honest "NOT CONFIGURED" states. |

## Security (prototype — no security audit)

JWT (8 h) with Identity lockout; role checks on every write endpoint; input validation (DataAnnotations
+ tool-argument validation); uploads checked by content (magic bytes / strict UTF-8), 10 MB limit,
sanitised names, stored under generated names; rate limits (login 10/min, assistant 10/min, ML score
20/min, uploads 10/min); request timeouts (30 s, 150 s for LLM/workflow/report/reset); no default admin
password; secrets only in `.env` (git-ignored); LLM calls server-side only; tool results and documents
treated as untrusted data in the system prompt.
