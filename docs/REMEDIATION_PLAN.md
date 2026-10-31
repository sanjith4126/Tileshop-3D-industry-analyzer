# Remediation plan (Phase 4 of `docs/MASTER_PROMPT.md`)

Written 2026-10-31 from [`CONFORMANCE_REPORT.md`](CONFORMANCE_REPORT.md) (352 rows, 295 open). Every open row is assigned
to exactly one slice below, or to an exception; the assignment is machine-checked by `python scripts/assign_slices.py`,
which also writes the slice ID into the report's Slice column.

## Approval and owner decisions

On 2026-10-30 the owner replied to the Phase 2 report: *"do everything all the phases once you complete everything let
me know"*. This plan treats that as approval of the plan (Phase 4 gate) and of the recommendations given for
decisions D1–D8. Decision D2 was left to the owner; the conservative choice is taken (keep the features, document them)
because removing a feature needs explicit approval. Every decision is listed again in the final report for confirmation.

| # | Decision | Taken |
|---|---|---|
| D1 | Roles | Rename `Viewer` → `PlantManager` and `Admin` → `Administrator` in a migration; permissions per Appendix B |
| D2 | Tile Quality and Knowledge Centre | **Keep** both, with ADRs that record their purpose; their dependencies (pgvector, ONNX Runtime, PdfPig) are justified there |
| D3 | PDF library | Migrate from QuestPDF to PDFsharp/MigraDoc (MIT) |
| D4 | Plant model | Keep the existing codes (`MACHINE-HP-002`, `ZONE-PRESS-A`, …); map Scenarios A–D onto them |
| D5 | Database naming | Keep PascalCase names; exception EX-01 (`EXCEPTIONS.md`) |
| D6 | Anonymous access | Require authentication on every endpoint; keep the demo-account buttons in the sign-in dialog |
| D7 | Worker process | Split simulator, evaluation, scoring, reports and retention into `TileTwin.Worker`, with NOTIFY → SignalR |
| D8 | Production batches | Keep the table with an ADR; show "no data" for empty windows |

## How every slice is executed

- Order: P0 → P4; inside a priority, the brief's dependency order. Each slice is one or more small commits on `main`
  that keep the build and all tests green (Conventional Commits naming the row IDs).
- Before a behaviour change, the existing characterization tests pin today's behaviour; a deliberate change updates
  those tests in the same commit and adds a CHANGELOG entry (before → after).
- Schema changes: additive migration first, data move, code switch, then removal in a later migration. Before any
  migration that rewrites data: `pg_dump` backup of the development database and a restore check into a scratch
  database; row counts recorded in `PROGRESS.md`.
- Renamed or reshaped endpoints keep the old route as a deprecated alias (header `Deprecation: true`) until the next
  release after delivery.
- After each slice: affected conformance rows updated with evidence, `PROGRESS.md` updated, CI green.

## Slices

Size: S < ½ day, M ≤ 2 days, L more. Rows are conformance-report IDs.

### P0 — data honesty, security, licences

| Slice | Rows | Approach | Migration / rollback | Tests | Size |
|---|---|---|---|---|---|
| **S01** Honest data ✅ 2026-10-31 | 2-01, 2-02, 2-03, 2-07, 2-08, 2-11, 7-06 (13-09 started; `generatedAt` on list responses moved to S23) | Readings API returns every bucket with a count (empty bucket = nulls); charts break and shade gaps (`connectNulls` off). The live simulator stops back-filling outages (explicit BACKFILL only). Empty production window → `null` KPI and "no records" in the UI. `dataClassification` on plant-data responses; "SYNTHETIC DEMO DATA" wording on banner, badges, charts and the PDF footer. | No schema change; revert commit restores behaviour | Update backfill tests (now: no back-fill); readings gap test; overview null KPI test; UI gap test | M |
| **S02** Read-only assistant | 2-15 | Remove `create_report_draft`; prompt says it cannot change records and names the Reports screen | None | Tool list test; assistant test asserts no write tool | S |
| **S03** Authentication | 12-02, 12-04, 12-05, 12-07, 12-08, 12-09, 12-10, 12-11 | 15-min access JWT with `sub`, roles, `jti`, `iat`, `exp`, `iss`, `aud`, `kid`; 30 s skew; rotating hashed refresh tokens in an HttpOnly SameSite=Strict cookie (`/api/v1/auth`), family reuse detection, logout, per-request active-user check (60 s cache); lockout 15 min; common-password validator; per-account login limiter; SPA keeps the access token in memory with single-flight refresh | Additive table `RefreshTokens`; rollback = revert (old tokens simply expire) | Login, lockout, refresh rotation and reuse, logout, deactivated user, token claims | M |
| **S04** Authorisation | 4-04, 12-12, 12-13, 12-14, 12-15, 12-18, B-01, B-04 … B-07, B-14, B-15, 20-09 | Roles renamed (D1); `Permissions` + `RolePermissions` seeded by migration from Appendix B; permission policies (`perm:alerts.acknowledge`, …); every endpoint authenticated; SPA navigation filtered by permission | Migration renames roles and seeds permissions; rollback migration restores names | Endpoint × role matrix generated from Appendix B; anonymous 401 everywhere | M |
| **S05** Data scope | 12-16, 12-17, 2-17, 16-05, 17-03, B-02, B-16, B-17, 11-14 | `UserZoneAssignments`, `UserMachineAssignments`; one `IAccessScope` applied in queries (machines, readings, alerts, inspections, maintenance, reports, assistant tools, downloads); out-of-scope → 404; demo users incl. a second engineer and inspector | Additive tables; rollback = revert | Scope-leak tests (404), assistant tool scope, report scope | M |
| **S06** HTTP security | 12-22, 12-23, 12-24, 12-25, 12-27, 9-08, 12-31, 17-04 | Security headers + CSP; HSTS/HTTPS in Production; authorised downloads with `attachment` + `nosniff`; SHA-256 on uploads; `IFileScanner` no-scan hook; rate limits for reports and a global per-user limit; ML service API key | Additive column `Sha256`; rollback = revert | Header test, download auth/headers test, rate-limit test, ML key test (pytest) | M |
| **S07** Database roles | 12-30 | Init script and migration create `tiletwin_migrator` (DDL), `tiletwin_app` (DML; INSERT/SELECT only on audit log), `tiletwin_readonly`; the API and Worker use the app role, migrations use the migrator | Grants are additive; rollback = connect as owner | Integration test: app role cannot UPDATE/DELETE audit rows | M |
| **S08** PDF licence | 4-16, 17-07, 17-05 | Replace QuestPDF with PDFsharp/MigraDoc (MIT); embedded IBM Plex Sans fonts; report number, UTC + plant time, requester, scope note, label in header and footer, vector charts, Page X of Y, fixed source note | No schema change (report number added in S20) | PDF text extracted with PdfPig and asserted | M |

### P1 — policy correctness, data integrity, backend authority

| Slice | Rows | Approach | Migration / rollback | Tests | Size |
|---|---|---|---|---|---|
| **S09** Plant model | 6-04, 6-05, 6-06, 6-08, 7-14, 11-06, 11-07, 11-10, B-03 | Sites gain time zone + classification; sensors gain key, resolution, expected interval, physical limits, required flag, numeric(12,4) bands with ordering CHECK; machines gain criticality, `IsActive`; enum CHECK constraints; Administrator-only plant configuration with audited threshold changes | Additive columns with backfilled values, then type changes `double` → `numeric`; backup first | Constraint tests; threshold change audited | M |
| **S10** Telemetry ingestion | 5-21, 8-07 | `ITelemetryIngestion`; readings keyed (SensorId, TimestampUtc), numeric(12,4) value, `Source`, `SimulationRunId`; duplicates ignored; BRIN index | Data-rewriting migration (PK change, type change) after backup; duplicate rows removed first; rollback by restore | Idempotent ingestion test | M |
| **S11** Status policy | 7-01 … 7-05, 7-07 … 7-13, 7-15, 3-05, 18-11, 20-03 | Configured freshness (`stale_after`, `offline_after`), rule order of §7.2, structured reasons + data quality, hysteresis, `MachineRuntimeStates` + `MachineStatusHistory`, read-time EVALUATION_STALE, anomalies removed from status | Additive tables; rollback = revert | Table-driven policy tests with `FakeTimeProvider` | L |
| **S12** Alert engine | 7-16 … 7-21, 7-23 … 7-27, 20-04 | Categories THRESHOLD, DATA_STALE, COMMUNICATION_LOSS, ANOMALY; partial unique index `NULLS NOT DISTINCT`; occurrence counts; escalation; suppression; NEW → ACKNOWLEDGED → RESOLVED with resolution category and notes; condition cleared; `ALR-` numbers; `AlertEvents`; notifications for CRITICAL | Additive columns/tables; existing alerts migrated (status Open → New); backup first | Policy tests for every rule; lifecycle API tests | L |
| **S13** Simulator | 8-02 … 8-06, 8-08, 8-09, 8-11, 8-12, 20-06 | Per-sensor seeded streams, OU noise, coupling, quantisation, physical clamps; Scenarios A–D on the existing codes (D4); speed multiplier; `SimulationRuns`, `SimulationFaultEpisodes`, desired-state `SimulatorConfigurations`, heartbeat; disabled in Production | Additive tables; rollback = revert | Determinism and scenario tests | L |
| **S14** ML service contract | 9-02 … 9-05, 9-07, 9-09 … 9-13, 5-25, 3-09, 20-12 | `/v1/score`, `/v1/models`, `/health`; 10-min windows of raw readings, mean/std/min/max/last/slope; 80 % gate → INSUFFICIENT_DATA; percentile; training from `export-training-data` (Scenario A); model cards; evaluation on Scenario B/C fault episodes; injectable clock; ANOMALY alerts from the Worker | Model artefacts regenerated (not committed) | pytest contract, gate, 503, determinism; backend contract test | L |
| **S15** Prioritisation | 9-14 … 9-17 | §9.3 components and configured weights, 0–100 cap, criticality tie-break, fixed disclaimer, timestamps, "ML unavailable" note | None | Table-driven scoring tests | M |
| **S16** Inspections | 10-01 … 10-06, 10-08, 10-16, B-09, B-10, 20-05 | Templates and items (seeded per zone), lifecycle DRAFT → … → COMPLETED/CANCELLED, assignment, checklist responses, findings with evidence uploads, completion guard, AI-assisted summary stored separately; existing observations become findings | Additive tables; observation data mapped; backup first | Lifecycle guards, permission and scope tests | L |
| **S17** Corrective actions | 10-09 … 10-11, 10-13, B-11 … B-13 | OPEN → IN_PROGRESS → COMPLETED → VERIFIED (reopen with reason), `CA-` numbers, user assignee, notes on completion, completer ≠ verifier, `CorrectiveActionEvents` | Status values migrated (Planned → Open, Done → Completed) | Lifecycle and self-verification tests | M |
| **S18** Maintenance records | 10-14, 10-15, B-08 | PREVENTIVE/CORRECTIVE/CONDITION_BASED with PLANNED → IN_PROGRESS → COMPLETED/CANCELLED, links to alert/CA, pending/overdue, preventive interval | Existing records become COMPLETED; type `Inspection` → `ConditionBased` | Lifecycle tests | M |
| **S19** KPIs | 7-28, 7-29, 2-09 | Domain KPI calculators (status counts, alerts by severity, pending/overdue maintenance, inspection completion, CA progress, MTTA/MTTR) with `generatedAt` and window; UI shows server values only | None | KPI tests | M |
| **S20** Data-model hygiene | 5-20, 11-04, 11-05, 11-08, 11-01, 11-12, 20-08 | `xmin` concurrency → 409; UUIDv7 for new rows; sequences for `ALR-/INS-/CA-/MNT-/RPT-`; `CreatedBy/UpdatedBy`; explicit configurations per entity; remaining target tables | Additive; backup first | Concurrency, sequence and constraint integration tests | M |

### P2 — architecture, API contract, observability, performance, degraded modes

| Slice | Rows | Approach | Migration / rollback | Tests | Size |
|---|---|---|---|---|---|
| **S21** Application layer | 5-24, 11-13, 3-01, 3-02, 5-04, 5-07, 5-09 … 5-12, 3-10, 4-05, 12-20, 20-10 | New `TileTwin.Application` (use cases, DTOs, validators, interfaces incl. `IApplicationDbContext`, `IAccessScope`, `IAuditLog`, …); services moved with `git mv`; thin controllers; small pipeline (validation, audit, transaction); `TileTwin.Cli` (migrate, seed, backfill, export-training-data); `TimeProvider` everywhere; FluentValidation | No schema change | Architecture rules pass (blocking in Phase 7) | L |
| **S22** Worker and real-time | 5-01, 5-06, 5-19, 4-08, 8-01, 18-12 … 18-14, 17-02, 18-10 | `TileTwin.Worker` hosts simulator, evaluation/watchdog, scoring, reports (SKIP LOCKED queue), retention; NOTIFY in the same transaction; API LISTEN → SignalR `/hubs/plant`; client invalidation with polling fallback and indicator | Report status column; rollback = run hosted services in the API again (flag) | Worker job tests; NOTIFY bridge test; report queue test | L |
| **S23** API v1 contract | 13-01 … 13-04, 13-06 … 13-11 (13-09: `generatedAt` in the list envelope), 5-14, 5-15, 5-17, 12-28, 3-03 | `/api/v1` routes per Appendix C with old routes as deprecated aliases; DTO-only; keyset/page pagination; time-series from/to/maxPoints; RFC 9457 Problem Details with error codes and correlation ID; exception handler; committed `api/openapi.v1.json` and generated TS types; client base path from env, timeouts, Problem Details parsing | None | Contract snapshot test, Problem Details tests | L |
| **S24** Observability | 3-04, 4-07, 19-01 … 19-03, 19-05 … 19-07, 18-15 | Serilog JSON (console + rolling files), correlation ID middleware passed to ML/AI/Worker, audit fields (actor type, entity type, outcome, correlation), audit coverage, `/health/live`, `/health/ready`, `GET /api/v1/system/status` | Additive audit columns | Correlation and audit tests | M |
| **S25** Resilience and retention | 18-05 … 18-08, 11-17 | Microsoft.Extensions.Http.Resilience on ML/AI clients; 2-s KPI/snapshot cache invalidated on change; pagination everywhere; retention jobs (readings 30 d, scores 180 d, report files 90 d → EXPIRED); "Anomaly detection unavailable since …" | None | Retention job test; resilience behaviour test | M |
| **S26** Assistant module | 16-01 … 16-04, 16-06, 16-07, 16-09 … 16-13, 5-05 | Feature folder + `IAssistantModelClient`; `Assistant:Enabled`; tool set of §16.2 under scope; ≤ 4 calls; structured `{answer, citations[]}` with citation validation; 1,000-char questions; 20 s/45 s limits, breaker, 503 ASSISTANT_UNAVAILABLE; labels with record count and time; full audit; workflow wording moved behind the assistant module boundary | None | Deterministic test provider (Testing only); citation stripping test | L |
| **S27** Configuration and deployment | 22-01 … 22-04, 22-06, 12-26, 12-29, 4-06, 4-10, 4-12, 4-17, 4-19, 4-14, 20-07 | `appsettings.{Development,Testing,Demonstration,Production}.json`, options with `ValidateOnStart`; feature flags off in Production; no auto-migrate in Production; compose with API, Worker, ML, nginx web; Dockerfiles; user-secrets; exact pins + NuGet lock files; vulnerability scans in CI; Testcontainers; ADRs for pgvector and ONNX (D2) | None | Startup validation tests; compose smoke in CI | L |
| **S28** Test completeness | 20-11, 20-13, 20-14, 18-03 | Frontend tests (themes, permissions, gaps, persistence, server values, twin selection); Playwright scenario flows + axe; ESLint/ruff/mypy in CI; render-time measurement | None | — | M |

### P3 — design system, accessibility, UX consistency, 3D twin

| Slice | Rows | Approach | Migration / rollback | Tests | Size |
|---|---|---|---|---|---|
| **S29** Design system | 3-08, 14-02 … 14-06, 14-08 … 14-11, 4-02, 5-13, 5-26 | Remove glass, gradients and decorative motion; one family (IBM Plex Sans); type scale; radii 4–8 px; status icons (plug for OFFLINE, dashed UNKNOWN); raw-colour lint rule; shared components (Radix dialogs/tooltips/tabs, toasts, TanStack Table DataTable, FreshnessIndicator, Skeleton, UnavailableState, DataClassificationBadge); feature folders; plant local time | None | Component tests; axe | L |
| **S30** Shell and accessibility | 14-12 … 14-19, 8-10, 7-30 | Simulator chip, notifications, skip link, system theme default, responsive tablet/mobile layout (collapsed sidebar, no horizontal scroll), routes per §14.6 (old routes redirect), confirm dialogs and toasts, LIVE (SIMULATED) labels | None | Playwright at 375/1280 px; navigation by permission | M |
| **S31** Screens | 14-20 … 14-26, 17-01, 17-06 | Dashboard per §14.7, machine tabs, alerts list/detail, maintenance priorities/records, inspections board/create/perform, corrective actions, analytics, reports status, admin users/plant/simulator/audit, settings; report types incl. machine status, alerts, corrective actions | None | Vitest + Playwright flows | L |
| **S32** 3D twin | 6-07, 15-02, 15-04 … 15-10, 18-04 | Layout records served by the API (zones/machines) instead of the static manifest; per-type registry; `frameloop="demand"`, instancing; synchronised machine list; full screen; desaturated OFFLINE/UNKNOWN; "Schematic representation"; WebGL fallback; fps measured | Layout columns seeded from the manifest | Selection logic tests (WebGL mocked) | M |

### P4 — documentation, ADRs, demo script

| Slice | Rows | Approach | Size |
|---|---|---|---|
| **S33** Documentation | 2-19, 2-20, 4-18, 5-18, 11-11, 11-18, 11-20, 12-19, 12-32, 20-01, 21-01 … 21-08, 22-05, 22-07, 22-08 | The twelve documents, ≥ 15 ADRs (context, decision, alternatives, consequences), DEPENDENCIES, ASSUMPTIONS, TESTING (acceptance criteria → tests), CHANGELOG, DEMO_SCRIPT, SECURITY (OWASP/ASVS checklist, no compliance claims), DEPLOYMENT (compose and enterprise Windows), backup/restore, Mermaid diagrams, README Limitations | L |

### Exceptions

| ID | Row | Summary |
|---|---|---|
| EX-01 | 11-03 | PascalCase table and column names are kept (D5); see `EXCEPTIONS.md` |

## Risks

- **Scale.** The plan touches most of the backend. Mitigation: small slices, characterization tests first, CI on every
  push, the live demo running from a separate published copy so it never breaks mid-change.
- **Data-rewriting migrations** (S09, S10, S12, S16–S18). Mitigation: backup + restore check before each, row counts
  recorded, additive-first sequence.
- **Demo continuity.** Sign-in becomes mandatory (D6) and routes change (S30); the demo script and README are updated
  in the same slices, and old routes redirect.
