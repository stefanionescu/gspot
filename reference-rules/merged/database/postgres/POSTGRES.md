# Postgres

## Migration Naming

Prefer the
project migration creation command when creating a blank migration, then edit
the generated file. Keep migration timestamps chronological.

## Migration Immutability

- After a migration exists on the base branch or has been applied to any remote
  database, treat it as immutable.
- Do not rename, reorder, squash, split, or edit applied migrations.
- If production needs a correction, create a new forward-only migration.
- If a migration has only existed in your local working branch and has not been
  pushed or reviewed, it can be edited before merge, but still keep its paired
  generated sources consistent.
- Do not repair migration history manually unless the user explicitly asks for a
  migration-history repair task.
- Do not use a web console or SQL editor on a remote database as a shortcut.
  Capture every durable change as a migration.

## Migration Structure

Every hand-written SQL migration must include the migration header and section
headings required by the SQL documentation tooling. Do not duplicate the
tooling's exact accepted section-name list in these rules.

Use item labels before important objects:

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

## Tables and Data Modeling

- Prefer UUIDv7 primary keys via `public.generate_uuid_v7()` for app-owned rows.
- Add UUIDv7 check constraints for UUIDv7 columns.
- Use `TIMESTAMPTZ` for timestamps.
- Add `createdAt` and `updatedAt` when rows are mutable and audit columns are
  required.
- Use `public.touch_updated_at()` triggers for mutable tables that carry
  `updatedAt`.
- Think through account deletion. Some tables intentionally avoid foreign keys to
  `auth.users` so historical data survives user deletion.
- Use soft delete where the product relies on retained history.
- Add indexes for foreign keys, common filters, ordering columns, and RLS policy
  predicates that will run frequently.
- Keep generated columns, uniqueness constraints, and check constraints in the DB
  when they express durable invariants. Do not rely only on client validation.

## Row Level Security

- Enable RLS on every app table in an exposed schema.
- Exposed schemas are declared in `config.toml` under `[api].schemas`.
- A table with RLS and no policy is intentionally inaccessible through anon or
  authenticated Data API calls.
- Always pair table creation with:
    - `ALTER TABLE <schema>.<table> ENABLE ROW LEVEL SECURITY;`
    - explicit `REVOKE ALL` from broad roles
    - explicit `GRANT` statements for only the roles and columns needed
    - policies for user-facing access
- Use `TO authenticated`, `TO anon`, and `TO service_role` deliberately. Do not
  omit `TO` unless every role truly belongs in the policy.
- For ownership checks, wrap the identity function in a scalar subquery so the
  planner evaluates it once per statement rather than once per row.
- `UPDATE` access usually needs both a `SELECT` policy and an `UPDATE` policy.
- Use `USING` for row visibility and `WITH CHECK` for allowed new row state.
- Do not create broad policies like `USING (true)` unless the table is genuinely
  public or service-only and the migration explains why.
- Service-role writes still need explicit table grants. Do not use service role
  as a substitute for precise grants.
- Use `security_invoker = true` for views in exposed schemas on Postgres 15+
  when the view needs to respect underlying table RLS. Otherwise revoke access or
  keep the view out of exposed schemas.

## Database Functions

- Prefer `SECURITY INVOKER`, which is the default.
- Use `SECURITY DEFINER` only when the function must cross RLS or role
  boundaries, and explain the reason in the function comment.
- Every `SECURITY DEFINER` function must set `search_path = ''`.
- Inside `SECURITY DEFINER` functions, fully qualify every schema item.
- Revoke execute from `public`, `anon`, `authenticated`, and `service_role` by
  default, then grant execute only to the exact required roles.
- Avoid direct execute grants on trigger functions.
- Avoid dynamic SQL. When dynamic SQL is required, quote identifiers and values
  safely and keep the input domain constrained.
- Raise exceptions with useful SQLSTATE categories when clients or tests depend
  on error classification.
- Do not log secrets, tokens, personal data, or raw request payloads from
  database functions.

## Grants

- Start from least privilege:
    - `REVOKE ALL ON <item> FROM public;`
    - `REVOKE ALL ON <item> FROM anon;`
    - `REVOKE ALL ON <item> FROM authenticated;`
    - `REVOKE ALL ON <item> FROM service_role;`
- Grant schema usage only to roles that need to resolve objects in that schema.
- Grant table write access by column list where possible.
- Grant `SELECT` only when the role has a real read path.
- Keep service-owned roles, such as those a platform creates for auth, cron or
  storage, narrowly scoped to the functions or schemas they need.
- When granting function execute, include the full function signature.

## Durable Data Migrations

Do not use `seed.sql` for durable app data. Durable rows live in timestamped
migrations. Large or structured data migrations are generated from source data.

Rules for generated data migrations:

- The generator definition name must exactly match the emitted migration name.
- `definition.purpose` must be specific and non-empty.
- Local relative imports must stay inside the same generated migration owner.
- Keep canonical source constants separate from SQL composition code.
- Do not import data from another generated migration owner. Duplicate or promote shared
  constants only when there is a clear durable ownership reason.
- Supported generated statement kinds are `note`, `insert`,
  `insertSelectFromValues`, `update`, `updateFrom`, and `delete`.
- `update`, `updateFrom`, and `delete` statements must include explicit `WHERE`
  conditions.
- Regenerate emitted SQL after changing generated migration source.
- Check generated SQL drift during review or verification.
- After the generated SQL migration is immutable, do not edit the paired
  source in a way that changes it. Add a new migration instead.

Generated SQL still has to satisfy the same migration naming and documentation
rules as hand-written SQL.

## Tests

- Use pgTAP SQL tests for schema, constraints, grants, triggers, RLS, RPCs, and
  migration-owned database behavior.
- Use unit tests for pure TypeScript logic, Edge Function validation, parsing,
  and response behavior.
- Use integration tests for client flows, auth behavior, RLS behavior, storage
  behavior, and real function invocation paths.
- Integration tests depend on a local database and, where one exists, a local
  function server.
- Do not mock away RLS or grants in integration tests. The point is to verify the
  database boundary.
- When changing schema that another project consumes, regenerate types and
  update the dependent tests.
