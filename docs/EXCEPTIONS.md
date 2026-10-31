# Exceptions (section 23.4 of `docs/MASTER_PROMPT.md`)

A requirement may stay unmet only through an exception approved by the owner. The prime directives (section 2) admit
no exceptions.

| ID | Row | Requirement | Reason | Risk | Mitigation | Owner | Approved | Review |
|---|---|---|---|---|---|---|---|---|
| EX-01 | 11-03 | snake_case tables and columns | Renaming all 31 tables and their columns rewrites every migration-managed object and every raw SQL query for no functional gain; section 11.1 asks to weigh the benefit against the migration risk (decision D5). | Mixed conventions if new tables used snake_case. | Keep EF Core's PascalCase consistently for all tables, including new ones; names are quoted in raw SQL; revisit if the database is shared with other systems. | Project owner | 2026-10-30 (owner instruction "do everything" after the D1–D8 recommendations; confirm in the final report) | At the next major release |
