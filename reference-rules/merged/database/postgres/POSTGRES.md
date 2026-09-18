---
layer: database
preset: postgres
title: Postgres
---

# Postgres

## Migration naming

Prefer the `unenforced`
project migration creation command when creating a blank migration, then edit
the generated file. Keep migration timestamps chronological.

## Migration immutability

- After a migration exists on the base branch or has been applied to any remote
  database, treat it as immutable. `enforced-by: postgres/migrations-frozen`
- Do not rename, reorder, squash, split, or edit applied migrations. `enforced-by: postgres/migrations-frozen`
- If production needs a correction, create a new forward-only migration. `enforced-by: postgres/migrations-frozen`
- A migration that exists only in your local branch, unpushed and unreviewed, can be edited before
  merge. Keep its paired generated sources consistent when you do. `unenforced`
- Do not repair migration history manually unless the user explicitly asks for a
  migration-history repair task. `enforced-by: postgres/migrations-frozen`
- Do not use a web console or SQL editor on a remote database as a shortcut.
  Capture every durable change as a migration. `enforced-by: postgres/migrations-frozen`

## Migration structure

Every hand-written SQL migration must include the migration header and section `enforced-by: structure/sql-migration-docs`
headings required by the SQL documentation tooling. Do not duplicate the
tooling's exact accepted section-name list in these rules.

Use object labels before important objects:

```sql
-- ============================================================================
-- Table: orders
-- Purpose: Represents a submitted order owned by an account.
-- ============================================================================
CREATE TABLE IF NOT EXISTS commerce.orders (
    id UUID DEFAULT public.generate_uuid_v7() PRIMARY KEY
);
```

```sql
-- ============================================================================
-- Function: validate_call_start
-- Purpose: Validates ownership and capacity before a call starts.
-- ============================================================================
CREATE OR REPLACE FUNCTION chat.validate_call_start()
RETURNS TRIGGER AS $$
BEGIN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
```

Trigger creation must have a descriptive comment within five lines above the
`CREATE TRIGGER` statement.

## Tables and data modeling

- Prefer UUIDv7 primary keys via `public.generate_uuid_v7()` for app-owned rows. `enforced-by: postgres/squawk`
- Add UUIDv7 check constraints for UUIDv7 columns. `enforced-by: postgres/squawk`
- Use `TIMESTAMPTZ` for timestamps. `enforced-by: postgres/migrations-frozen`
- Add `created_at` and `updated_at` when rows are mutable and audit columns are
  required. `enforced-by: postgres/squawk`
- Use `public.touch_updated_at()` triggers for mutable tables that carry
  `updated_at`. `enforced-by: postgres/squawk`
- Think through account deletion. Some tables intentionally avoid foreign keys to
  `auth.users` so historical data survives user deletion. `enforced-by: postgres/squawk`
- Use soft delete where the product relies on retained history. `enforced-by: postgres/squawk`
- Add indexes for foreign keys, common filters, ordering columns, and RLS policy
  predicates that will run frequently. `enforced-by: postgres/squawk`
- Keep generated columns, uniqueness constraints, and check constraints in the DB
  when they express durable invariants. Do not rely only on client validation. `enforced-by: postgres/squawk`

## Row level security

- Enable RLS on every app table in an exposed schema. `enforced-by: postgres/squawk`
- Exposed schemas are declared in `config.toml` under `[api].schemas`. `unenforced`
- A table with RLS and no policy is intentionally inaccessible through anon or
  authenticated Data API calls. `unenforced`
- Always pair table creation with:
    - `ALTER TABLE <schema>.<table> ENABLE ROW LEVEL SECURITY;` `unenforced`
    - explicit `REVOKE ALL` from broad roles `enforced-by: postgres/squawk`
    - explicit `GRANT` statements for only the roles and columns needed `enforced-by: postgres/squawk`
    - policies for user-facing access `unenforced`
- Use `TO authenticated`, `TO anon`, and `TO service_role` deliberately. Do not
  omit `TO` unless every role truly belongs in the policy. `enforced-by: postgres/squawk`
- For ownership checks, wrap the identity function in a scalar subquery so the
  planner evaluates it once per statement rather than once per row. `enforced-by: postgres/squawk`
- `UPDATE` access needs both a `SELECT` policy and an `UPDATE` policy. `enforced-by: postgres/squawk`
- Use `USING` for row visibility and `WITH CHECK` for allowed new row state:

| Operation   | Policy expression                                                               |
| ----------- | ------------------------------------------------------------------------------- |
| Read rows   | `USING` selects visible existing rows                                           |
| Insert rows | `WITH CHECK` validates the proposed row; an insert policy has no `USING` clause |
| Update rows | `USING` selects existing rows and `WITH CHECK` validates their new values       |
| Delete rows | `USING` selects rows that may be deleted                                        |

- Permissive policies broaden access and restrictive policies add conditions; review how every
  applicable policy combines for the role. `enforced-by: postgres/squawk`
- Validate both resource ownership and tenant membership. Prevent an update from moving a row into
  another user's or tenant's scope by checking its proposed values. `enforced-by: postgres/squawk`
- Handle unauthenticated identity explicitly. Keep `anon` access limited to the rows and
  operations intended to be public. `enforced-by: postgres/squawk`
- Base authorization on trusted claims and current membership data. Keep user-editable profile
  metadata out of privilege decisions. Account for stale token claims after membership changes. `enforced-by: postgres/squawk`
- Grants and RLS are separate controls. Restrict table and schema privileges, then use policies
  to limit rows. RLS does not cover `TRUNCATE`. `enforced-by: postgres/squawk`
- Do not create broad policies like `USING (true)` unless the table is genuinely
  public or service-only and the migration explains why. `enforced-by: postgres/squawk`
- Service-role writes still need explicit table grants. Do not use service role
  as a substitute for precise grants. `enforced-by: postgres/squawk`
- Use `security_invoker = true` for views in exposed schemas on Postgres 15+
  when the view needs to respect underlying table RLS. Otherwise revoke access or
  keep the view out of exposed schemas. `unenforced`

## Database functions

- Prefer `SECURITY INVOKER`, which is the default. `enforced-by: postgres/squawk`
- Use `SECURITY DEFINER` only when the function must cross RLS or role
  boundaries, and explain the reason in the function comment. `enforced-by: postgres/squawk`
- Every `SECURITY DEFINER` function must set `search_path = ''`. `enforced-by: postgres/squawk`
- Inside `SECURITY DEFINER` functions, fully qualify every schema object. `enforced-by: structure/sql-migration-docs`
- Revoke execute from `public`, `anon`, `authenticated`, and `service_role` by
  default, then grant execute only to the exact required roles. `enforced-by: postgres/squawk`
- Avoid direct execute grants on trigger functions. `enforced-by: postgres/squawk`
- Avoid dynamic SQL. When dynamic SQL is required, quote identifiers and values
  safely and keep the input domain constrained. `enforced-by: postgres/squawk`
- Raise exceptions with useful SQLSTATE categories when clients or tests depend
  on error classification. `enforced-by: postgres/squawk`
- Do not log secrets, tokens, personal data, or raw request payloads from
  database functions. `enforced-by: postgres/squawk`

## Grants

- Start from least privilege:
    - `REVOKE ALL ON <object> FROM public;` `unenforced`
    - `REVOKE ALL ON <object> FROM anon;` `unenforced`
    - `REVOKE ALL ON <object> FROM authenticated;` `unenforced`
    - `REVOKE ALL ON <object> FROM service_role;` `unenforced`
- Grant schema usage only to roles that need to resolve objects in that schema. `enforced-by: postgres/squawk`
- Grant table write access by column list. `enforced-by: postgres/squawk`
- Grant `SELECT` only when the role has a real read path. `enforced-by: postgres/squawk`
- Keep service-owned roles, such as those a platform creates for auth, cron or
  storage, narrowly scoped to the functions or schemas they need. `enforced-by: postgres/squawk`
- When granting function execute, include the full function signature. `enforced-by: postgres/squawk`

## Durable data migrations

Do not use `seed.sql` for durable app data. Durable rows live in timestamped `enforced-by: postgres/migrations-frozen`
migrations. Large or structured data migrations are generated from source data.

Rules for generated data migrations:

- The generator definition name must exactly match the emitted migration name. `enforced-by: integrity/generated-fresh`
- `definition.purpose` must be specific and non-empty. `enforced-by: integrity/generated-fresh`
- Local relative imports must stay inside the same generated migration owner. `enforced-by: integrity/generated-fresh`
- Keep canonical source constants separate from SQL composition code. `enforced-by: integrity/generated-fresh`
- Do not import data from another generated migration owner. Duplicate or promote shared
  constants only when there is a clear durable ownership reason. `enforced-by: integrity/generated-fresh`
- Supported generated statement kinds are `note`, `insert`,
  `insertSelectFromValues`, `update`, `updateFrom`, and `delete`. `enforced-by: integrity/generated-fresh`
- `update`, `updateFrom`, and `delete` statements must include explicit `WHERE`
  conditions. `enforced-by: integrity/generated-fresh`
- Regenerate emitted SQL after changing generated migration source. `enforced-by: integrity/generated-fresh`
- Check generated SQL drift during review or verification. `enforced-by: integrity/generated-fresh`
- After the generated SQL migration is immutable, do not edit the paired
  source in a way that changes it. Add a new migration instead. `enforced-by: postgres/migrations-frozen`

Generated SQL still has to satisfy the same migration naming and documentation
rules as hand-written SQL.

## Tests

- Use pgTAP SQL tests for schema, constraints, grants, triggers, RLS, RPCs, and
  migration-owned database behavior. `unenforced`
- Use unit tests for pure TypeScript logic, Edge Function validation, parsing,
  and response behavior. `unenforced`
- Use integration tests for client flows, auth behavior, RLS behavior, storage
  behavior, and real function invocation paths. `unenforced`
- Integration tests depend on a local database and, where one exists, a local
  function server. `unenforced`
- Do not mock away RLS or grants in integration tests. The point is to verify the
  database boundary. `unenforced`
- When changing schema that another project consumes, regenerate types and
  update the dependent tests. `unenforced`
