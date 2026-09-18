---
layer: platform
preset: supabase
title: Supabase
---

# Supabase

## Ground rules

- Use the established Supabase layout for migrations, Edge Functions, generated
  data, storage assets, and tests. Do not invent parallel source roots. `enforced-by: security/semgrep`
- Keep generated durable-data sources separate from hand-written SQL
  migrations. `enforced-by: security/semgrep`
- Schema and durable database data go through migrations. Do not apply remote
  schema changes in the Supabase Dashboard after a project is migration-managed. `enforced-by: security/semgrep`
- Bucket settings are migration-owned and mirrored in local Supabase
  configuration. `enforced-by: security/semgrep`
- Project-managed storage objects must have explicit desired-state ownership. `enforced-by: security/semgrep`
- Edge Functions run on Deno. Internal imports inside functions use explicit
  `.ts` extensions. `enforced-by: security/semgrep`
- Service-role and secret-key behavior must stay backend-only. Never put service
  keys, Edge secrets, Vault secret values, database URLs, or provider API keys in
  app code, checked-in files, logs, migration comments, tests, or test data. `enforced-by: security/semgrep`
- If a schema or contract change affects another project, update that consumer
  deliberately and verify the affected scope. `enforced-by: security/semgrep`

## Supabase platform rules

These rules align with Supabase CLI and platform behavior:

- Supabase CLI Edge Functions belong in the CLI-recognized functions root. `unenforced`
- `supabase db reset` recreates the local database and reapplies migrations. Do
  not use `seed.sql` for durable app data. `enforced-by: security/semgrep`
- `supabase db push` applies pending local migrations to a linked remote project
  and records them in Supabase migration history. `enforced-by: security/semgrep`
- Tables in exposed schemas must have Row Level Security enabled and explicit
  role grants. `enforced-by: postgres/squawk`
- Edge Function `verify_jwt` is enabled by default. If it is disabled in
  `config.toml`, the listener must implement its own auth or be deliberately
  public. `enforced-by: config-files/schema`
- Supabase Storage access is enforced through RLS on `storage.objects`. Treat
  storage schema metadata as read-only except for approved RLS policies, indexes,
  triggers, and bucket configuration migrations. `enforced-by: security/semgrep`

## Change workflow

1. Read the owning migration, script, function, or test standard first. `unenforced`
2. Decide whether the change belongs in raw SQL, a generated data migration,
   storage assets, config, Edge Function code, or deployment scripts. `unenforced`
3. Make the smallest durable change that preserves the ownership model. `unenforced`
4. Regenerate derived files when required. `unenforced`
5. Run `gspot check --staged`. `unenforced`

Use raw SQL migrations for schema, RLS, grants, triggers, functions, extensions, `enforced-by: security/semgrep`
cron, storage bucket settings, and other database-owned behavior. Use
generated migrations for large durable configuration data sets and canonical
rows that are easier to maintain as source data.

## Storage

- Bucket definitions live in migrations and are mirrored in `config.toml`. `enforced-by: security/semgrep`
- If a bucket's `public`, `file_size_limit`, or `allowed_mime_types` setting
  changes, update the migration path for durable DB state and `config.toml` for
  local Supabase/seed behavior in the same change. `enforced-by: config-files/schema`
- Use bucket restrictions for file size and MIME type. Do not rely only on app
  validation. `enforced-by: postgres/squawk`
- Storage access is controlled by RLS policies on `storage.objects` and
  `storage.buckets`. `enforced-by: postgres/squawk`
- Treat Supabase's `storage` schema as service-owned metadata. Do not directly
  mutate object rows as a substitute for Storage API operations. `enforced-by: security/semgrep`
- Custom indexes on storage metadata are acceptable when they support RLS or
  validation performance. `unenforced`
- Storage objects are desired-state assets. Replacing a file at the same key is
  normal. `enforced-by: security/semgrep`
- Storage upload tooling may upload declared local assets, but it must not be
  assumed to prune deleted remote objects unless that behavior is explicit. `enforced-by: postgres/squawk`
- If an object key is renamed or removed, explicitly delete the stale remote
  object. `enforced-by: postgres/squawk`
- Keep project-managed assets under the storage asset owner for their bucket. `enforced-by: postgres/squawk`
- Storage seed scripts verify that database rows and object keys agree
  when rows reference managed assets. `enforced-by: postgres/squawk`

## Edge functions

- Functions live under `functions/<function-name>/`. `enforced-by: config-files/schema`
- Shared function code, config constants, and generated DB types live with their
  established function runtime owners. `enforced-by: config-files/schema`
- Do not move deployable function code outside the Supabase CLI function root. `enforced-by: security/semgrep`
- Each deployable function must have a `[functions.<name>]` entry in
  local Supabase configuration. `enforced-by: config-files/schema`
- Set `entrypoint` explicitly and keep it relative to the Supabase config file. `enforced-by: config-files/schema`
- Keep `verify_jwt = true` for user-authenticated functions. `unenforced`
- If `verify_jwt = false`, the function must be one of:
    - genuinely public and harmless `unenforced`
    - protected by provider webhook signature verification `enforced-by: security/semgrep`
    - protected by a service-to-service secret or API key check inside the listener `enforced-by: security/semgrep`
    - invoked by cron with a Vault-backed bearer secret `enforced-by: security/semgrep`
- A publishable or secret API key is not a user JWT. Do not send API keys as
  `Authorization: Bearer <key>`. `enforced-by: security/semgrep`
- For authenticated user calls, forward the caller's `Authorization` header to
  the Supabase client so RLS runs as the user. `enforced-by: security/semgrep`
- Use service-role clients only for admin operations that cannot run as a user.
  Keep that path explicit in code and tests. `enforced-by: security/semgrep`
- Keep handlers small. Put parsing, validation, response creation, provider
  calls, and DB operations in separate local modules when complexity grows. `enforced-by: security/semgrep`
- Return JSON through shared response helpers. `enforced-by: security/semgrep`
- Handle `OPTIONS` requests and CORS through config/shared helpers. `enforced-by: security/semgrep`
- Avoid long-running CPU-heavy work in Edge Functions. Supabase Edge Functions
  have runtime, CPU, memory, bundle-size, and log-rate limits. `enforced-by: security/semgrep`
- Do not log secrets, bearer tokens, provider payloads that contain sensitive
  data, or raw Supabase errors that expose credentials. `enforced-by: security/semgrep`
- Run focused function checks after changing function code. `unenforced`
- Test function logic with unit tests, and integration tests when
  the Supabase client, auth, RLS, or external invocation path matters. `enforced-by: security/semgrep`

## Edge function imports

- Internal Edge Function imports must include `.ts`. `unenforced`
- TypeScript code outside Edge Functions uses extensionless imports
  because it runs through Bun/tsx tooling. `unenforced`
- The Deno configs under function folders map `@/` to the Supabase project root. `enforced-by: config-files/schema`
- Supabase examples often use `functions/_shared`; the required shared-code
  directory is `functions/shared/`. `enforced-by: config-files/schema`

## Config and environment

- `config.toml` is part of the desired local and remote Supabase configuration. `enforced-by: config-files/schema`
- `[api].schemas` controls which schemas are exposed through the Data API. Any
  schema listed there must be treated as externally reachable. `enforced-by: config-files/schema`
- Keep `[api].max_rows` conservative to limit accidental or malicious payload
  size. `enforced-by: config-files/schema`
- Auth settings in `config.toml` are security-sensitive. Changes to signup,
  anonymous sign-in, provider settings, hooks, JWT expiry, and password policy
  require explicit review. `enforced-by: config-files/schema`
- Local secrets belong in ignored local env files or caller environment
  variables, never in git. `unenforced`
- Remote Edge Function secrets and Database Vault secrets must be synced through
  deliberate deployment tooling. `enforced-by: security/semgrep`
- Cron calls to Edge Functions must fetch bearer secrets from Vault rather than
  hardcoding credentials in cron SQL. `enforced-by: security/semgrep`
- Optional provider secrets are synced only when their corresponding
  environment variables are intentionally set. `unenforced`

## Cron and Vault

- Use `pg_cron` plus `pg_net` only through migrations and deploy scripts. `enforced-by: security/semgrep`
- Store tokens needed by database-side cron in Vault and read them from
  `vault.decrypted_secrets` at call time. `enforced-by: security/semgrep`
- If a cron target function changes auth, update the Vault secret, function
  listener checks, and cron SQL together. `enforced-by: security/semgrep`

## Generated types

- Regenerate database types after schema changes that affect generated types. `enforced-by: integrity/generated-fresh`
- Do not manually edit generated database type contents except for the
  generated-file lint header emitted by the generator. `enforced-by: integrity/generated-fresh`
- If generated types change, check affected Edge Functions, tests, and consumers
  for compile fallout. `enforced-by: integrity/generated-fresh`

## Do not do these

- Do not create parallel source roots for functions, config, runtime, generated
  types, or durable seed data. `enforced-by: security/semgrep`
- Do not add `seed.sql` for durable app data. `enforced-by: security/semgrep`
- Do not change remote schemas directly in the Dashboard after migrations own the
  schema. `enforced-by: security/semgrep`
- Do not edit applied migrations. `enforced-by: security/semgrep`
- Do not rely on service-role access to hide missing RLS policies. `enforced-by: security/semgrep`
- Do not expose service keys, Vault secret values, Edge secrets, database URLs,
  or provider API keys. `enforced-by: security/semgrep`
- Do not delete storage metadata rows directly to remove objects. `enforced-by: security/semgrep`
- Do not weaken auth settings, RLS, grants, or Edge Function `verify_jwt`
  settings without documenting why. `enforced-by: config-files/schema`
- Do not add broad `USING (true)` policies for convenience. `enforced-by: security/semgrep`
- Do not skip generated type updates after schema changes. `enforced-by: security/semgrep`
- Do not leave generated SQL drift between generated migration source and
  emitted migrations. `enforced-by: security/semgrep`

## References

- Supabase database migrations:
  <https://supabase.com/docs/guides/deployment/database-migrations> `enforced-by: security/semgrep`
- Supabase CLI reference:
  <https://supabase.com/docs/reference/cli/supabase-migration> `unenforced`
- Supabase Row Level Security:
  <https://supabase.com/docs/guides/database/postgres/row-level-security> `enforced-by: postgres/squawk`
- Supabase database functions:
  <https://supabase.com/docs/guides/database/functions> `unenforced`
- Supabase Edge Functions:
  <https://supabase.com/docs/guides/functions> `unenforced`
- Securing Supabase Edge Functions:
  <https://supabase.com/docs/guides/functions/auth> `unenforced`
- Supabase Function Configuration:
  <https://supabase.com/docs/guides/functions/function-configuration> `unenforced`
- Supabase Storage access control:
  <https://supabase.com/docs/guides/storage/security/access-control> `unenforced`
- Supabase Storage schema:
  <https://supabase.com/docs/guides/storage/schema/design> `enforced-by: postgres/squawk`
- Scheduling Edge Functions:
  <https://supabase.com/docs/guides/functions/schedule-functions> `unenforced`

## Edge function names

Rules:

- Function folders use `kebab-case`. `enforced-by: config-files/schema`
- The folder name, config entry, and deployable function name must match. `enforced-by: config-files/schema`
- Shared function code belongs under approved shared function folders and
  follows TypeScript naming. `enforced-by: config-files/schema`
- Name Edge Functions by the externally callable operation. `enforced-by: config-files/schema`
- Do not name Edge Functions after implementation technology. `enforced-by: config-files/schema`

Bad:

```text
functions/SubmitOrder/
functions/provider_handler/
functions/functions/src/submit-order/
```

Good:

```text
functions/submit-order/
functions/refresh-provider-token/
functions/shared-code/
functions/provider-config/
functions/generated-types/
```

## Review checklist

Before `gspot check`, read the change against these questions:

- The established layout is used and no parallel source roots were introduced. `enforced-by: security/semgrep`
- New migrations are correctly named, ordered, documented, and forward-only. `enforced-by: security/semgrep`
- Generated data migrations were rendered and checked. `enforced-by: security/semgrep`
- RLS is enabled on every new exposed table. `unenforced`
- Grants are explicit and least-privilege. `unenforced`
- Security-definer functions have `SET search_path = ''`, fully qualified `unenforced`
- Storage bucket settings are in both migrations and `config.toml` when relevant. `enforced-by: security/semgrep`
- Edge Function `verify_jwt` settings match the real caller auth pattern. `enforced-by: config-files/schema`
- Secrets are read from env or Vault, never checked in. `enforced-by: security/semgrep`
- Types were regenerated when schema changed. `unenforced`
- Relevant lint and tests were run, or any skipped check is explicitly reported. `unenforced`
- Dependent consumer checks were run when contracts changed. `unenforced`
