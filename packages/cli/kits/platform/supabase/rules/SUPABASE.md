---
title: Supabase
---

# Supabase

Layout, database access, storage, Edge Functions, configuration, and secrets of a Supabase
project, on top of the Postgres rules. Supabase's API roles are `anon`, `authenticated`, and
`service_role`.

## Layout and migrations

- Use the established Supabase layout for migrations, Edge Functions, generated data, storage
  assets, and tests, with no parallel source roots. Generated durable-data sources stay apart from
  hand-written migrations.
- Schema, durable data, bucket settings, extensions, cron, and other database-owned behavior go
  through migrations. Once migrations own the schema, never change a remote schema in the
  Dashboard.
- `supabase db reset` recreates the local database and reapplies migrations, so `seed.sql` never
  holds durable data. `supabase db push` applies pending migrations to the linked project and
  records them in its history.
- A schema or contract change that affects another project updates that consumer deliberately.
- Regenerate database types after a schema change that affects them, and check Edge Functions,
  tests, and consumers for compile errors. Generated type files change only through the generator.

## Database access

- `[api].schemas` in `config.toml` lists the schemas the Data API exposes, and each one is
  externally reachable. Every table in them has RLS and explicit grants for each role.
- Each policy chooses `TO anon`, `TO authenticated`, or `TO service_role` deliberately. The service
  role never stands in for precise grants or hides a missing policy.
- A table can skip the foreign key to `auth.users` so its history survives account deletion.
- Keep `[api].max_rows` conservative to bound accidental or malicious payloads.

## Storage

- Bucket definitions live in migrations and are mirrored in `config.toml`. A change to `public`,
  `file_size_limit`, or `allowed_mime_types` updates both in the same change.
- Bucket restrictions enforce file size and MIME type, not only application validation.
- RLS policies on `storage.objects` and `storage.buckets` control access. The `storage` schema is
  service-owned metadata: migrations add only policies, indexes for RLS or validation, triggers,
  and bucket configuration. Object rows change only through the Storage API.
- Storage objects are desired-state assets under the asset owner of their bucket, and replacing a
  file at the same key is normal. Upload tooling prunes nothing unless it says so, so a renamed or
  removed key deletes its stale remote object explicitly.
- Storage seed scripts verify that database rows and object keys agree when rows reference managed
  assets.

## Edge functions

- Each deployable function lives under `functions/<function-name>/` in the CLI's functions root,
  with a `[functions.<name>]` entry whose `entrypoint` is relative to the configuration file.
  Shared code lives in `functions/_shared/`, which Supabase never deploys.
- A function folder is kebab-case and names the callable operation, not its technology:
  `submit-order`, never `SubmitOrder` or `provider_handler`. The folder, configuration entry, and
  deployed name match.
- Edge Functions run on Deno, and the Deno rules hold.
- `verify_jwt` stays `true` for user-authenticated functions. With `verify_jwt = false`, the
  function is harmless and public, verifies a provider webhook signature, checks a
  service-to-service secret, or takes a Vault-backed bearer secret from cron.
- A publishable or secret API key is not a user JWT and never travels as
  `Authorization: Bearer <key>`. Forward the caller's `Authorization` header to the Supabase
  client, so RLS runs as the user.
- A service-role client serves only admin operations that cannot run as a user, on a path that
  code and tests make explicit.
- Keep handlers small: parsing, validation, responses, provider calls, and database operations move
  into local modules as complexity grows. JSON responses, `OPTIONS`, and CORS go through the shared
  helpers.
- Functions have runtime, CPU, memory, bundle-size, and log-rate limits, so long CPU-heavy work
  runs elsewhere. Raw Supabase errors that expose credentials stay out of logs.
- Unit tests cover function logic. Integration tests against a local database and function server
  cover the client, auth, RLS, and the invocation path.

## Configuration and secrets

- `config.toml` is the desired local and remote configuration. A change to signup, anonymous
  sign-in, providers, hooks, JWT expiry, or password policy needs explicit review.
- Service keys, Edge secrets, Vault values, database URLs, and provider API keys stay backend-only.
  They never appear in app code, checked-in files, logs, migration comments, tests, or test data.
- Local secrets live in ignored env files or the caller's environment. Deployment tooling syncs
  remote Edge Function and Vault secrets deliberately, and syncs an optional provider secret only
  when its variable is set.
- `pg_cron` and `pg_net` change only through migrations and deploy scripts. Cron reads its bearer
  tokens from `vault.decrypted_secrets` at call time, never from its SQL.
- A change to a cron target's auth updates the Vault secret, the function's check, and the cron
  SQL together.
- Weakening auth settings, RLS, grants, or `verify_jwt` needs a written reason.

## Change workflow

1. Read the owning migration, script, function, or test first.
2. Place the change: raw SQL owns schema, RLS, grants, triggers, functions, extensions, cron, and
   bucket settings. Generated migrations own large configuration data sets and canonical rows.
   Storage assets, configuration, Edge Function code, and deployment scripts own the rest.
3. Make the smallest durable change that preserves the ownership model, and regenerate derived
   files.
4. Run the checks of the repository over the staged files, and report any check you skipped.

## References

[Database migrations](https://supabase.com/docs/guides/deployment/database-migrations),
[row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Edge Functions](https://supabase.com/docs/guides/functions) and their
[auth](https://supabase.com/docs/guides/functions/auth) and
[configuration](https://supabase.com/docs/guides/functions/function-configuration),
[storage access control](https://supabase.com/docs/guides/storage/security/access-control), and
[scheduling functions](https://supabase.com/docs/guides/functions/schedule-functions).
