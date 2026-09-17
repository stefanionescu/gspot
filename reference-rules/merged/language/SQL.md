# SQL

## SQL Style

- Use uppercase SQL keywords.
- Fully qualify cross-schema references, especially inside functions and RLS
  policies.
- Prefer explicit column lists for every `INSERT` and every grant of write
  privileges.
- Prefer `CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, and `CREATE OR REPLACE FUNCTION` where a
  migration may replay locally.
- Keep table constraints close to the table definition unless they must be added
  later for dependency reasons.
- Put indexes in the `Indexes` section, not inline after unrelated objects.
- Put grants and revokes in the `Grants` section so privilege changes are
  auditable.
- Use comments to explain business invariants, security boundaries, and
  non-obvious platform behavior. Do not comment obvious SQL syntax.
- Do not leave placeholder comments, TODOs, fake examples, or unexplained
  suppressions in migrations.
