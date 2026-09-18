---
layer: language
preset: sql
title: SQL
---

# SQL

## SQL style

- Use uppercase SQL keywords. `enforced-by: structure/sql-migration-docs`
- Fully qualify cross-schema references, especially inside functions and RLS
  policies. `enforced-by: structure/sql-migration-docs`
- Prefer explicit column lists for every `INSERT` and every grant of write
  privileges. `enforced-by: structure/sql-migration-docs`
- Prefer `CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, and `CREATE OR REPLACE FUNCTION` where a
  migration may replay locally. `unenforced`
- Keep table constraints close to the table definition unless they must be added
  later for dependency reasons. `enforced-by: structure/sql-migration-docs`
- Put indexes in the `Indexes` section, not inline after unrelated objects. `enforced-by: structure/sql-migration-docs`
- Put grants and revokes in the `Grants` section so privilege changes are
  auditable. `enforced-by: structure/sql-migration-docs`
- Use comments to explain business invariants, security boundaries, and
  non-obvious platform behavior. Do not comment obvious SQL syntax. `enforced-by: structure/sql-migration-docs`
- Do not leave placeholder comments, TODOs, fake examples, or unexplained
  suppressions in migrations. `enforced-by: structure/sql-migration-docs`
