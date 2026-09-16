# Working on Supabase

These rules apply to the `supabase/` subproject. Supabase owns persistent app
state: database schemas, durable configuration rows, auth hooks, storage bucket
configuration, project-managed storage assets, cron wiring, database Vault secrets,
and Edge Functions.

For cross-cutting TypeScript style, type placement, import/export, and runtime
boundary guidance, also follow `rules/TYPESCRIPT.md`. Supabase-specific
migration, Edge Function, generated type, and deployment rules stay in this
file.

Treat changes here as durable infrastructure work. A migration can outlive the
code that created it, and a bad permission can expose production data.

## Ground Rules

- Use the established Supabase layout for migrations, Edge Functions, generated
  data, storage assets, and tests. Do not invent parallel source roots.
- Keep generated durable-data sources separate from hand-written SQL
  migrations.
- Schema and durable database data go through migrations. Do not apply remote
  schema changes in the Supabase Dashboard after a project is migration-managed.
- Bucket settings are migration-owned and mirrored in local Supabase
  configuration.
- Project-managed storage objects must have explicit desired-state ownership.
- Edge Functions run on Deno. Internal imports inside functions use explicit
  `.ts` extensions.
- Service-role and secret-key behavior must stay backend-only. Never put service
  keys, Edge secrets, Vault secret values, database URLs, or provider API keys in
  app code, checked-in files, logs, migration comments, tests, or test data.
- If a schema or contract change affects another project, update that consumer
  deliberately and verify the affected scope.

## Supabase Platform Rules

These rules align with Supabase CLI and platform behavior:

- Supabase CLI Edge Functions belong in the CLI-recognized functions root.
- `supabase db reset` recreates the local database and reapplies migrations. Do
  not use `seed.sql` for durable app data.
- `supabase db push` applies pending local migrations to a linked remote project
  and records them in Supabase migration history.
- Tables in exposed schemas must have Row Level Security enabled and explicit
  role grants.
- Edge Function `verify_jwt` is enabled by default. If it is disabled in
  `config.toml`, the listener must implement its own auth or be deliberately
  public.
- Supabase Storage access is enforced through RLS on `storage.objects`. Treat
  storage schema metadata as read-only except for approved RLS policies, indexes,
  triggers, and bucket configuration migrations.

## Change Workflow

1. Read the owning migration, script, function, or test standard first.
2. Decide whether the change belongs in raw SQL, a generated data migration,
   storage assets, config, Edge Function code, or deployment scripts.
3. Make the smallest durable change that preserves the ownership model.
4. Regenerate derived files when required.
5. Run focused checks first, then broader checks only when the change scope
   requires them or the user asks.

Use raw SQL migrations for schema, RLS, grants, triggers, functions, extensions,
cron, storage bucket settings, and other database-owned behavior. Use
generated migrations for large durable configuration data sets and canonical
rows that are easier to maintain as source data.

## Migration Naming

Supabase migration filename rules live in [`NAMING.md`](NAMING.md). Prefer the
project migration creation command when creating a blank migration, then edit
the generated file. Keep migration timestamps chronological.

## Migration Immutability

- After a migration exists on the base branch or has been pushed to any remote
  Supabase project, treat it as immutable.
- Do not rename, reorder, squash, split, or edit applied migrations.
- If production needs a correction, create a new forward-only migration.
- If a migration has only existed in your local working branch and has not been
  pushed or reviewed, it can be edited before merge, but still keep its paired
  generated sources consistent.
- Do not repair Supabase migration history manually unless the user explicitly
  asks for a migration-history repair task.
- Do not use Dashboard or SQL Editor changes on remote databases as a shortcut.
  Capture every durable change in `migrations/`.

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

## SQL Style

- Use uppercase SQL keywords.
- Follow [`NAMING.md`](NAMING.md) for SQL identifier names.
- Fully qualify cross-schema references, especially inside functions and RLS
  policies.
- Prefer explicit column lists for every `INSERT` and every grant of write
  privileges.
- Prefer `CREATE SCHEMA IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, and `CREATE OR REPLACE FUNCTION` where a
  migration may replay locally.
- Follow [`NAMING.md`](NAMING.md) for constraint names.
- Keep table constraints close to the table definition unless they must be added
  later for dependency reasons.
- Put indexes in the `Indexes` section, not inline after unrelated objects.
- Put grants and revokes in the `Grants` section so privilege changes are
  auditable.
- Use comments to explain business invariants, security boundaries, and
  non-obvious Supabase behavior. Do not comment obvious SQL syntax.
- Do not leave placeholder comments, TODOs, fake examples, or unexplained
  suppressions in migrations.

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
- For ownership checks, use `(SELECT auth.uid())` or `(SELECT auth.jwt())` style
  helper calls in policies, following Supabase performance guidance.
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
- Avoid configured SQL. When configured SQL is required, quote identifiers and values
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
- Keep `supabase_auth_admin`, cron, storage, and internal Supabase roles narrowly
  scoped to the functions or schemas they need.
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

## Storage

- Bucket definitions live in migrations and are mirrored in `config.toml`.
- If a bucket's `public`, `file_size_limit`, or `allowed_mime_types` setting
  changes, update the migration path for durable DB state and `config.toml` for
  local Supabase/seed behavior in the same change.
- Use bucket restrictions for file size and MIME type. Do not rely only on app
  validation.
- Storage access is controlled by RLS policies on `storage.objects` and
  `storage.buckets`.
- Treat Supabase's `storage` schema as service-owned metadata. Do not directly
  mutate item rows as a substitute for Storage API operations.
- Custom indexes on storage metadata are acceptable when they support RLS or
  validation performance.
- Storage objects are desired-state assets. Replacing a file at the same key is
  normal.
- Storage upload tooling may upload declared local assets, but it must not be
  assumed to prune deleted remote objects unless that behavior is explicit.
- If an item key is renamed or removed, explicitly delete the stale remote
  item.
- Keep project-managed assets under the storage asset owner for their bucket.
- Storage seed scripts should verify that database rows and object keys agree
  when rows reference managed assets.

## Edge Functions

- Functions live under `functions/<function-name>/`.
- Shared function code, config constants, and generated DB types live with their
  established function runtime owners.
- Do not move deployable function code outside the Supabase CLI function root.
- Each deployable function must have a `[functions.<name>]` entry in
  local Supabase configuration.
- Set `entrypoint` explicitly and keep it relative to the Supabase config file.
- Keep `verify_jwt = true` for user-authenticated functions.
- If `verify_jwt = false`, the function must be one of:
    - genuinely public and harmless
    - protected by provider webhook signature verification
    - protected by a service-to-service secret or API key check inside the listener
    - invoked by cron with a Vault-backed bearer secret
- A publishable or secret API key is not a user JWT. Do not send API keys as
  `Authorization: Bearer <key>`.
- For authenticated user calls, forward the caller's `Authorization` header to
  the Supabase client so RLS runs as the user.
- Use service-role clients only for admin operations that cannot run as a user.
  Keep that path explicit in code and tests.
- Keep handlers small. Put parsing, validation, response creation, provider
  calls, and DB operations in separate local modules when complexity grows.
- Return JSON through shared response helpers.
- Handle `OPTIONS` requests and CORS through config/shared helpers.
- Avoid long-running CPU-heavy work in Edge Functions. Supabase Edge Functions
  have runtime, CPU, memory, bundle-size, and log-rate limits.
- Do not log secrets, bearer tokens, provider payloads that contain sensitive
  data, or raw Supabase errors that expose credentials.
- Run focused function checks after changing function code.
- Test function logic with unit tests where possible and integration tests when
  the Supabase client, auth, RLS, or external invocation path matters.

## Edge Function Imports

- Internal Edge Function imports must include `.ts`.
- TypeScript code outside Edge Functions usually uses extensionless imports
  because it runs through Bun/tsx tooling.
- The Deno configs under function folders map `@/` to the Supabase project root.
- Supabase examples often use `functions/_shared`; the required shared-code
  directory is `functions/shared/`.

## Config and Environment

- `config.toml` is part of the desired local and remote Supabase configuration.
- `[api].schemas` controls which schemas are exposed through the Data API. Any
  schema listed there must be treated as externally reachable.
- Keep `[api].max_rows` conservative to limit accidental or malicious payload
  size.
- Auth settings in `config.toml` are security-sensitive. Changes to signup,
  anonymous sign-in, provider settings, hooks, JWT expiry, and password policy
  require explicit review.
- Local secrets belong in ignored local env files or caller environment
  variables, never in git.
- Remote Edge Function secrets and Database Vault secrets must be synced through
  deliberate deployment tooling.
- Cron calls to Edge Functions must fetch bearer secrets from Vault rather than
  hardcoding credentials in cron SQL.
- Optional provider secrets should be synced only when their corresponding
  environment variables are intentionally set.

## Remote Deployment

Use the scripted remote flows. Do not hand-run partial remote changes unless the
user explicitly asks for that operation.

Remote flows should make each operation explicit: project linking, Vault sync,
database migration push, config push, storage asset sync, Edge Function deploy,
Edge secret sync, and cron scheduling.

If local Supabase configuration changes after initial rollout, deploy that
configuration deliberately rather than relying on a database-only update flow.

Remote deploy scripts should validate expected buckets and configured functions.
Keep configuration, deployment scripts, and deployment expectations in sync.

## Cron and Vault

- Use `pg_cron` plus `pg_net` only through migrations and deploy scripts.
- Store tokens needed by database-side cron in Vault and read them from
  `vault.decrypted_secrets` at call time.
- Follow [`NAMING.md`](NAMING.md) for cron job names.
- If a cron target function changes auth, update the Vault secret, function
  listener checks, and cron SQL together.

## Tests

- Use pgTAP SQL tests for schema, constraints, grants, triggers, RLS, RPCs, and
  migration-owned database behavior.
- Use unit tests for pure TypeScript logic, Edge Function validation, parsing,
  and response behavior.
- Use integration tests for Supabase client flows, auth behavior, RLS behavior,
  storage behavior, and real function invocation paths.
- Integration tests depend on the local Supabase stack and function server.
- Do not mock away RLS or grants in integration tests. The point is to verify the
  database boundary.
- When changing schema that another project consumes, regenerate types and
  update the dependent tests.

## Lint and Quality

- Fix all Supabase lint issues in touched scope.
- Do not suppress findings unless the suppression explains a real reason.
- Do not use SonarQube as part of normal linting.
- Run security scans when touching dependencies, deployment scripts, secrets
  handling, auth, RLS, service-role code, or storage policy code.

## Generated Types

- Regenerate database types after schema changes that affect generated types.
- Do not manually edit generated database type contents except for the
  generated-file lint header emitted by the generator.
- If generated types change, check affected Edge Functions, tests, and consumers
  for compile fallout.

## Naming

Supabase naming rules live in [`NAMING.md`](NAMING.md). Follow that file for
migrations, SQL identifiers, policies, Edge Function folders, TypeScript files,
storage buckets, storage item keys, environment variables, secrets, grants,
and function signatures.

Automated naming checks are authoritative when they exist for the touched
scope.

## Review Checklist

Before finishing a Supabase change, check the applicable items:

- The established layout is used and no parallel source roots were introduced.
- New migrations are correctly named, ordered, documented, and forward-only.
- Generated data migrations were rendered and checked.
- RLS is enabled on every new exposed table.
- Grants are explicit and least-privilege.
- Security-definer functions have `SET search_path = ''`, fully qualified
  references, and restricted execute privileges.
- Storage bucket settings are in both migrations and `config.toml` when relevant.
- Edge Function `verify_jwt` settings match the real caller auth pattern.
- Secrets are read from env or Vault, never checked in.
- Types were regenerated when schema changed.
- Relevant lint and tests were run, or any skipped check is explicitly reported.
- Dependent consumer checks were run when contracts changed.

## Do Not Do These

- Do not create parallel source roots for functions, config, runtime, generated
  types, or durable seed data.
- Do not add `seed.sql` for durable app data.
- Do not change remote schemas directly in the Dashboard after migrations own the
  schema.
- Do not edit applied migrations.
- Do not rely on service-role access to hide missing RLS policies.
- Do not expose service keys, Vault secret values, Edge secrets, database URLs,
  or provider API keys.
- Do not delete storage metadata rows directly to remove objects.
- Do not weaken auth settings, RLS, grants, or Edge Function `verify_jwt`
  settings without documenting why.
- Do not add broad `USING (true)` policies for convenience.
- Do not skip generated type updates after schema changes.
- Do not leave generated SQL drift between generated migration source and
  emitted migrations.

## References

- Supabase database migrations:
  <https://supabase.com/docs/guides/deployment/database-migrations>
- Supabase CLI reference:
  <https://supabase.com/docs/reference/cli/supabase-migration>
- Supabase Row Level Security:
  <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase database functions:
  <https://supabase.com/docs/guides/database/functions>
- Supabase Edge Functions:
  <https://supabase.com/docs/guides/functions>
- Securing Supabase Edge Functions:
  <https://supabase.com/docs/guides/functions/auth>
- Supabase Function Configuration:
  <https://supabase.com/docs/guides/functions/function-configuration>
- Supabase Storage access command:
  <https://supabase.com/docs/guides/storage/security/access-command>
- Supabase Storage schema:
  <https://supabase.com/docs/guides/storage/schema/design>
- Scheduling Edge Functions:
  <https://supabase.com/docs/guides/functions/schedule-functions>
