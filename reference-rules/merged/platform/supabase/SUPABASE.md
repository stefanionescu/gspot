# Supabase

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

## Cron and Vault

- Use `pg_cron` plus `pg_net` only through migrations and deploy scripts.
- Store tokens needed by database-side cron in Vault and read them from
  `vault.decrypted_secrets` at call time.
- If a cron target function changes auth, update the Vault secret, function
  listener checks, and cron SQL together.

## Generated Types

- Regenerate database types after schema changes that affect generated types.
- Do not manually edit generated database type contents except for the
  generated-file lint header emitted by the generator.
- If generated types change, check affected Edge Functions, tests, and consumers
  for compile fallout.

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
- Supabase Storage access control:
  <https://supabase.com/docs/guides/storage/security/access-command>
- Supabase Storage schema:
  <https://supabase.com/docs/guides/storage/schema/design>
- Scheduling Edge Functions:
  <https://supabase.com/docs/guides/functions/schedule-functions>
