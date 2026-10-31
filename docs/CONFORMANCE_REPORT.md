# Conformance report (Phase 2 of `docs/MASTER_PROMPT.md`)

Audit date **2026-10-30**, code at tag `baseline` (`6f639e6`). Method: every MUST and SHOULD in sections 2–22
and every row of Appendix B was checked by reading the code and by exercising the running stack
(API, ML service, frontend, Postgres). Nothing was inferred from file names.

Evidence files produced in this audit:
- [`conformance/probes-2026-10-30.txt`](conformance/probes-2026-10-30.txt) — HTTP and browser probes against the running app
  (anonymous access, error formats, security headers, health endpoints, JWT claims, lockout, response fields,
  latency, layout at 375/1280 px). Tokens and passwords are never printed.
- [`BASELINE.md`](BASELINE.md), [`baseline/schema.sql`](baseline/schema.sql), [`baseline/openapi.v1.json`](baseline/openapi.v1.json),
  [`baseline/screenshots/`](baseline/screenshots/) — Phase 1 records.
- File references are `path:line` at the `baseline` tag. "Probe §n" refers to a section of the probes file.

Statuses: CONFORMS · PARTIAL · MISSING · VIOLATES · NOT_APPLICABLE (Appendix D). Priority P0–P4 follows section 23.3.
Effort: S < ½ day, M ≤ 2 days, L more. **Slice** is assigned in Phase 4 (remediation plan); `TBD` until then.

<!-- SUMMARY:BEGIN -->
## Summary (2026-10-31)

352 requirement rows (sections 2–22 and Appendix B).

| Status | Rows | Share |
|---|---:|---:|
| CONFORMS | 64 | 18 % |
| PARTIAL | 185 | 53 % |
| MISSING | 73 | 21 % |
| VIOLATES | 30 | 9 % |
| NOT_APPLICABLE | 0 | 0 % |

Open rows (everything not CONFORMS) by priority:

| Priority | Meaning | PARTIAL | MISSING | VIOLATES | Total |
|---|---|---:|---:|---:|---:|
| P0 | data honesty, security, licences | 17 | 10 | 14 | 41 |
| P1 | policy correctness, data integrity, backend authority | 47 | 30 | 8 | 85 |
| P2 | architecture, API, observability, performance, degraded modes | 68 | 22 | 5 | 95 |
| P3 | design system, accessibility, UX, 3D twin | 38 | 1 | 3 | 42 |
| P4 | documentation, ADRs, demo script | 15 | 10 | 0 | 25 |
| **All** | | 185 | 73 | 30 | **288** |
<!-- SUMMARY:END -->

Counts at the baseline and now are identical, because Phase 2 changes no application code. Regenerate this block
with `python scripts/conformance_summary.py` after any row changes.

**Phase 2 gate:** you review this report. Phase 3 (safety net: CI, characterization tests, Playwright smoke suite,
report-only architecture tests) does not change behaviour and can start after your review. Phase 4 (the remediation
plan) also needs your answers to decisions D1–D8.

## Decisions needed from you before Phase 4

These hit the "stop and ask" list in section 23.1 (removing features, renaming stored codes, replacing a library,
destructive migrations, changing how the demo is accessed). The plan cannot be finalised without them.

| # | Decision | Why it matters | Recommendation |
|---|---|---|---|
| D1 | **Roles.** The app has `Viewer, Inspector, MaintenanceEngineer, Admin`; the prompt requires `Administrator, Plant Manager, Maintenance Engineer, Inspector`. | `Viewer` is read-only today; a Plant Manager may acknowledge alerts and create inspections. Role names are stored data. | Rename `Viewer` → `PlantManager` and `Admin` → `Administrator` in a migration, with the Appendix B permissions. |
| D2 | **Tile Quality Inspection and Knowledge Centre** are not in the target scope (section 1 lists seven capabilities). They bring 3 tables, pgvector, ONNX Runtime and PdfPig. | Principle 8: complexity without a recorded reason is a gap. Removing a feature needs your approval. | Your call: keep both with an ADR and an exception (they are working and demo well), or remove them to match the target exactly. |
| D3 | **PDF library.** QuestPDF's Community licence excludes publicly traded companies at any revenue. | A listed manufacturer adopting the code would need a paid QuestPDF licence. | Migrate to PDFsharp/MigraDoc (MIT) — no licence question for the client. |
| D4 | **Plant model.** Keep the current codes (`MACHINE-HP-002`, `ZONE-PRESS-A`, …) or adopt the reference model (`BM-101` … `PL-501`, 54 sensors). | Section 6 says keep the project's codes; renaming stored codes needs approval. | Keep the current codes and map Scenarios A–D onto them (documented in SIMULATOR_DOCUMENTATION.md). |
| D5 | **Database naming.** Tables and columns are PascalCase; the rule is snake_case. | Renaming every table is a large data-touching migration (section 11.1 needs an ADR weighing the risk). | Keep PascalCase with an approved exception; use snake_case only for new tables? (Mixed naming is also a cost — your call.) |
| D6 | **Anonymous read access.** Today anyone who can reach the API can read machines, alerts, observations, reports and PDFs without signing in. | Appendix B grants no anonymous access; closing it means every demo starts with a sign-in. | Require sign-in everywhere (P0), keep the demo-account buttons on the sign-in dialog. |
| D7 | **Separate Worker process** (simulator, alert evaluation, ML scoring, reports) plus PostgreSQL NOTIFY → SignalR. | The largest structural change in the prompt (section 5). Allowed without approval, but it is several days of work. | Do it, after the P0/P1 slices. |
| D8 | **Production batches / reject-rate KPI** have no row in the target schema. | Baseline issue K1 shows "0.00 %" from zero records. | Keep the table with an ADR (it feeds a useful KPI) and fix the empty-window display in a P0 slice. |

## Most important findings (P0)

1. **Anyone can read everything without signing in**, including report PDFs (12-13, 17-04, Appendix B).
2. **Missing data is hidden**: charts draw straight lines across gaps (2-07), and after downtime the simulator back-fills
   the outage with generated readings that carry no provenance (2-08).
3. **A KPI is shown from no data**: the Overview reports a 0.00 % reject rate from 0 units (2-11).
4. **The AI assistant can write** (`create_report_draft`) although it must be read-only (2-15).
5. **Authentication is below standard**: 8-hour tokens that contain the user's email, no refresh/logout/revocation,
   a disabled user keeps a valid token, the token sits in `sessionStorage`, no security headers (12-07 … 12-11, 12-25).
6. **Authorisation is by role name, not permission, with no data scoping**, and Inspectors can acknowledge alerts
   (12-12, 12-16, B-05).
7. **Licence decision for QuestPDF** is open (4-16, D3).

## 2. Prime directives

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 2-01 | Every screen showing plant data identifies it as SYNTHETIC DEMO DATA | CONFORMS | `frontend/src/components/Layout.tsx` banner "DEMONSTRATION FACILITY — SYNTHETIC DEMO DATA" on every page; `DemoBadge` "SYNTHETIC DEMO DATA" keyed on `dataClassification`; every sensor chart and the score history carry the label in their caption (`SensorChart.tsx`, `ScoreCard.tsx`); tests `shell.test.tsx`, `monitoring.test.tsx`, `inspection.test.tsx` (S01) | — | — | — | S01 |
| 2-02 | Every API response with plant data identifies it as synthetic | CONFORMS | `dataClassification` (set at plant level, `backend/TileTwin.Domain/PlantData.cs`) on machines, zones, readings, alerts, observations, inspection summaries, predictive, ML status, overview, reports, tile inspections, workflow executions and assistant answers; test `HonestDataTests.Plant_data_responses_are_classified_synthetic` (12 endpoints) (S01) | — | — | — | S01 |
| 2-03 | Exports and reports are labelled synthetic | CONFORMS | `backend/TileTwin.Api/Reports/PdfRenderer.cs`: "SYNTHETIC DEMO DATA" in the header and footer of every page, unconditionally; report view banner keyed on `dataClassification`; `ReportTests` checks the label in the JSON (S01) | — | — | — | S01 |
| 2-04 | Assistant answers identify synthetic data | CONFORMS | `backend/TileTwin.Api/Assistant/AssistantService.cs:19` disclaimer on every answer; `:22` system prompt | — | — | — | — |
| 2-05 | No Saint-Gobain data, logos, branding or implied endorsement in the application | CONFORMS | `git grep -i saint -- frontend backend ml-service 3d-assets database scripts` → 0 files (2026-10-30) | — | — | — | — |
| 2-06 | Absent, late or stale readings never count as NORMAL | CONFORMS | `backend/TileTwin.Domain/Status/MachineStatusCalculator.cs:39-45,57`; test `Missing_required_sensor_is_Unknown_never_Normal`; probe §7: PUMP-002 = Unknown | — | — | — | — |
| 2-07 | Gaps are visible in charts; nothing is interpolated | CONFORMS | `ReadingsService.cs` returns every bucket with `count` (empty = nulls); `SensorChart.tsx` breaks the line (`connectNulls={false}`), shades gaps "No data", draws lone readings as dots and flags a stale latest value; score history and the reject-rate sparkline break at gaps; tests `MonitoringTests.Readings_keep_gaps_as_empty_buckets`, `monitoring.test.tsx` (S01) | — | — | — | S01 |
| 2-08 | Readings are never forward-filled or back-filled to hide missing data | CONFORMS | `SimulationEngine.cs` writes the live point only (the SinceLast/Holes back-fill modes are removed); test `MonitoringTests.Simulator_never_backfills_downtime`; README, ARCHITECTURE and TROUBLESHOOTING updated (S01) | — | — | — | S01 |
| 2-09 | Status, alert state, KPIs, priorities and permissions are computed server-side | PARTIAL | Status `MachineService.cs:91-98`, alerts and priorities server-side; but `frontend/src/pages/OverviewPage.tsx:30` computes the fleet %, and the warning count is `total − critical` in the browser | Some KPIs are derived in the frontend | P1 | S | S19 |
| 2-10 | The frontend is never a security boundary | CONFORMS | Write endpoints enforce roles server-side; tests `Write_endpoint_enforces_roles`, `Admin_endpoints_require_admin_role` | — | — | — | — |
| 2-11 | No fabricated values, mock data or invented responses | CONFORMS | `ProductionQuality.RejectRatePercent` returns null without units (`ProductionQualityTests`), used by the overview and the assistant tool; the overview lists all 7 days and shows "No data — No production records in the last 7 days" (`HonestDataTests.Production_kpi_lists_every_day_and_has_no_rate_without_units`, `overview.test.tsx`) (S01) | — | — | — | S01 |
| 2-12 | Unavailable dependencies show an explicit unavailable / not-configured state with the reason | CONFORMS | `AssistantController.cs:21` (503 AI NOT CONFIGURED), `MlClient.cs:25-42` (no score when ML is down), tile MODEL NOT CONFIGURED; tests `On_demand_score_requires_sign_in_and_reports_unavailable_honestly`, `Without_a_key_the_assistant_reports_not_configured_and_gives_no_answer` | — | — | — | — |
| 2-13 | Anomaly scores are worded as statistical deviation, never failure probability | CONFORMS | `PredictiveService.cs:16-17`, `ReportBuilder.cs:95`, `AssistantService.cs:27`; UI text asserted in `predictive.test.tsx` | — | — | — | — |
| 2-14 | The application works fully when the AI provider is absent, misconfigured or failing | CONFORMS | Test host blanks AI keys and all 85 tests pass; `AssistantController.cs:21-41`; workflow falls back to deterministic text (`AssistantWorkflowTests`) | — | — | — | — |
| 2-15 | The assistant only calls read-only tools and never writes | VIOLATES | `backend/TileTwin.Api/Assistant/AssistantTools.cs:44,62` `create_report_draft` inserts a Report | One write tool | P0 | S | S02 |
| 2-16 | The assistant never executes model-generated SQL | CONFORMS | Tools are fixed C# queries with validated arguments (`AssistantTools.cs`, `ToolArgs.cs`); test `Invalid_argument_json_is_returned_as_an_error_not_executed` | — | — | — | — |
| 2-17 | Assistant tools run under the requesting user's permissions | MISSING | `AssistantTools.ExecuteAsync` receives the user name only for auditing; no scope exists | No data scoping | P0 | M | S05 |
| 2-18 | No regulatory compliance or certification claims | CONFORMS | `git grep -i -E "ISO ?27001\|IEC ?62443\|SOC ?2\|certified"` in README and docs (excluding the prompt) → 0 lines | — | — | — | — |
| 2-19 | Every dependency, table, service and abstraction has a recorded reason | MISSING | No `docs/adr/`, no `docs/DEPENDENCIES.md`; modules outside the target scope (D2) have no ADR | Reasons not recorded | P4 | M | S33 |
| 2-20 | Behaviour changes are deliberate, tested and recorded in a CHANGELOG | PARTIAL | Baseline recorded (tag `baseline`); no `CHANGELOG.md` | CHANGELOG missing | P4 | S | S33 |

## 3. Engineering principles

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 3-01 | Clean Architecture: Domain, Application, Infrastructure, API with dependency inversion | PARTIAL | `backend/` has Api, Domain, Infrastructure, Tests; use cases live in `TileTwin.Api/Services` | No Application layer | P2 | L | S21 |
| 3-02 | No business logic in controllers; controllers stay thin | PARTIAL | `AdminController.cs:76-85` computes production KPIs in `OverviewController`; `Controllers.cs:16-31` health logic | Logic in two controllers | P2 | S | S21 |
| 3-03 | Centralised exception handling | MISSING | `backend/TileTwin.Api/Program.cs:144-148` — no `UseExceptionHandler` / `AddProblemDetails` | Unhandled errors use framework defaults | P2 | S | S23 |
| 3-04 | Structured logging with correlation IDs | MISSING | Default Microsoft logging (no Serilog package); probe §3 no `X-Correlation-ID` | — | P2 | M | S24 |
| 3-05 | No hard-coded thresholds, intervals or URLs in business logic | VIOLATES | `MachineStatusCalculator.cs:21` (5 min), `AnomalyScoringService.cs:28-29,119`, `SimulatorHostedService.cs:8`, `MaintenancePrioritisation.cs:24-32` weights, `Program.cs:61` Groq URL | Policy values are code literals, not configuration | P2 | M | S11 |
| 3-06 | No silent error handling | CONFORMS | Reviewed every `catch`: `Controllers.cs:20` maps to "degraded"; frontend storage fallbacks are documented (`theme.tsx:18`, `auth.tsx:39,43`, `Layout.tsx:13,20`) | — | — | — | — |
| 3-07 | No controls that look functional but do nothing | CONFORMS | Screens in `baseline/screenshots`: actions are hidden or replaced by a reason ("Sign in as …"); submit buttons disabled until valid input | — | — | — | — |
| 3-08 | No decorative elements or animation that carry no information | VIOLATES | `frontend/src/index.css:186` `.glass` (backdrop blur), `:279` `.bg-blueprint` grid, `:290-337` reveal animation; hero glow in `OverviewPage.tsx` | Decorative effects (also 14-06) | P3 | S | S29 |
| 3-09 | No duplicated business logic | PARTIAL | ML sensor specs `ml-service/app/synthetic.py:12-18` duplicate `DemoPlant.cs`; band check repeated in `MachineService.cs:103-110` | Training data spec duplicated across services | P2 | M | S14 |
| 3-10 | No abstractions or services without a current use | PARTIAL | `IEmbeddingProvider` with only a not-configured implementation (`Program.cs:76`) and a pgvector column; workflow registry with one workflow | Speculative abstractions need an ADR or removal (D2) | P2 | S | S21 |
| 3-11 | No god components (≈300-line limit) | CONFORMS | Largest files: `PredictivePage.tsx` 181 lines, `DemoRecords.cs` 194 lines (`wc -l`, 2026-10-30) | — | — | — | — |

## 4. Technology stack and dependency policy

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 4-01 | React, TypeScript strict, Vite, Tailwind, Three.js/R3F/Drei, TanStack Query, React Router, Recharts | CONFORMS | `frontend/package.json`; strict mode proven by a probe file failing with TS7006 under `tsconfig.app.json` (2026-10-30) | — | — | — | — |
| 4-02 | Zustand for shared UI state; React Hook Form + Zod for forms | PARTIAL | `frontend/src/store/focus.ts` custom store; forms hand-validated, no Zod | Different/no libraries; keep with ADR or adopt | P3 | M | S29 |
| 4-03 | ASP.NET Core .NET 10, EF Core + Npgsql, JWT bearer | CONFORMS | csproj versions in BASELINE §2, §8 | — | — | — | — |
| 4-04 | Policy-based authorisation | MISSING | `Program.cs:47` `AddAuthorization()` without policies; role-name attributes e.g. `AlertsController.cs:20` | — | P0 | M | S04 |
| 4-05 | FluentValidation | PARTIAL | DataAnnotations: `UserAdminService.cs:11-17`, `AssistantService.cs:10-12` | Different library; meets intent partly (ADR or migrate) | P2 | M | S21 |
| 4-06 | OpenAPI via Microsoft.AspNetCore.OpenApi; Swagger UI outside Production only | PARTIAL | `Program.cs:118,124-129` UI mapped in every environment; probe §4 `/swagger/index.html` 200 | Swagger UI not environment-gated | P2 | S | S27 |
| 4-07 | Serilog | MISSING | No Serilog package (BASELINE §8) | — | P2 | M | S24 |
| 4-08 | SignalR | MISSING | No hub (`Program.cs`) | — | P2 | L | S22 |
| 4-09 | PostgreSQL 15 or later | CONFORMS | PostgreSQL 16.15 (BASELINE §2) | — | — | — | — |
| 4-10 | pgvector is out of scope | VIOLATES | `TileTwinDbContext.cs:105,114-115`; `Program.cs:24` `UseVector()`; image `pgvector/pgvector:pg16` | Extension and column in use (Knowledge Centre, D2) | P2 | S | S27 |
| 4-11 | ML: Python, FastAPI, Pydantic, scikit-learn, pytest | CONFORMS | `ml-service/requirements.txt` | — | — | — | — |
| 4-12 | ONNX Runtime only with an ADR | PARTIAL | `onnxruntime` for the tile classifier (`ml-service/app/tile.py`); no ADR | ADR missing (D2) | P4 | S | S27 |
| 4-13 | AI provider abstraction with Anthropic and Groq adapters; provider, model and keys from configuration | CONFORMS | `TileTwin.Infrastructure/Llm/ILlmProvider.cs:15`, `GroqLlmProvider.cs`, `AnthropicLlmProvider.cs`; `AppConfig.cs:52-55` | — | — | — | — |
| 4-14 | Test stack: xUnit, NSubstitute, Shouldly/plain, Testcontainers, WebApplicationFactory, NetArchTest, FakeTimeProvider; Vitest, RTL, MSW; Playwright + axe; pytest | PARTIAL | xUnit, WebApplicationFactory (`Tests/Integration/ApiFactory.cs`), Vitest, RTL, pytest present; others absent | Testcontainers, NSubstitute, NetArchTest, FakeTimeProvider, MSW, Playwright, axe missing | P2 | M | S27 |
| 4-15 | No MediatR, AutoMapper or Fluent Assertions 8 | CONFORMS | Not referenced (BASELINE §8) | — | — | — | — |
| 4-16 | QuestPDF: migrate to an MIT library or record the paid-licence requirement in an ADR | PARTIAL | `PdfRenderer.cs:13` Community licence; README licence note; no ADR | Decision open (D3) | P0 | M | S08 |
| 4-17 | Exact version pins and committed lock files | PARTIAL | `frontend/package.json` caret ranges; `package-lock.json` committed; no NuGet lock file; pip `==` pins (BASELINE K7) | Ranges and missing .NET lock | P2 | S | S27 |
| 4-18 | `docs/DEPENDENCIES.md` with version, licence, purpose | MISSING | File absent (licences listed in BASELINE §8) | — | P4 | S | S33 |
| 4-19 | Vulnerability scans in CI (`dotnet list --vulnerable`, `npm audit`, `pip-audit`) | MISSING | No CI; `npm audit` run manually: 0 vulnerabilities (BASELINE §5) | — | P2 | S | S27 |
| 4-20 | No Redis, brokers, Kubernetes, cloud services, TimescaleDB, extra UI kits or extra chart/3D libraries | CONFORMS | Dependency lists (BASELINE §8) | — | — | — | — |
| 4-21 | Self-hosted fonts, no font/script CDNs | CONFORMS | `@fontsource` packages imported in `frontend/src/index.css` | — | — | — | — |
| 4-22 | lucide-react icons so status never depends on colour alone | CONFORMS | `frontend/src/lib/status.ts:16-20` | — | — | — | — |

## 5. System architecture

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 5-01 | Four processes: web behind a reverse proxy, API, Worker, ML service (+ PostgreSQL) | PARTIAL | Simulator and scoring run inside the API (`Program.cs:109-114`); the SPA is served by the Vite dev server | No Worker, no reverse proxy (D7) | P2 | L | S22 |
| 5-02 | The frontend never reaches PostgreSQL, the ML service or an AI provider directly | CONFORMS | All 40 frontend calls go to `/api/…` (`frontend/src/api/client.ts`); ML is called only by `MlClient` | — | — | — | — |
| 5-03 | The ML service has no database access | CONFORMS | `ml-service/requirements.txt` has no DB driver; `app/main.py` | — | — | — | — |
| 5-04 | Every business operation runs through an Application-layer use case shared by all hosts | MISSING | No Application project (see 3-01) | — | P2 | L | S21 |
| 5-05 | The assistant is an isolated module behind its own interface and flag; no other feature references it | PARTIAL | `Workflows/MaintenancePrioritisationWorkflow.cs:26` and `AdminController.cs:62` use `ILlmProvider`; no `Assistant:Enabled` flag | Not isolated | P2 | S | S26 |
| 5-06 | Worker changes reach the API via PostgreSQL NOTIFY; the API pushes refetch hints over SignalR | MISSING | No LISTEN/NOTIFY or hub | — | P2 | L | S22 |
| 5-07 | Backend solution layout `src/…`, `tests/…` (or an ADR for a lasting difference) | PARTIAL | `backend/TileTwin.{Api,Domain,Infrastructure,Tests}` | Different layout, no ADR | P2 | L | S21 |
| 5-08 | Domain references nothing else | CONFORMS | `backend/TileTwin.Domain/TileTwin.Domain.csproj` has no package or project references | — | — | — | — |
| 5-09 | Application owns the interfaces (ITelemetryIngestion, IMlScoringClient, IAssistantModelClient, IFileStorage, IPdfRenderer, IRealtimeNotifier, ICurrentUser, IAccessScope, IAuditLog) | MISSING | `ILlmProvider`/`IEmbeddingProvider` live in Infrastructure; the rest do not exist | — | P2 | L | S21 |
| 5-10 | One data-access style, recorded in an ADR; no forwarding generic repositories | PARTIAL | Services use `TileTwinDbContext` directly everywhere (consistent, no generic repositories) | ADR missing | P4 | S | S21 |
| 5-11 | Cross-cutting concerns through a small pipeline or decorators | MISSING | Validation, auditing and transactions are called by hand in each service | — | P2 | M | S21 |
| 5-12 | Architecture tests for the layer rules (report-only now) | MISSING | No architecture test project | — | P2 | S | S21 |
| 5-13 | Frontend feature-folder layout | PARTIAL | `frontend/src/{api,auth,components,lib,pages,store,twin}` | Different structure (keep via ADR or move) | P3 | M | S29 |
| 5-14 | One HTTP client: bearer token, single-flight refresh, AbortController timeouts, correlation IDs, Problem Details parsing | PARTIAL | `frontend/src/api/client.ts:9-39` — token on writes only, no timeout, no correlation ID, partial error parsing | Missing behaviours | P2 | M | S23 |
| 5-15 | Generated OpenAPI types in `src/api/generated` | MISSING | Hand-written `frontend/src/api/types.ts` | — | P2 | M | S23 |
| 5-16 | MSW and fixtures only under test directories | CONFORMS | No mock data in application code; tests stub `fetch` in `src/test-utils.tsx` | — | — | — | — |
| 5-17 | API base path from Vite env; no hostnames in code | PARTIAL | 40 hard-coded `'/api/…'` strings; no hostnames | No env-driven base path | P3 | S | S23 |
| 5-18 | ML service structure and README | PARTIAL | Flat `ml-service/app/*.py`; no `ml-service/README.md` | — | P4 | S | S33 |
| 5-19 | Polling fallback with a visible indicator when live updates are down | PARTIAL | TanStack polling every 7 s; TopBar "Live · Ns ago" / "Connection lost" | Always polling (no SignalR), no "Live updates paused" state | P2 | S | S22 |
| 5-20 | Optimistic concurrency with `xmin`; 409 on conflict | MISSING | No concurrency tokens in `TileTwinDbContext.cs` | Lost updates possible | P1 | M | S20 |
| 5-21 | Idempotent ingestion: primary key (sensor_id, recorded_at), duplicates ignored | MISSING | `TileTwin.Domain/Entities/Plant.cs:57` `long Id`; schema PK on `Id` | Duplicates possible | P1 | M | S10 |
| 5-22 | One transaction per use case | CONFORMS | One `SaveChangesAsync` per operation (e.g. `AlertService.cs:50`); simulator tick in one transaction `SimulationEngine.cs:60-71` | — | — | — | — |
| 5-23 | Every timestamp stored as UTC `timestamptz` | CONFORMS | `baseline/schema.sql`: 28 `timestamp with time zone`, 0 without | — | — | — | — |
| 5-24 | `TimeProvider` everywhere; never `DateTime.UtcNow` | VIOLATES | `DateTime.UtcNow` at `AdminController.cs:77`, `Controllers.cs:30`, `Program.cs:163`, `AnomalyScoringService.cs:19`, `SimulatorHostedService.cs:21`, `UserAdminService.cs:60`, `DemoSeeder.cs:34,54,62` (also reported by the architecture tests) | 9 direct uses | P2 | S | S21 |
| 5-25 | Injectable clock in Python | VIOLATES | `ml-service/app/main.py:68,112`, `model.py:79` call `datetime.now` | — | P2 | S | S14 |
| 5-26 | UI shows plant local time with a zone label, UTC in a tooltip | PARTIAL | `frontend/src/lib/status.ts:40-43` shows UTC everywhere | No plant time zone | P3 | S | S29 |

## 6. The demonstration plant

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 6-01 | One site, five zones in process order, sixteen machines | CONFORMS | BASELINE §6; tests `Zones_list_has_five_zones`, `Seed_volumes_match_spec` | — | — | — | — |
| 6-02 | Keep the project's codes and use them consistently (seed, simulator, tests, docs, demo script) | CONFORMS | `MACHINE-*`/`ZONE-*` codes in `DemoPlant.cs`, tests and `DEMO-SCRIPT.md` (D4) | — | — | — | — |
| 6-03 | Thresholds are illustrative demo values kept in seed data and documented as such | CONFORMS | `Plant.cs:41` comment; limits in `DemoPlant.cs`; UI "Limits are illustrative demo values" | — | — | — | — |
| 6-04 | Each sensor has key, unit, resolution, expected interval, physical limits, warning and critical bands | PARTIAL | `Plant.cs:42-53` (id, measurement, unit, required, warning/critical min/max) | No key, resolution, interval or physical limits | P1 | M | S09 |
| 6-05 | Band ordering enforced with a CHECK | MISSING | `baseline/schema.sql` has no CHECK constraints | — | P1 | S | S09 |
| 6-06 | Machine criticality class A/B/C | MISSING | `Plant.cs:25-39` | — | P1 | S | S09 |
| 6-07 | Layout is data (zone rectangles, machine position and rotation records); the 3D scene is built from them | PARTIAL | `3d-assets/asset-manifest.json` served at `/assets3d` (`Program.cs:132-142`) | Layout is a static file, not plant records exposed by the API | P3 | M | S32 |
| 6-08 | Classification set at plant level and inherited | PARTIAL | `TileTwin.Domain/Entities/BusinessEntity.cs:6` per-row `DataOrigin` (default `Real`) | No plant-level classification | P1 | M | S09 |

## 7. Operational policies

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 7-01 | Status, alert and KPI rules are pure Domain policy objects with table-driven tests | PARTIAL | `MachineStatusCalculator.cs`, `AlertDetector.cs`, `MaintenancePrioritisation.cs` are pure; tests are individual facts | Not table-driven; KPIs not in Domain | P1 | S | S11 |
| 7-02 | The Worker applies policies on ingestion and schedule; the API applies the same objects at read time; nothing else computes status | PARTIAL | Status computed on every read (`MachineService.cs:93`); alerts detected at ingestion (`SimulationEngine.cs:63-69`) | No persisted runtime state; see 2-09 | P1 | M | S11 |
| 7-03 | Expected reporting interval per sensor ([5 s]) | PARTIAL | Simulator ticks every 5 s (`SimulatorHostedService.cs:8`) | Not modelled per sensor | P1 | S | S11 |
| 7-04 | Sensor FRESH / STALE / NO_DATA with `stale_after` = 3 × interval | PARTIAL | `MachineStatusCalculator.cs:21,39-45` uses 5 min; `MachineService.cs:103-106` "Missing" | Single 5-minute literal, no NO_DATA distinction | P1 | S | S11 |
| 7-05 | Machine communicating while any sensor reported within `offline_after` ([60 s]) | PARTIAL | `MachineStatusCalculator.cs:29-31` uses 5 min | Literal 5 min, not configuration | P1 | S | S11 |
| 7-06 | Nothing interpolates or forward-fills (status, charts, ML, reports) | CONFORMS | Charts and readings: 2-07, 2-08. Status: missing data gives Unknown or Offline (`MachineStatusCalculator`). ML: one sample per minute, nothing filled, windows under 45 of 60 samples refused (`ml-service/app/main.py` MIN_POINTS). Predictive trends and averages skip empty buckets (`PredictiveService.cs`) (S01) | — | — | — | S01 |
| 7-07 | Rule 1: never reported → UNKNOWN (NO_DATA) | VIOLATES | `MachineStatusCalculator.cs:29-31` returns OFFLINE; test `No_sensors_or_no_readings_is_Offline` | — | P1 | S | S11 |
| 7-08 | Rule 2: no sensor within `offline_after` → OFFLINE (COMMUNICATION_LOST) | PARTIAL | `:29-31` (5 min) plus a manual "flagged offline" rule `:26-27` not in the policy | Extra rule, literal value | P1 | S | S11 |
| 7-09 | Rule order CRITICAL → WARNING → UNKNOWN (PARTIAL_DATA) → NORMAL | VIOLATES | `:56-58` puts UNKNOWN before WARNING; test `Missing_data_outranks_warning` | Order differs | P1 | S | S11 |
| 7-10 | Structured reasons (sensor, value, threshold, unit, age) and a COMPLETE/PARTIAL data-quality flag | MISSING | `:12` reasons are strings | — | P1 | M | S11 |
| 7-11 | Hysteresis (enter after 2, leave after 3 with 2 % deadband) | MISSING | No hysteresis in `MachineStatusCalculator.cs` or `AlertDetector.cs` | Single spikes change status and raise alerts | P1 | M | S11 |
| 7-12 | `machine_runtime_states` and `machine_status_history` | MISSING | No such tables (`baseline/schema.sql`) | — | P1 | M | S11 |
| 7-13 | Read-time safety: stale evaluation → UNKNOWN (EVALUATION_STALE) | MISSING | No stored evaluation (depends on 7-12) | — | P1 | S | S11 |
| 7-14 | Deactivated machines leave monitoring and KPIs; history stays | MISSING | No `is_active` on `Machine` (`Plant.cs:25-39`) | — | P1 | S | S09 |
| 7-15 | Status comes from sensor rules only (anomalies raise ANOMALY alerts) | PARTIAL | `MachineStatusCalculator.cs:54` turns an open anomaly into WARNING; test `Open_anomaly_raises_Normal_to_Warning` | Anomaly mixed into status | P1 | S | S11 |
| 7-16 | Alert categories THRESHOLD, DATA_STALE, COMMUNICATION_LOSS, ANOMALY | PARTIAL | `AlertDetector.cs` threshold only | Three categories missing | P1 | M | S12 |
| 7-17 | One open alert per machine + sensor + category, enforced by a partial unique index `NULLS NOT DISTINCT` | PARTIAL | `AlertDetector.cs:13-16` keyed by severity; `TileTwinDbContext.cs:96-101` non-unique index | Not enforced in the database; key includes severity | P1 | S | S12 |
| 7-18 | A repeat updates the open alert (occurrence count, last observed, worst value) | MISSING | No such fields on `Alert` | — | P1 | S | S12 |
| 7-19 | Escalation: the same alert goes WARNING → CRITICAL with an ESCALATED event | VIOLATES | Test `Escalation_to_critical_opens_a_separate_critical_alert`; probe §9: HP-002 has separate open Warning and Critical alerts for the same sensor | Second alert instead of escalation | P1 | S | S12 |
| 7-20 | No DATA_STALE alerts while a machine is OFFLINE | MISSING | DATA_STALE not implemented | — | P1 | S | S12 |
| 7-21 | Lifecycle NEW → ACKNOWLEDGED → RESOLVED; any other transition 409 | PARTIAL | `AlertService.cs:31-36` allows Open → Resolved directly | Acknowledge step can be skipped | P1 | S | S12 |
| 7-22 | Acknowledging records user, time and optional note | CONFORMS | `AlertService.cs:42-49`; test `Acknowledge_and_resolve_enforce_roles_and_record_history` | — | — | — | — |
| 7-23 | Resolving requires a resolution category and notes of at least 10 characters | MISSING | `AlertActionRequest` has an optional comment only | — | P1 | S | S12 |
| 7-24 | Nothing resolves automatically; `condition_cleared_at` after 5 min clear; recurrence handling | PARTIAL | Only `AlertService` resolves (manual) | No condition-cleared or recurrence logic | P1 | M | S12 |
| 7-25 | Alert record: ALR number, category, templated title/description, unit in force, first/last observed, occurrence count, version | PARTIAL | `Alert` has value, threshold, detected time, status, severity | Most fields missing | P1 | M | S12 |
| 7-26 | Append-only `alert_events` for the full lifecycle | PARTIAL | `AlertAcknowledgements` stores status changes only (0 rows at baseline) | No CREATED/ESCALATED/CLEARED events | P1 | S | S12 |
| 7-27 | A new CRITICAL alert notifies Plant Managers and assigned engineers in-app | MISSING | No notifications | — | P2 | M | S12 |
| 7-28 | KPIs computed by the backend with `generatedAt` and data window; UI shows "as of" | PARTIAL | `/api/overview` has no `generatedAt` (probe §7); UI "as of" uses the browser fetch time | — | P1 | S | S19 |
| 7-29 | KPI set: machines by status, active alerts by severity, pending maintenance, inspection completion, CA progress, MTTA/MTTR | PARTIAL | `statusCounts`, `openAlerts` in `/api/overview` | Four KPIs missing | P2 | M | S19 |
| 7-30 | Live widgets labelled LIVE (SIMULATED); historical widgets show range and source | PARTIAL | TopBar "Live · Ns ago"; synthetic banner | No LIVE (SIMULATED) or source labels | P3 | S | S30 |

## 8. Live data simulator

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 8-01 | Runs in the Worker (never in controllers) and hands readings over via `ITelemetryIngestion` | PARTIAL | `SimulatorHostedService` in the API process (`Program.cs:113-114`), not in controllers | No Worker, no ingestion interface | P2 | M | S22 |
| 8-02 | Signal model: baseline + periodic + correlated noise + drift/spikes, quantised and clamped to physical limits | PARTIAL | `Infrastructure/Seeding/SignalModel.cs:34-57` white Gaussian noise, daily sine on °C, HP-002 drift, clamp ≥ 0 | No correlated noise, quantisation or physical limits | P1 | M | S13 |
| 8-03 | Physically coupled sensors | MISSING | — | — | P1 | M | S13 |
| 8-04 | Deterministic: same seed → identical readings; one stream per sensor; time from `TimeProvider` | VIOLATES | `SimulationEngine.cs:19` unseeded `new Random()`; `SimulatorHostedService.cs:21` `DateTime.UtcNow`; seeder is seeded (`DemoSeeder.cs:33`) | Live readings not reproducible | P1 | M | S13 |
| 8-05 | Real UTC timestamps; speed multiplier accelerates scenarios only | PARTIAL | Real UTC ✓ | No speed multiplier | P1 | S | S13 |
| 8-06 | LIVE every 5 s; deterministic, idempotent BACKFILL mode via binary COPY | PARTIAL | 5 s ✓; seed history via COPY (`ReadingWriter.cs:21-22`) ✓ | Outage back-fill is automatic and unseeded (2-08) | P1 | M | S13 |
| 8-07 | Every reading records source (LIVE/BACKFILL) and `simulation_run_id`; `simulation_runs` table | MISSING | COPY columns `ReadingWriter.cs:21-22` | No provenance | P1 | M | S10 |
| 8-08 | `simulation_fault_episodes` ground truth | MISSING | — | — | P1 | M | S13 |
| 8-09 | Control by desired state (scenario, seed, speed, running) via audited Admin API + NOTIFY + heartbeat | PARTIAL | `AlertsController.cs:51-58` pause/resume, Admin only, audited | No scenario/seed/speed, no heartbeat | P2 | M | S13 |
| 8-10 | Header shows RUNNING / STOPPED / UNREACHABLE with scenario and seed | PARTIAL | TopBar shows data age; Admin page shows Running/Paused | Not in the header | P3 | S | S30 |
| 8-11 | Production disables the simulator; startup fails if enabled without override | VIOLATES | `Program.cs:113` `Simulator:Enabled` defaults to true everywhere | — | P1 | S | S13 |
| 8-12 | Scenarios A–D scripted, deterministic and selectable; mapping documented | PARTIAL | Fixed patterns only (`SignalModel.cs`: HP-002 drift ≈ B/C, PUMP-002 sensor gap ≈ D, CONV-003 flagged offline); `DEMO-SCRIPT.md` | No Scenario A, no selection, no escalation | P1 | L | S13 |

## 9. Anomaly detection and maintenance prioritisation

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 9-01 | One IsolationForest per machine type with a fixed `random_state` | CONFORMS | `ml-service/app/model.py:66-70` | — | — | — | — |
| 9-02 | Trained only on Scenario A backfill data exported from the database | PARTIAL | `model.py:66-69` trains on `synthetic.py` windows generated inside the ML service | Not trained on exported readings | P1 | M | S14 |
| 9-03 | Features per sensor: mean, std, min, max, last, slope over a 10-min window (1-min stride), shared by training and inference | PARTIAL | `app/features.py:5` mean, std, slope over 60 one-minute samples; shared function ✓ | Missing min/max/last; window differs | P1 | S | S14 |
| 9-04 | Data-quality gate (80 %) → INSUFFICIENT_DATA; never impute | PARTIAL | `main.py:22,96-102` 45/60 (75 %), HTTP 422, non-finite values dropped, no imputation | Threshold and response shape differ | P1 | S | S14 |
| 9-05 | `raw_score = -score_samples`; percentile vs training scores; ANOMALOUS at ≥ 99th percentile | PARTIAL | `model.py:52` raw score ✓; threshold 99.5th percentile (`:29`) plus an extra \|z\| rule (`:54`); no percentile | Classification rule differs | P1 | S | S14 |
| 9-06 | Explanation: top three \|z\| features, labelled heuristic | CONFORMS | `model.py:59-63`; UI "Largest deviation … standard deviations from the training average" | — | — | — | — |
| 9-07 | Contract `POST /v1/score`, `GET /v1/models`, `GET /health` (model loaded and version) | PARTIAL | `main.py:63-113` `/predict`, `/models`, `/health`; probe §4 `/v1/models` 404 | Paths and fields differ | P2 | S | S14 |
| 9-08 | ML service requires an API key, accepts a correlation ID, internal network only | PARTIAL | Listens on 127.0.0.1 only; `main.py:83-87` `POST /train` without authentication | No API key | P0 | S | S06 |
| 9-09 | Worker scores every 1 min, 5 s timeout, circuit breaker, persists scores, raises ANOMALY alerts | PARTIAL | `AnomalyScoringService.cs:119` 5 min; `Program.cs:107` 10 s; `:78` stops after first failure; scores persisted ✓ | No ANOMALY alerts, no breaker | P1 | M | S14 |
| 9-10 | Offline training CLI from a DB export; artefacts not committed; `make train` + PowerShell | PARTIAL | `app/train.py` ✓; `.gitignore` excludes `*.joblib` ✓ | No export command, no make target | P2 | S | S14 |
| 9-11 | Model card per artefact | PARTIAL | `models/evaluation.json`, `docs/ML-EVALUATION.md` | No per-model card (seed, date range, hyperparameters) | P4 | S | S14 |
| 9-12 | No model → degraded health, 503 MODEL_UNAVAILABLE; UI "Anomaly detection unavailable" | PARTIAL | `main.py:45` trains at start; `:93-94` 404 when a type has no model; UI shows "ML service unavailable" when down ✓ | Contract differs | P2 | S | S14 |
| 9-13 | Evaluation on held-out Scenario B/C runs with fault episodes (precision, recall, F1, delay) and the synthetic-only statement | PARTIAL | `docs/ML-EVALUATION.md` precision/recall on injected anomalies, synthetic disclaimer ✓ | No F1, no detection delay, not scenario-based | P4 | M | S14 |
| 9-14 | Priority score 0–100 from the five configured components | PARTIAL | `TileTwin.Domain/Maintenance/MaintenancePrioritisation.cs:19-36` different components, uncapped, constants | Rule differs | P1 | M | S15 |
| 9-15 | Ranking shows components, data timestamps and the fixed disclaimer text | PARTIAL | Factors shown (`PrioritisationPanel.tsx`); label "Suggestion — requires review…" (`PredictiveService.cs:15`) | Disclaimer text differs; no timestamps | P1 | S | S15 |
| 9-16 | Ties break by criticality, then machine code | PARTIAL | `MaintenancePrioritisation.cs:46-47` score then id | No criticality | P1 | S | S15 |
| 9-17 | ML unavailable → anomaly components 0 and the ranking says why | PARTIAL | Anomaly points drop to 0 when no fresh score | No explanation shown | P2 | S | S15 |

## 10. Inspections, corrective actions and maintenance

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 10-01 | Inspection lifecycle DRAFT → ASSIGNED → IN_PROGRESS → COMPLETED (CANCELLED with reason); invalid → 409 | MISSING | `Entities/Operations.cs:3-11` inspection has no status | — | P1 | L | S16 |
| 10-02 | Plant Manager/Admin create inspections (zone, template, in-scope assignee, due date); assignee notified | MISSING | No create endpoint (BASELINE §7) | — | P1 | L | S16 |
| 10-03 | Checklist templates per zone (6–10 items), seeded | MISSING | — | — | P1 | M | S16 |
| 10-04 | Responses PASS/FAIL/N_A with a note; FAIL requires a finding | MISSING | — | — | P1 | M | S16 |
| 10-05 | Findings: optional machine, severity, title, description, evidence | PARTIAL | `InspectionObservation` (zone, machine, category, description, priority) ≈ finding; attachments are placeholders | No title, no real evidence upload | P1 | M | S16 |
| 10-06 | Completion only when every item has a response | MISSING | — | — | P1 | S | S16 |
| 10-07 | Deterministic summary always available | CONFORMS | `Domain/Inspections/InspectionSummaryBuilder.cs`; `POST /api/inspection/summary`; tests `Summary_cites_open_high_priority_glazing_items`, `Counts_statuses_and_lists_open_high_priority_with_codes` | — | — | — | — |
| 10-08 | Optional AI narrative stored separately with provenance and citations, labelled draft | MISSING | — | — | P2 | M | S16 |
| 10-09 | CA lifecycle OPEN → IN_PROGRESS → COMPLETED → VERIFIED; verifier may reopen | PARTIAL | `Enums.cs:17` Planned/InProgress/Done/Cancelled; no transition API | — | P1 | M | S17 |
| 10-10 | CA created from a finding with a CA number, engineer assignee and due date; assignee notified | PARTIAL | `CorrectiveAction` (`Operations.cs:55-65`) seeded only; assigned role, due date | No create API, number or user assignee | P1 | M | S17 |
| 10-11 | Completion requires notes; the completer can never verify | MISSING | — | — | P1 | S | S17 |
| 10-12 | Overdue = past due and not completed/verified | CONFORMS | Summary overdue logic; test `Overdue_counts_only_unfinished_actions_past_due` | — | — | — | — |
| 10-13 | Append-only `corrective_action_events` | MISSING | Only observation events exist (`ObservationEvents`) | — | P1 | S | S17 |
| 10-14 | Maintenance types PREVENTIVE/CORRECTIVE/CONDITION_BASED with lifecycle PLANNED → IN_PROGRESS → COMPLETED/CANCELLED | PARTIAL | `Enums.cs:9` Preventive/Corrective/Inspection; `MaintenanceRecord` is a log of completed work (`Operations.cs:67-77`) | No lifecycle | P1 | M | S18 |
| 10-15 | Links to alert/CA; pending and overdue definitions; PREVENTIVE completion resets the overdue component | MISSING | — | — | P1 | M | S18 |
| 10-16 | Every lifecycle transition audited | PARTIAL | `observation.update` audited | CA and maintenance transitions do not exist | P1 | S | S16 |

## 11. Data model

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 11-01 | Explicit EF Core configuration for every entity | PARTIAL | `Infrastructure/Data/TileTwinDbContext.cs:55-128` partial; many properties by convention | — | P2 | M | S20 |
| 11-02 | Migrations only (no EnsureCreated/EnsureDeleted) | CONFORMS | 8 migrations; `Program.cs:156`; no `EnsureCreated` outside tests (grep) | — | — | — | — |
| 11-03 | snake_case tables and columns | VIOLATES | `baseline/schema.sql` PascalCase quoted names | D5 | P2 | L | EX-01 |
| 11-04 | UUIDv7 for new rows; deterministic UUIDv5 for seeded reference data | PARTIAL | `Guid.NewGuid()` (v4) for new rows; reference data uses stable string codes | — | P2 | S | S20 |
| 11-05 | Human-readable numbers ALR-, INS-, CA-, MNT-, RPT- from sequences | PARTIAL | Observation codes `OBS-xxxxxx` derived from the GUID | Others missing; not sequence-based | P2 | M | S20 |
| 11-06 | Enums stored as text with CHECK constraints | PARTIAL | `TileTwinDbContext.cs:50-53` text ✓ | No CHECK constraints | P1 | S | S09 |
| 11-07 | `numeric(12,4)` readings/limits, `numeric(8,6)` scores, `numeric(5,2)` percentiles | VIOLATES | 13 `double precision` columns (`baseline/schema.sql`) | Floating point where exactness matters | P1 | M | S09 |
| 11-08 | `created_at/by`, `updated_at/by` on mutable tables | PARTIAL | Some `CreatedUtc`/`UpdatedUtc`; no `created_by`/`updated_by` | — | P2 | M | S20 |
| 11-09 | Foreign keys into history use RESTRICT; nothing cascades into history | CONFORMS | `TileTwinDbContext.cs:124-127`; schema: 20 RESTRICT, 6 CASCADE only on Identity tables | — | — | — | — |
| 11-10 | No hard deletes of operational records; users, machines, sensors deactivated | PARTIAL | Users disabled by lockout (`UserAdminService.cs:52-53`) | No deactivation for machines/sensors | P1 | M | S09 |
| 11-11 | Every existing table maps to a target row or has a stated purpose/removal plan | PARTIAL | Mapping in the "Table mapping" section below | Decisions D2, D8 open | P4 | S | S33 |
| 11-12 | Target tables exist (see mapping: 16 missing, e.g. refresh_tokens, permissions, runtime states, templates, notifications, simulation runs) | MISSING | `baseline/schema.sql` | — | P1 | L | S20 |
| 11-13 | Idempotent reference seeder, upsert by natural code, run with `TileTwin.Cli seed` | PARTIAL | Master data upserted on reset; seeding runs at API start if empty | No CLI | P2 | M | S21 |
| 11-14 | Demo users per role plus a second engineer and inspector with different assignments; not in Production | PARTIAL | `Program.cs:160` + `AppConfig.cs:26` (Development + password only) ✓ | No second users or assignments | P2 | S | S05 |
| 11-15 | Demo records deterministic and SYNTHETIC | CONFORMS | `DemoSeeder.cs:33` fixed seed; `DataOrigin`/`SeedBatchId`; test `Reset_preserves_user_created_rows_and_is_deterministic` | — | — | — | — |
| 11-16 | Historical telemetry from the simulator backfill, never hand-written rows | CONFORMS | Seeder generates history with `SignalModel` + COPY | — | — | — | — |
| 11-17 | Retention: readings 30 d, scores 180 d, report files 90 d (EXPIRED) | MISSING | No retention job; 1.13 M readings and growing (BASELINE §6) | — | P2 | M | S25 |
| 11-18 | Alerts, events, inspections, … never auto-deleted; archival procedure documented | PARTIAL | Never deleted automatically (only the admin demo reset of synthetic rows) | No archival procedure | P4 | S | S33 |
| 11-19 | Chart and analytics queries aggregate server-side with `date_bin`, bounded | CONFORMS | `ReadingsService.cs:29-35`; probe §8 7-day p95 217 ms | — | — | — | — |
| 11-20 | Growth-path ADR (partitioning, rollups) | MISSING | — | — | P4 | S | S33 |

## 12. Authentication, authorisation and security

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 12-01 | Passwords hashed with `PasswordHasher<T>`; minimum length 12 | CONFORMS | `Program.cs:26-33` Identity; `:28` `RequiredLength = 12` | — | — | — | — |
| 12-02 | Reject a list of common passwords | MISSING | No password validator | — | P0 | S | S03 |
| 12-03 | Same generic error for every login failure | CONFORMS | `Controllers.cs:94`; `AuthService.cs:21-28`; probe §2 `{"error":"Invalid email or password"}` | — | — | — | — |
| 12-04 | Lock after 5 failures for 15 min | PARTIAL | Probe §6: locked after 5 failures; Identity default lockout 5 min (no options in `Program.cs:26-30`) | Duration 5 min | P0 | S | S03 |
| 12-05 | Rate-limit login per IP and per account | PARTIAL | `Program.cs:93` per IP, 10/min; test `Login_is_rate_limited_per_client` | No per-account limit | P0 | S | S03 |
| 12-06 | Audit every login attempt; never log the password | CONFORMS | `AuthService.cs:48,55` (`auth.login`, `auth.login-failed`) | — | — | — | — |
| 12-07 | Access JWT 15 min, HS256 key ≥ 256 bits, `kid` header, 30 s clock skew | PARTIAL | `AuthService.cs:14` 8 h; probe §5 no `kid`; `Program.cs:38-45` default skew (5 min); key ≥ 32 chars (`AppConfig.cs:42`) ✓ | Lifetime, kid, skew | P0 | S | S03 |
| 12-08 | Claims only `sub`, roles, `jti`, `iat`, `exp`, `iss`, `aud`; no email or name | VIOLATES | `AuthService.cs:35` `name` = email; probe §5 claims include `name`, no `jti` | Personal data in the token | P0 | S | S03 |
| 12-09 | Rotating refresh tokens (hashed, reuse detection, 12 h) in an HttpOnly Secure SameSite=Strict cookie; access token in memory only | VIOLATES | No refresh endpoint; `frontend/src/auth/auth.tsx:22-25,39` session in `sessionStorage` | Token readable by scripts | P0 | M | S03 |
| 12-10 | Deactivation revokes refresh tokens; per-request active-user check (≤ 60 s cache) | MISSING | `UserAdminService.cs:52-53` lockout only; an issued token stays valid up to 8 h | Disabled users keep access | P0 | S | S03 |
| 12-11 | Logout revokes the token family | MISSING | Client-side sign-out only | — | P0 | S | S03 |
| 12-12 | Endpoints require named permissions; no role-name checks in business code | VIOLATES | Role-name attributes, e.g. `AlertsController.cs:20,23`, `InspectionController.cs:24` | — | P0 | M | S04 |
| 12-13 | No endpoint is open without authentication (Appendix B grants no anonymous access) | VIOLATES | Probe §1: anonymous 200 on `/api/machines`, `/api/alerts`, `/api/observations`, `/api/reports`, `/api/workflows/executions`, `/api/overview`, report PDF | D6 | P0 | M | S04 |
| 12-14 | Four roles: Administrator, Plant Manager, Maintenance Engineer, Inspector | PARTIAL | `Enums.cs:23-31` Viewer, Inspector, MaintenanceEngineer, Admin | D1 | P0 | M | S04 |
| 12-15 | Roles and permissions from seed data, read-only in the admin UI | PARTIAL | Roles seeded (`IdentitySeeder.SeedRolesAsync`) | No permissions | P0 | M | S04 |
| 12-16 | One `IAccessScope` scopes data; out-of-scope records → 404 | MISSING | — | — | P0 | L | S05 |
| 12-17 | The same scope for assistant, reports, notifications, SignalR and downloads | MISSING | — | — | P0 | M | S05 |
| 12-18 | Authorisation tests generated from Appendix B | MISSING | Role tests exist for some writes (`Write_endpoint_enforces_roles`) | No matrix | P0 | M | S04 |
| 12-19 | SECURITY.md recommends separating administration from operations | MISSING | No SECURITY.md | — | P4 | S | S33 |
| 12-20 | Every request validated server-side (FluentValidation); client mirror for usability | PARTIAL | DataAnnotations on DTOs (see 4-05) | — | P2 | M | S21 |
| 12-21 | Parameterised SQL only | CONFORMS | All raw SQL uses `SqlQuery<T>($"…")` (`MachineService.cs:71`, `ReadingsService.cs:29`, `AnomalyScoringService.cs:44`, `KnowledgeService.cs:134,143`); no `*Raw` APIs (grep) | — | — | — | — |
| 12-22 | Uploads: allowlist by magic bytes, ≤ 10 MB, random keys outside web root, SHA-256 recorded | PARTIAL | `TileInspectionService.cs:25-29,49-51`, `KnowledgeService.cs:30-32`, `Program.cs:72-73`; tests `Sniff_checks_magic_bytes_not_names`, `Disguised_and_oversized_files_are_rejected` | No SHA-256; no evidence upload for findings | P0 | S | S06 |
| 12-23 | Downloads through an authorised endpoint with `Content-Disposition: attachment` and `nosniff` | VIOLATES | `TileInspectionsController.cs:21-23` anonymous inline image; `InspectionController.cs:37-39` anonymous inline SVG; probe §3 no `nosniff` | — | P0 | S | S06 |
| 12-24 | `IFileScanner` hook documented as no-scan | MISSING | — | — | P2 | S | S06 |
| 12-25 | HTTPS + HSTS in Production; CSP without unsafe-inline/eval; frame-ancestors none; Referrer-Policy; Permissions-Policy | MISSING | Probe §3: all security headers absent; `Program.cs:144-148` | — | P0 | S | S06 |
| 12-26 | SPA and API on one origin; CORS with explicit origins only | PARTIAL | Same origin through the Vite proxy in development; no CORS (no cross-origin access) | No production hosting configuration (22-04) | P2 | S | S27 |
| 12-27 | Rate limits on login, refresh, assistant, report generation, uploads + a global per-user limit | PARTIAL | `Program.cs:90-93` assistant, ml, upload, login | Report generation and global limit missing | P0 | S | S06 |
| 12-28 | RFC 9457 Problem Details with a stable error code and correlation ID; no stack traces | PARTIAL | Probe §2: 404/400 are `application/problem+json` with `traceId`; login 401 and alert 409 return custom `{error}` (`Controllers.cs:94`, `AlertsController.cs:33`); no exception handler | No error codes; inconsistent | P2 | S | S23 |
| 12-29 | Secrets via user-secrets (Development) / environment or vault; `.env.example` placeholders only | PARTIAL | `Configuration/EnvFile.cs` loads a git-ignored `.env`; placeholders only; history scan 2026-10-29 found no secrets | user-secrets not used | P2 | S | S27 |
| 12-30 | Database roles: migration (DDL), application (DML, audit insert/select only), read-only export | MISSING | Single `tiletwin` owner role (`database/docker-compose.yml`) | — | P0 | M | S07 |
| 12-31 | Worker calls the ML service with an API key; the proxy never exposes it | PARTIAL | ML bound to 127.0.0.1 ✓; no API key (see 9-08) | — | P0 | S | S06 |
| 12-32 | OWASP Top 10 / ASVS checklist in SECURITY.md without compliance claims | MISSING | — | — | P4 | S | S33 |

## 13. API contract

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 13-01 | Base path `/api/v1` by route prefix | PARTIAL | All routes under `/api` (BASELINE §7) | No version; renames need deprecated aliases (23.2) | P2 | M | S23 |
| 13-02 | Resource nouns; transitions as sub-resource commands | PARTIAL | `/api/alerts/{id}/acknowledge` ✓; RPC-style `POST /api/inspection/summary`, `PUT /api/machines/{id}/state` | — | P2 | S | S23 |
| 13-03 | DTOs only, never EF entities; separate list and detail DTOs | PARTIAL | `AdminController.cs:34-36` returns `AuditLogEntry` entities; machine list/detail DTOs separate ✓ | — | P2 | S | S23 |
| 13-04 | Cursor pagination for large sets; page/size ≤ 100 for directories | PARTIAL | Hard limits only (`AlertService.cs:19-20` ≤ 200, `ReportService.cs:53-55` 100, audit ≤ 500) | No pagination | P2 | M | S23 |
| 13-05 | Allowlisted filters/sorts; unknown sort → 400 | CONFORMS | Typed enum query parameters (invalid value → 400 by model binding); no free sort parameters | — | — | — | — |
| 13-06 | Time series: `from`/`to` required, ≤ 31 days, ≤ 500 buckets with min/avg/max/count; empty bucket = nulls | PARTIAL | `ReadingsService.cs:11-16` fixed 1h/24h/7d ranges, ≤ 336 buckets, min/avg/max ✓ | No count, no empty buckets (2-07), no from/to | P2 | M | S23 |
| 13-07 | Status codes incl. 201+Location, 202 queued, 409, 429, 503 | PARTIAL | 201 (`ReportsController.cs:25`), 409, 429, 503 ✓; provider errors return 502 (`AssistantController.cs:27-41`) | — | P2 | S | S23 |
| 13-08 | Every handler async with a `CancellationToken` | PARTIAL | `AdminController.cs:17-31` user endpoints take no token | — | P2 | S | S23 |
| 13-09 | `dataClassification` on plant-data responses; `generatedAt` on snapshot/KPI responses | PARTIAL | `dataClassification` on every plant-data response (`HonestDataTests`); `generatedAt` on the overview, machine detail and predictive detail snapshots (`HonestDataTests.Snapshot_responses_say_when_they_were_generated`) (S01) | Bare-array list responses (machines, predictive list) have no `generatedAt`; it goes into the v1 list envelope | P0 | M | S23 |
| 13-10 | OpenAPI committed as `api/openapi.v1.json`; CI drift check with regenerated frontend types | PARTIAL | Generated at runtime (`/openapi/v1.json`); snapshot only in `docs/baseline/` | No committed contract, no CI | P2 | S | S23 |
| 13-11 | Endpoint map per Appendix C | PARTIAL | 44 current paths (BASELINE §7) differ from Appendix C | — | P2 | L | S23 |

## 14. Frontend, design system and screens

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 14-01 | Tokens as CSS custom properties via Tailwind `@theme`, switched by `data-theme` | CONFORMS | `frontend/src/index.css` token blocks and `@theme inline`; `src/theme.tsx` | — | — | — | — |
| 14-02 | A lint rule forbids raw colour values in components | PARTIAL | No such rule; raw hex in `Layout.tsx:28`, `FactoryScene.tsx:77,79` | — | P3 | S | S29 |
| 14-03 | One font family (Inter or IBM Plex Sans); tabular numerals with units | PARTIAL | Archivo + IBM Plex Sans + IBM Plex Mono (`index.css`); `.num` tabular ✓ | Three families | P3 | S | S29 |
| 14-04 | Type scale (page title 20/28 … KPI 24/32) | PARTIAL | Page title 26 px (`States.tsx` PageHeader); hero 40 px | — | P3 | S | S29 |
| 14-05 | 4 px grid; radii 4–8 px; no pill cards; ≤ 2 elevations | PARTIAL | Cards `rounded-xl` (12 px) | — | P3 | S | S29 |
| 14-06 | No gradients, glassmorphism or decorative motion; respect reduced motion | VIOLATES | `index.css:186,279,290-337`; reduced-motion guard present ✓ | See 3-08 | P3 | S | S29 |
| 14-07 | Dark charcoal/navy, light white-on-grey, one restrained blue | CONFORMS | Token values in `index.css` (dark canvas `#0d0f12`, light surface `#ffffff`, accent `#3460e6`/`#2350d8`) | — | — | — | — |
| 14-08 | Status = icon + text + colour; OFFLINE plug icon; UNKNOWN question mark with dashed outline | PARTIAL | `lib/status.ts:16-20` (PowerOff for Offline; badges not dashed for Unknown) | Icons/outline differ | P3 | S | S29 |
| 14-09 | WCAG AA contrast in both themes, checked by axe in CI | PARTIAL | Contrast computed during the redesign (PROGRESS, 2026-10-27) | No axe, no CI | P3 | S | S29 |
| 14-10 | Shared components (Dialog, ConfirmDialog, Toast, Tabs, Tooltip, DateRangePicker, FreshnessIndicator, Skeleton, UnavailableState, …) | PARTIAL | `components/States.tsx`, `StatusBadge.tsx`, CSS classes | Several missing; `window.confirm` used twice | P3 | M | S29 |
| 14-11 | DataTable: right-aligned numbers, sticky header, fixed rows, sort/filter/paginate, own scroll | PARTIAL | `.data-table` CSS, scroll container ✓ | No sticky header, sorting or pagination | P3 | M | S29 |
| 14-12 | Shell: sidebar, breadcrumbs, synthetic badge, simulator chip, live indicator, notifications, theme toggle, user menu | PARTIAL | `Layout.tsx`, `TopBar.tsx` | No simulator chip or notifications (alert bell only) | P3 | S | S30 |
| 14-13 | Content ≤ 1600 px, 12-column grid, never scrolls horizontally | PARTIAL | `Page` up to 1800 px; probe §UI: no overflow at 1280 px | Overflow at 375 px (14-14) | P3 | M | S30 |
| 14-14 | Tablet collapses the sidebar; mobile stays usable; twin falls back to a list | VIOLATES | Probe §UI at 375 px: 77–486 px horizontal overflow, sidebar fixed at 248 px | — | P3 | M | S30 |
| 14-15 | Theme defaults to system preference, persists, switches without reload; charts/3D use tokens | PARTIAL | `frontend/index.html:14` defaults to dark (probe with light preference → dark); persistence and tokens ✓ | No system default | P3 | S | S30 |
| 14-16 | WCAG 2.2 AA: keyboard, focus rings, skip link, landmarks, labels, aria-live | PARTIAL | Focus styles, `nav`/`main`, labelled controls, aria-live ✓; probe: no skip link | Skip link missing | P3 | S | S30 |
| 14-17 | Charts have a text/table alternative; twin has a synchronised machine list | PARTIAL | `SensorChart.tsx` table view + aria-label ✓ | No machine list in the twin | P3 | M | S30 |
| 14-18 | Confirmation for destructive actions; toasts; inline validation with Problem Details mapping | PARTIAL | `window.confirm` for reset/delete; resolving an alert has no confirmation; no toasts | — | P3 | M | S30 |
| 14-19 | Routes per section 14.6; navigation shows only permitted items | PARTIAL | `frontend/src/App.tsx` routes differ; probe: anonymous user sees 10 nav links incl. Administration | — | P3 | M | S30 |
| 14-20 | Executive dashboard widgets with "as of" and LIVE/HISTORICAL labels | PARTIAL | Status counts, alerts, latest anomaly, reject rate, recent alerts, layout ✓ | Maintenance, inspection, CA, trends, recent status changes missing | P3 | M | S31 |
| 14-21 | Machine monitoring: directory filters, detail with freshness/communication/sensor table, charts 15 min–7 d + custom, alert markers, gaps, stale banner | PARTIAL | `MonitoringPage.tsx`, `MachineDetailPage.tsx` (1h/24h/7d, limit lines ✓) | Missing ranges, markers, gaps, stale banner | P3 | M | S31 |
| 14-22 | Alerts list with filters and a detail view (timeline, condition-cleared) | PARTIAL | Alerts panel with history and role-gated actions (`AlertsList.tsx`) | No dedicated list/detail or filters | P3 | M | S31 |
| 14-23 | Maintenance: ranking with components and disclaimer, score history, model version and training date, records lifecycle | PARTIAL | `PredictivePage.tsx`, `ScoreCard.tsx` (history, model version) | No training date, no records lifecycle | P3 | M | S31 |
| 14-24 | Inspections: list/board, create, perform (checklist, findings, evidence upload), summaries, CA transitions | PARTIAL | List, detail, status/assignment update, summary ✓ | Create/perform/evidence/CA flows missing (section 10) | P3 | L | S31 |
| 14-25 | Reports: type, range, filters, generate, real status, download | PARTIAL | `ReportsPage.tsx` ✓ | No status lifecycle (synchronous) | P3 | S | S31 |
| 14-26 | Administration: users with roles/assignments, plant configuration with audited thresholds, simulator control, audit log | PARTIAL | `AdminPage.tsx` users, pause/resume, audit log ✓ | No assignments or plant configuration | P3 | M | S31 |

## 15. 3D digital twin

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 15-01 | Machine states come only from the backend | CONFORMS | `frontend/src/twin/MachineObject.tsx` uses `status` from `/api/machines` | — | — | — | — |
| 15-02 | Scene built from API data (zones, positions, rotations, types) | PARTIAL | Static `3d-assets/asset-manifest.json` (see 6-07) | — | P3 | M | S32 |
| 15-03 | One parametric placeholder per machine type | CONFORMS | `frontend/src/twin/ProceduralModels.tsx` | — | — | — | — |
| 15-04 | Placeholders labelled "Schematic representation"; no decorative objects | PARTIAL | Legend "Geometry is illustrative, not to scale." (`TwinToolbar.tsx:87`); kiln and racks are non-machine scenery | — | P3 | S | S32 |
| 15-05 | Model registry keyed by machine type asset key; lazy GLB with fallback | PARTIAL | `modelPath` per entity in the manifest; lazy GLB + fallback ✓ (`MachineObject.tsx:22-53`) | Keyed per entity, not per type | P3 | S | S32 |
| 15-06 | Orbit/zoom/pan, select by click/keyboard/list, zone fit, reset, full screen, hover and selection outline | PARTIAL | `FactoryScene.tsx`, `TwinToolbar.tsx` | No side machine list, no full screen | P3 | S | S32 |
| 15-07 | Status tint + icon-and-text label; OFFLINE/UNKNOWN desaturated with own icons | PARTIAL | `MachineObject.tsx:91-128` ring, beacon, icon label | Geometry not desaturated | P3 | S | S32 |
| 15-08 | Selection panel: code, name, zone, type, status/reasons, last communication, readings with freshness, alerts, maintenance, link | PARTIAL | `MachinePanel.tsx` | No per-reading freshness; alert count only | P3 | S | S32 |
| 15-09 | `frameloop="demand"`, shared resources, instancing, budgets, BVH, disposal; fps and memory measured | PARTIAL | `FactoryScene.tsx:70` continuous rendering; shared geometries ✓ (`MachineObject.tsx:55-57`) | Not measured; no instancing/BVH | P3 | M | S32 |
| 15-10 | WebGL unavailable or context lost → 2D schematic or list | MISSING | No WebGL detection in `frontend/src/twin/` | — | P3 | S | S32 |

## 16. AI assistant

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 16-01 | Lives in Application/Features/Assistant + Infrastructure/ExternalServices/Ai; `Assistant:Enabled`; isolated | PARTIAL | `TileTwin.Api/Assistant`, `TileTwin.Infrastructure/Llm`; no flag; see 5-05 | — | P2 | M | S26 |
| 16-02 | `IAssistantModelClient` in Application; native tool calling; typed HttpClients or a vetted SDK with ADR | PARTIAL | Native tool calling ✓; Anthropic SDK without ADR; Groq `new HttpClient` (`Program.cs:60-61`) | — | P2 | S | S26 |
| 16-03 | Provider, model, timeouts and token limits from configuration | PARTIAL | Provider/model/key ✓ (`AppConfig.cs:52-55`); timeout 90 s literal; `max_completion_tokens` 4096 literal | — | P2 | S | S26 |
| 16-04 | Tool set per section 16.2 | PARTIAL | `AssistantTools.cs:24-48` nine different tools | — | P2 | M | S26 |
| 16-05 | Tools wrap Application queries under the caller's scope, validate arguments, cap results | PARTIAL | Arguments validated (`ToolArgs.cs`), 30-row cap (`AssistantTools.cs:21`) ✓ | No scope | P0 | M | S05 |
| 16-06 | Question ≤ 1,000 characters; 10 questions per user per minute | PARTIAL | `AssistantService.cs:10` 4,000 chars; rate limit 10/min ✓ (`Program.cs:90`) | — | P2 | S | S26 |
| 16-07 | ≤ 4 tool calls per question, each validated and audited | PARTIAL | `AssistantService.cs:18` limit 6; validated ✓; audited ✓ (`:70`) | — | P2 | S | S26 |
| 16-08 | Tool results returned to the model delimited as data | CONFORMS | Native tool-result messages; system prompt marks results untrusted (`AssistantService.cs:28`) | — | — | — | — |
| 16-09 | Structured `{answer, citations[]}`; citations must appear in this request's tool results | MISSING | `AssistantService.cs:46-49` regex on free text, checked against the database | Citations not checked against tool results | P1 | M | S26 |
| 16-10 | Response: answer, tool calls, cited records as links, data timestamps | PARTIAL | `ChatResponse` (answer, tool calls, focus IDs, disclaimer) | No timestamps or record links | P2 | S | S26 |
| 16-11 | Grounding instructions (tool facts only, state data time, statistical wording, injection resistance, decline writes naming the screen) | PARTIAL | `AssistantService.cs:21-31` | Data time and "name the screen" missing | P1 | S | S26 |
| 16-12 | Provider timeout 20 s, budget 45 s, circuit breaker; failure → 503 ASSISTANT_UNAVAILABLE; answer labels with record count and time | PARTIAL | 90 s timeout, 150 s budget, 502 errors, static disclaimer | — | P2 | S | S26 |
| 16-13 | Audit question, each tool call (args, record count, duration), provider, model, outcome, correlation ID | PARTIAL | `AssistantService.cs:42,70` question, tool, args, error flag, size | Record count, duration, provider, model, correlation missing | P2 | S | S26 |

## 17. Reports

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 17-01 | Types: factory health, machine status, alerts, anomalies, maintenance, inspections, corrective actions | PARTIAL | FactoryHealth, MachineAnomalies, MaintenanceHistory, SiteInspection, MaintenancePrioritisation | Machine status, alerts, corrective actions missing | P3 | M | S31 |
| 17-02 | `POST /reports` → 202 QUEUED; Worker claims with SKIP LOCKED; COMPLETED/FAILED with error code; requester notified | MISSING | `ReportsController.cs:18-25` synchronous 201 | — | P2 | M | S22 |
| 17-03 | Built only from records the requester may see | PARTIAL | Built from database records (`ReportBuilder.cs`) | No scope | P0 | M | S05 |
| 17-04 | Only the requester or an Administrator downloads; endpoint re-checks authorisation | VIOLATES | `ReportsController.cs:27-33` anonymous; probe §1 PDF 200 without a token | — | P0 | S | S06 |
| 17-05 | Content: number, UTC + plant time, requester, scope note, label in header and footer, KPIs, tables, vector charts, Page X of Y, matching fonts, source note, anomaly disclaimer | PARTIAL | `PdfRenderer.cs:23-61` title, period, filters, header label, tables, page X / Y ✓; `ReportBuilder.cs:95` disclaimer ✓ | No number, plant time, requester, scope note, footer label, charts or matching fonts | P1 | M | S08 |
| 17-06 | Output depends only on DB state and parameters; tests assert extracted PDF text | PARTIAL | Stored document re-rendered (`ReportService.cs:44`) ✓; tests assert the document model, not PDF text | — | P2 | S | S31 |
| 17-07 | PDF library chosen under the licence findings | PARTIAL | See 4-16 (D3) | — | P0 | M | S08 |

## 18. Performance, reliability and degraded modes

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 18-01 | Plant snapshot p95 ≤ 200 ms | CONFORMS | Probe §8: `/api/machines` p95 36 ms, `/api/overview` p95 48 ms (n = 20, localhost; no dedicated snapshot endpoint yet) | — | — | — | — |
| 18-02 | 7-day sensor chart p95 ≤ 300 ms | CONFORMS | Probe §8: p95 217 ms | — | — | — | — |
| 18-03 | Dashboard first meaningful render ≤ 2 s on a laptop | PARTIAL | Not measured (dev server only) | Measurement missing | P2 | S | S28 |
| 18-04 | 3D twin ≥ 50 fps while orbiting | PARTIAL | Not measured | Measurement missing | P3 | S | S32 |
| 18-05 | No unbounded queries; lists paginated; series bounded | PARTIAL | Lists capped with `Take`; series bounded | No pagination (13-04) | P2 | S | S25 |
| 18-06 | Short server cache for snapshot/KPIs invalidated on change; tuned `staleTime`; hashed static assets | PARTIAL | Vite hashed assets ✓; 7 s polling | No server cache, no per-resource tuning | P2 | S | S25 |
| 18-07 | Outbound HTTP with timeouts, jittered retries (idempotent only) and circuit breakers | PARTIAL | Timeouts `Program.cs:61,70,107` ✓ | No retries or breakers | P2 | S | S25 |
| 18-08 | ML down → "Anomaly detection unavailable since <time>"; priorities drop anomaly parts and say so | PARTIAL | UI "ML service unavailable" ✓ | No "since"; silent drop in priorities | P2 | S | S25 |
| 18-09 | AI down → assistant unavailable; nothing else changes | CONFORMS | `AssistantController.cs:21-41`; workflow deterministic fallback | — | — | — | — |
| 18-10 | Report failure → FAILED with reason, retry, logged | MISSING | Synchronous generation, no status | — | P2 | S | S22 |
| 18-11 | Machine stops communicating → UNKNOWN, then OFFLINE with a COMMUNICATION_LOSS alert | PARTIAL | OFFLINE after 5 min (`MachineStatusCalculator.cs:29-31`) | No UNKNOWN stage, no alert | P1 | S | S11 |
| 18-12 | Simulator stopped → header STOPPED; machines follow the normal policy | PARTIAL | Pause → no readings → OFFLINE after 5 min ✓ | No STOPPED in the header | P2 | S | S22 |
| 18-13 | Worker down → "Monitoring engine unavailable" banner; EVALUATION_STALE | MISSING | No Worker (API down → "Backend API unreachable") | — | P2 | M | S22 |
| 18-14 | SignalR disconnected → polling fallback with indicator | PARTIAL | Always polling; "Connection lost" indicator | Depends on 5-06 | P2 | S | S22 |
| 18-15 | Database unavailable → readiness fails; UI error with retry; no partial writes | PARTIAL | `/api/health` reports "degraded" (`Controllers.cs:16-31`); UI `ErrorState` with Retry ✓; transactional writes ✓ | No readiness endpoint (probe §4) | P2 | S | S24 |

## 19. Observability and audit

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 19-01 | Serilog JSON logs (console + rolling files) with service, environment, correlation, user ID, machine; ML JSON logs | MISSING | Default logging; ML has none | — | P2 | M | S24 |
| 19-02 | Accept/create `X-Correlation-ID`; pass to ML, AI and Worker; return in Problem Details; show "Reference: …" in UI errors | MISSING | Probe §2-3: no header; `traceId` in Problem Details only | — | P2 | M | S24 |
| 19-03 | Log API errors, auth failures/lockouts, business operations, job failures, simulator changes, ML failures, tool calls, report failures | PARTIAL | Simulator/scoring failures (`SimulatorHostedService.cs`, `AnomalyScoringService.cs:138`), ML unavailable (`MlClient.cs`), LLM errors (`AssistantController.cs`), alerts opened (`SimulationEngine.cs:74-75`) | Auth failures only in audit; report failures not logged | P2 | S | S24 |
| 19-04 | Never log passwords, tokens, keys or unneeded personal data | CONFORMS | `AppConfig.cs:62-72` logs provider names and URLs only; LLM errors log messages only; login audit stores no password | — | — | — | — |
| 19-05 | `audit_logs`: actor type, action, entity type and ID, time, outcome, correlation ID, sanitised context | PARTIAL | `AuditLogEntry` (`Operations.cs:92-100`): user, action, entity ID, time, details | No actor type, entity type, outcome, correlation | P2 | S | S24 |
| 19-06 | Audit coverage (logins/lockouts, users, config/thresholds, simulator, alerts, workflow transitions, evidence up/downloads, reports, assistant, denials) | PARTIAL | Audited: auth.login(-failed), user.*, simulator.*, alert.*, observation.update, report.create, tile.upload, document.*, assistant.*, workflow.*, demo.reset, machine.update-state | Lockouts, downloads, denials, thresholds missing | P2 | S | S24 |
| 19-07 | `/health/live`, `/health/ready` (DB + migrations); ML/AI as degraded; Worker heartbeat; ML health with model and version | PARTIAL | Only `/api/health` (probe §4: live/ready 404); ML `/health` lists loaded models ✓ | — | P2 | S | S24 |

## 20. Testing strategy

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 20-01 | `docs/TESTING.md` maps acceptance criteria to tests | MISSING | — | — | P4 | M | S33 |
| 20-02 | Baseline tests keep passing | CONFORMS | BASELINE §5: backend 85, frontend 17, ML 16, smoke 20/20 | — | — | — | — |
| 20-03 | Table-driven status tests incl. hysteresis and stale/offline timing with `FakeTimeProvider` | PARTIAL | `Tests/Domain/MachineStatusCalculatorTests.cs` (12 facts, explicit timestamps) | Not table-driven; no hysteresis; no FakeTimeProvider | P1 | S | S11 |
| 20-04 | Alert tests: dedup, escalation, suppression, condition cleared, recurrence, no auto-resolve, guards | PARTIAL | `AlertDetectorTests.cs`; `Acknowledge_and_resolve_enforce_roles_and_record_history` | Policy features missing | P1 | M | S12 |
| 20-05 | Inspection/CA transition guards incl. "cannot verify own completion" | MISSING | No lifecycle (section 10) | — | P1 | M | S16 |
| 20-06 | Priority, KPI and simulator determinism tests | PARTIAL | `PrioritisationTests.cs` (5); `Reset_preserves_user_created_rows_and_is_deterministic` | No live-simulator determinism or KPI tests | P1 | S | S13 |
| 20-07 | Integration tests on real PostgreSQL via Testcontainers; never in-memory | PARTIAL | Real Postgres DB `tiletwin_test` (`ApiFactory.cs:30-32`) ✓; not Testcontainers | — | P2 | S | S27 |
| 20-08 | Migrations on empty DB, seeder idempotent, constraints under concurrency, RESTRICT, xmin 409, ingestion idempotency, retention, keyset pagination | PARTIAL | `DemoSeederTests.cs` ✓ | Most cases missing | P1 | M | S20 |
| 20-09 | API tests: login, lockout, refresh rotation/reuse, deactivated users, role matrix, scope leaks, Problem Details, report auth, upload rejection | PARTIAL | `Login_with_wrong_password_is_rejected`, `Login_is_rate_limited_per_client`, `Admin_creates_user_who_can_sign_in_then_disables_them`, `Disguised_and_oversized_files_are_rejected`, `Creating_a_report_requires_sign_in` | Lockout, refresh, matrix, scope, download auth missing | P0 | M | S04 |
| 20-10 | Architecture tests | MISSING | See 5-12 | — | P2 | S | S21 |
| 20-11 | Frontend: both themes, validation, states, permission nav, theme persistence, stale never NORMAL, chart gaps, server values, twin selection | PARTIAL | 17 tests in 9 files (e.g. `shell.test.tsx`, `monitoring.test.tsx`, `predictive.test.tsx`) | Themes, permissions, gaps, persistence missing | P2 | M | S28 |
| 20-12 | ML tests incl. corrupt/missing model, 503, contract test against the backend client | PARTIAL | `ml-service/tests` 16 tests (`test_ml.py`, `test_tile.py`, `test_health.py`) | No 503 or contract test | P2 | M | S14 |
| 20-13 | Playwright E2E (20 flows) on the compose stack + axe in both themes | PARTIAL | `scripts/smoke.py` 20 API-level checks (Scenarios A–D) | No Playwright, no axe | P2 | L | S28 |
| 20-14 | CI: build, lint (ESLint, .NET analyzers as errors, ruff, mypy), suites, OpenAPI drift, vulnerability and licence checks | MISSING | No `.github/workflows` | — | P2 | M | S28 |

## 21. Documentation and decisions

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 21-01 | Twelve documents (README, ARCHITECTURE, DATABASE_DESIGN, API_DOCUMENTATION, SECURITY, DEPLOYMENT, CONFIGURATION, SIMULATOR_DOCUMENTATION, ML_DOCUMENTATION, TESTING, TROUBLESHOOTING, CHANGELOG) | PARTIAL | README, ARCHITECTURE, TROUBLESHOOTING present; ML-EVALUATION ≈ ML_DOCUMENTATION | 9 missing | P4 | M | S33 |
| 21-02 | `docs/adr/`, DEPENDENCIES, ASSUMPTIONS, PROGRESS, DEMO_SCRIPT | PARTIAL | PROGRESS ✓, `DEMO-SCRIPT.md` ✓ (name differs) | adr, DEPENDENCIES, ASSUMPTIONS missing | P4 | M | S33 |
| 21-03 | BASELINE, CONFORMANCE_REPORT, REMEDIATION_PLAN, EXCEPTIONS | PARTIAL | BASELINE ✓, this report ✓ | Plan and exceptions come in Phase 4 | P4 | S | S33 |
| 21-04 | Docs cover prerequisites … deploy … troubleshooting, incl. migrate/seed/backfill/train commands | PARTIAL | README prerequisites, setup, run, tests ✓ | Deploy, seed/backfill CLI missing | P4 | S | S33 |
| 21-05 | README ends with a Limitations section | PARTIAL | Limitations live in PROGRESS and REAL-WORLD-READINESS | — | P4 | S | S33 |
| 21-06 | Mermaid architecture and entity diagrams | MISSING | 0 Mermaid blocks in README/ARCHITECTURE | — | P4 | S | S33 |
| 21-07 | The 15 listed ADRs | MISSING | — | — | P4 | M | S33 |
| 21-08 | Conventional Commits; .gitignore; never commit secrets, builds, models, uploads, reports | PARTIAL | `.gitignore` covers `.env`, bin/obj, node_modules, .venv, `*.joblib`, App_Data ✓; no secrets in history ✓ | Commits before `6f639e6` not Conventional | P4 | S | S33 |

## 22. Deployment and environments

| ID | Requirement | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| 22-01 | Runs on a laptop with Docker Compose and in enterprise Windows; no cloud dependency | PARTIAL | Compose runs Postgres only; services started by hand (BASELINE K9); no cloud dependency ✓ | — | P2 | M | S27 |
| 22-02 | Development/Testing/Demonstration/Production settings; `ValidateOnStart` fail-fast | PARTIAL | `appsettings.json` + `appsettings.Development.json`; `AppConfig.cs:35-46` validates two settings | — | P2 | S | S27 |
| 22-03 | Feature flags off by default in Production (Simulator, Assistant, API explorer, demo seeding) | VIOLATES | `Program.cs:113` simulator on, `:124-129` Swagger always, `:163` demo seed always, no Assistant flag | — | P1 | S | S27 |
| 22-04 | Compose with Postgres, API, Worker, ML and a web container, one command; seed/backfill/train documented (shell + PowerShell) | PARTIAL | `database/docker-compose.yml` Postgres only; README PowerShell steps ✓ | — | P2 | M | S27 |
| 22-05 | Enterprise Windows deployment (IIS, Windows services, TLS) | MISSING | No DEPLOYMENT.md | — | P4 | M | S33 |
| 22-06 | Migrations as an explicit step (bundle, migration role, backup first); no auto-migrate in Production | VIOLATES | `Program.cs:156` `MigrateAsync` on every start, no flag | — | P1 | S | S27 |
| 22-07 | Backup and recovery (pg_dump schedule, tested restore, evidence backups) | MISSING | — | — | P4 | S | S33 |
| 22-08 | Every external dependency documented; AI the only optional internet dependency | PARTIAL | No cloud dependency ✓; AI optional ✓ | Not documented (DEPENDENCIES missing) | P4 | S | S33 |

## Appendix B. Permission matrix

Current reality: read endpoints are anonymous; writes use the roles `Viewer`, `Inspector`, `MaintenanceEngineer`, `Admin`; there is no data scoping.

| ID | Capability (target) | Status | Evidence | Gap | Priority | Effort | Slice |
|---|---|---|---|---|---|---|---|
| B-01 | Plant overview, dashboard and twin at status level — all roles | PARTIAL | Probe §1: also open to anonymous users | Anonymous access | P0 | S | S04 |
| B-02 | Machine detail, readings, history — Admin/PM all; ME/Inspector assigned | VIOLATES | Probe §1: anonymous 200 on `/api/machines` | No authentication or scope | P0 | M | S05 |
| B-03 | Manage plants, zones, machines, sensors, thresholds — Administrator only | PARTIAL | Only `PUT /api/machines/{id}/state` (MaintenanceEngineer, Admin — `Controllers.cs:84`) | ME may change machine state; no threshold management | P1 | M | S09 |
| B-04 | View alerts — Admin/PM all; ME/Inspector assigned | VIOLATES | Probe §1: anonymous 200 on `/api/alerts` | — | P0 | M | S04 |
| B-05 | Acknowledge and resolve alerts — Admin/PM all; ME assigned; Inspector none | VIOLATES | `AlertsController.cs:20` Inspector may acknowledge | — | P0 | S | S04 |
| B-06 | Anomaly scores and ranking — Admin/PM all; ME assigned; Inspector none | VIOLATES | `/api/predictive` anonymous; any signed-in user can score (`PredictiveController.cs:21`) | — | P0 | S | S04 |
| B-07 | View maintenance records — Admin/PM all; ME assigned; Inspector none | VIOLATES | Machine detail (with maintenance) is anonymous | — | P0 | S | S04 |
| B-08 | Create and update maintenance records — Admin; ME assigned | MISSING | No endpoint | — | P1 | M | S18 |
| B-09 | Create, assign, cancel inspections — Admin, PM | PARTIAL | Observation assignment by Inspector/Admin (`InspectionController.cs:24`); no create | — | P1 | M | S16 |
| B-10 | Perform inspections, findings, evidence — Admin; Inspector own assignments | PARTIAL | Observation status updates by Inspector/Admin; no perform flow | — | P1 | M | S16 |
| B-11 | Create corrective actions from findings — Admin, PM; Inspector own findings | MISSING | — | — | P1 | M | S17 |
| B-12 | Start and complete corrective actions — Admin; ME assigned to them | MISSING | — | — | P1 | M | S17 |
| B-13 | Verify corrective actions — Admin, PM; Inspector ones raised unless completed | MISSING | — | — | P1 | M | S17 |
| B-14 | View inspections and corrective actions — Admin/PM all; ME linked; Inspector assigned zones | VIOLATES | Probe §1: anonymous 200 on `/api/observations` | — | P0 | M | S04 |
| B-15 | Generate and download reports — all roles within scope | VIOLATES | Generation needs sign-in ✓; download anonymous (17-04) | — | P0 | S | S04 |
| B-16 | Use the AI assistant — all roles within scope | PARTIAL | Any signed-in user (`AssistantController.cs`) ✓; no scope | — | P0 | M | S05 |
| B-17 | Manage users, role assignments and data scope — Administrator | PARTIAL | `AdminController.cs:14` Admin only ✓ | No scope assignments | P1 | M | S05 |
| B-18 | Control the simulator — Administrator | CONFORMS | `AlertsController.cs:51` `PUT /api/admin/simulator` Admin only, audited | — | — | — | — |
| B-19 | View the audit log — Administrator | CONFORMS | `AdminController.cs:14,34-36` Admin only | — | — | — | — |

## Table mapping (section 11.2)

| Existing table | Target table | Notes |
|---|---|---|
| AspNetUsers | users | Lockout and security stamp ✓; `is_active` via lockout; email unique ✓ |
| AspNetRoles, AspNetUserRoles | roles, user_roles | ✓ (role names: D1) |
| AspNetUserClaims, AspNetUserLogins, AspNetUserTokens, AspNetRoleClaims | — | ASP.NET Core Identity internals (0 rows); purpose: Identity framework |
| Sites | plants | No time zone or classification |
| Zones | zones | No process sequence or floor-plan rectangle (rectangle is in the asset manifest) |
| MachineTypes | machine_types | No asset key or preventive interval |
| Machines | machines | No criticality, position/rotation (manifest) or `is_active` |
| SensorDefinitions | sensors | See 6-04, 6-05 |
| SensorReadings | sensor_readings | PK, numeric value, source, run id missing (5-21, 11-07, 8-07) |
| Alerts | alerts | See 7-16 … 7-25 |
| AlertAcknowledgements | alert_events | Status changes only (7-26) |
| AnomalyScores | anomaly_scores | No percentile or status |
| MlModels | — | Mirror of the ML `/models` registry; purpose: model metadata for the UI (`GET /anomaly-models` in Appendix C). Keep with ADR |
| Inspections | inspections | No lifecycle (10-01) |
| InspectionObservations | inspection_findings | ≈ findings |
| ObservationAttachments | evidence_attachments | Placeholders only; no storage key or SHA-256 |
| ObservationEvents | — | Finding history; purpose: inspection audit trail. Keep with ADR |
| CorrectiveActions | corrective_actions | See 10-09 … 10-13 |
| MaintenanceRecords | maintenance_records | Completed-work log, no lifecycle (10-14) |
| ProductionBatches | — | Production quality KPI and reports; decision D8 |
| Reports | report_records | No number, file key, checksum or status |
| WorkflowExecutions | — | Prioritisation workflow runs (original brief); purpose: workflow audit and outputs. Keep with ADR |
| TileInspections | — | Tile Quality module outside the target scope; decision D2 |
| Documents, DocumentChunks | — | Knowledge Centre outside the target scope; pgvector column; decision D2 |
| AuditLog | audit_logs | See 19-05 |
| DemoState | simulator_configurations | Paused flag and seed anchor only |
| `__EFMigrationsHistory` | — | EF Core migrations bookkeeping |
| — | refresh_tokens, permissions, role_permissions, user_zone_assignments, user_machine_assignments, sensor_runtime_states, machine_runtime_states, machine_status_history, inspection_templates, inspection_template_items, inspection_checklist_responses, corrective_action_events, inspection_ai_summaries, notifications, simulation_runs, simulation_fault_episodes | Missing (11-12) |

## Not measured in this audit

- Accessibility scan with axe (no axe tooling yet; Phase 3/7 adds it). Contrast was computed during the 2026-10-27 redesign.
- Dashboard render time and 3D frame rate (18-03, 18-04): need a scripted browser measurement on a typical laptop.
- Behaviour under a stopped database or ML service was not re-tested in this audit; rows rely on code reading and the
  existing tests named in the evidence column.
