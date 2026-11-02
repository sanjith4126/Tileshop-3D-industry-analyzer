# Changelog

Notable changes to TileTwin AI, in the format of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). There are
no versioned releases yet, so changes collect under Unreleased. Slice and row IDs refer to
[`docs/REMEDIATION_PLAN.md`](docs/REMEDIATION_PLAN.md) and [`docs/CONFORMANCE_REPORT.md`](docs/CONFORMANCE_REPORT.md).

## [Unreleased]

### Changed

- **Readings keep their gaps** (S01; 2-07, 7-06). `GET /api/machines/{id}/readings` returns every bucket of the
  window. Each point has a `count`; an empty bucket has `count: 0` and null `avg`, `min` and `max`. The 1 h range
  uses 1-minute buckets (was 30 s), so the 1-minute seeded history does not show false gaps. Charts break the line
  at empty buckets, shade them "No data", draw lone readings as dots, and no longer present an old value as the
  latest. The anomaly-score history breaks where scoring paused.
- **Downtime is no longer back-filled** (S01; 2-08). The live simulator writes the live point only. Time when it
  was not running (API stopped, PC asleep, simulator paused) stays a visible gap. Before, every missed minute of the
  last 7 days was generated at start-up and after any gap, which hid outages. A complete history now comes only
  from seeding (Administration → Reset demo data).
- **No production, no reject rate** (S01; 2-11). The overview reject rate is `null` when nothing was produced
  (shown as "No data — No production records in the last 7 days") instead of 0 %. `production.days` lists all
  7 days, each with `ratePercent: null` when it has no batches, and the sparkline breaks there. The assistant's
  production tool follows the same rule.
- **Synthetic labelling** (S01; 2-01, 2-02, 2-03, 13-09). Plant-data responses carry `dataClassification`
  (`"SYNTHETIC"`). It is set at plant level, so records users create in the demo plant are labelled too. The
  overview, machine detail and predictive detail carry `generatedAt`; the overview's production block carries its
  window (`fromUtc`, `toUtc`). The banner, badges, chart captions and the header and footer of every PDF page say
  "SYNTHETIC DEMO DATA".

- **Roles renamed** (S04, decision D1; 12-14). Viewer → **PlantManager**, Admin → **Administrator**; the DEV ONLY
  users follow (`dev.plantmanager@…`, `dev.administrator@…`). Data-rewriting migration
  `RenameRolesAndAddPermissions` — back up before upgrading (README, "Upgrading an existing database").
- **Permissions follow Appendix B** (S04; 4-04, 12-12, 12-15, B-05 … B-07). Endpoints require named permissions,
  resolved from a seeded `RolePermissions` table (read-only list in Administration). Behaviour changes for users:
  inspectors no longer acknowledge alerts, upload Knowledge Centre documents, run scoring or see anomaly scores and
  maintenance records; plant managers now acknowledge and resolve alerts, manage documents and assign
  observations; the machine-state update needs `maintenance.manage`. Login and refresh responses list the user's
  permissions; the assistant offers only the tools the user's permissions allow.

### Deprecated

- `POST /api/auth/login` and `GET /api/auth/me` (S03): aliases of the `/api/v1/auth/...` routes, answered with a
  `Deprecation` header and a `Link` to the successor. They will be removed after the next release.

### Removed

- Anonymous access (S04; 12-13, B-01, B-04, B-14, B-15). Every endpoint except sign-in and `/api/health` needs a
  signed-in user, including report PDFs, images and the 3D asset files; the app opens on a sign-in screen.
  `/api/health` no longer returns the demo-data batch, feature flags or the ML service URL.
- The assistant's `create_report_draft` tool (S02; 2-15). The assistant only reads; it points users to the Reports
  screen instead. Its tool list is now an allowlist checked by a test.
- `containsSyntheticData` on inspection summaries and report documents (S01), replaced by `dataClassification`.
  It was false for summaries and reports built only from user-created records, which are synthetic demo data too.

### Fixed

- The user menu opened underneath the page content, so **Sign out** could not be clicked on the Overview (found by
  the new Playwright session test).

### Security

- **Sessions** (S03; 12-02, 12-04, 12-05, 12-07 … 12-11). Sign-in moved to `POST /api/v1/auth/login`; new
  `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` and `GET /api/v1/auth/me`. Access tokens last 15 minutes
  (was 8 h) and carry only `sub`, roles, `jti`, `iat`, `exp`, `iss` and `aud` — no email or name — with a `kid`
  header and 30 s clock skew. A rotating refresh token (12 h per sign-in; reuse ends the whole session) travels in
  an HttpOnly, Secure, SameSite=Strict cookie. The SPA keeps the access token in memory only (was sessionStorage)
  and restores the session after a reload from the cookie. Sign-out and user deactivation revoke the session on
  the server at once. Lockout lasts 15 minutes (was 5); sign-in is also limited to 10 attempts per account per
  5 minutes; common passwords are rejected.
