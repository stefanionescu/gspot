---
title: Supabase
---

# Supabase

Layout, database access, storage, Edge Functions, configuration, and secrets of a Supabase
project, on top of the Postgres rules. Supabase's API roles are `anon`, `authenticated`, and
`service_role`.

## Layout and migrations

- Use the established Supabase layout for migrations, Edge Functions, storage assets, and tests.
- A schema or contract change that affects another project updates that consumer deliberately.

## Database access

- `[api].schemas` in `config.toml` lists the schemas the Data API exposes. Treat those schemas as
  externally reachable.
- RLS with no policy denies access through the API roles. Use that choice for tables that clients
  must not read.
- Roles Supabase creates for auth, cron, or storage stay scoped to the functions and schemas they need.
- Each policy chooses `TO anon`, `TO authenticated`, or `TO service_role` deliberately. The service
  role never stands in for precise grants or hides a missing policy.
- A table can skip the foreign key to `auth.users` so its history survives account deletion.
- Keep `[api].max_rows` conservative to bound accidental or malicious payloads.

## Direct database connections

Choose the Supabase connection mode for the workload.

| Workload                                        | Connection choice                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| Short-lived serverless application requests     | Transaction pooler, with a compatible driver                          |
| Persistent server with direct network access    | Direct connection with a bounded application pool                     |
| Persistent server on an IPv4-only network       | Session pooler when the direct endpoint is unavailable                |
| Migrations, dumps, or session-dependent tooling | Direct connection; use a supported session alternative when necessary |

A separate migration credential holds schema privileges. The application role holds only what
runtime needs
([connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)). Postgres.js
uses the transaction pooler's supported configuration.
Connection, idle, and query timeouts are explicit. Budget connections across instances and
workers. With Postgres.js through transaction pooling, set `prepare: false` and confirm the setting
after a driver or pooler change.

A direct database connection carries no Supabase identity. When an application passes identity into
PostgreSQL, one server operation verifies the token's issuer, signature, audience, and expiry. It
maps the identity to a fixed set of allowed roles, then opens a transaction on a restricted
connection. Use parameterized transaction-local `set_config` for claims and fixed trusted SQL for
the role. Every protected query uses that transaction. Commit or rollback ends its context.

When Drizzle generates migrations that the Supabase CLI applies, keep the CLI's migration format
and one authoritative applied-history ledger. Declare provider-managed schemas and roles as
existing. Check replay through the chosen runner. See
[migration history](https://supabase.com/docs/guides/local-development/database-migrations) and
[verified claims](https://supabase.com/docs/reference/javascript/auth-getclaims).

## Storage

- Bucket definitions live in migrations and are mirrored in `config.toml`. A change to `public`,
  `file_size_limit`, or `allowed_mime_types` updates both in the same change.
- Bucket restrictions enforce file size and MIME type, not only application validation.
- RLS policies on `storage.objects` and `storage.buckets` control access. The `storage` schema is
  service-owned metadata: migrations add only policies, indexes for RLS or validation, triggers,
  and bucket configuration. Object rows change only through the Storage API.

### Storage names

<!-- level: all -->

Rules:

- Storage buckets use `lower_snake_case`.
- Storage object keys are stable and explicit.
- User-controlled key segments must be validated and bounded before use.
- Do not embed secrets, provider tokens, raw user text, or private identifiers in
  object keys.
- Do not use display text as storage identity.

| Avoid                                       | Prefer                                 | Meaning                              |
| ------------------------------------------- | -------------------------------------- | ------------------------------------ |
| `Avatar Pictures`                           | `avatar_images`                        | A bucket.                            |
| `avatars/john@example.com/avatar image.png` | `avatars/user_01hxx8j2r6/avatar.png`   | Object key without personal content. |
| `uploads/latest`                            | `reports/report_01hxx8j2r6/export.pdf` | A key tied to a specific report.     |

## Edge functions

- Each deployable function lives under `functions/<function-name>/` in the CLI's functions root,
  with a `[functions.<name>]` entry whose `entrypoint` is relative to the configuration file.
  Shared code lives in `functions/_shared/`, which Supabase never deploys.
- A function folder is kebab-case and names the callable operation, not its technology:
  `submit-order`, never `SubmitOrder` or `provider_handler`. The folder, configuration entry, and
  deployed name match.
- Edge Functions run on Deno, and the Deno rules hold.
- Keep `verify_jwt = true` for user-authenticated functions. Set it to `false` only when the function
  is public and harmless, verifies a provider webhook signature, checks a service secret, or takes
  a Vault secret from cron.
- A publishable or secret API key is not a user JWT and never travels as
  `Authorization: Bearer <key>`. Forward the caller's `Authorization` header to the Supabase
  client, so RLS runs as the user.
- A service-role client serves only admin operations that cannot run as a user, on a path that
  code and tests make explicit.
- Keep handlers small: parsing, validation, responses, provider calls, and database operations move
  into local modules as complexity grows. JSON responses, `OPTIONS`, and CORS go through one helper
  in `functions/_shared/`.
- Functions have runtime, CPU, memory, bundle-size, and log-rate limits, so long CPU-heavy work
  runs elsewhere. Raw Supabase errors that expose credentials stay out of logs.
- When you write tests, cover function logic in unit tests. Integration tests against a local
  database and function server cover the client, auth, RLS, and the invocation path.

## Configuration and secrets

- `config.toml` is the desired local and remote configuration. Ask the user before changing signup,
  anonymous sign-in, providers, hooks, JWT expiry, or password policy unless the task already
  authorizes it. Write the reason in the commit when a commit is authorized.
- Service keys, Edge secrets, Vault values, database URLs, and provider API keys stay backend-only.
  They never appear in app code, checked-in files, logs, migration comments, tests, or test data.
- Local secrets live in ignored env files or the caller's environment.
- `pg_cron` and `pg_net` change only through migrations and deploy scripts. Cron reads its bearer
  tokens from `vault.decrypted_secrets` at call time, never from its SQL.
- A change to a cron target's auth updates the Vault secret, the function's check, and the cron
  SQL together.
- Ask the user before weakening auth settings, RLS, grants, or `verify_jwt` unless the task already
  authorizes it. Write the reason in the commit when a commit is authorized.

## References

[Database migrations](https://supabase.com/docs/guides/deployment/database-migrations),
[row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Edge Functions](https://supabase.com/docs/guides/functions) and their
[auth](https://supabase.com/docs/guides/functions/auth) and
[configuration](https://supabase.com/docs/guides/functions/function-configuration),
[storage access control](https://supabase.com/docs/guides/storage/security/access-control), and
[scheduling functions](https://supabase.com/docs/guides/functions/schedule-functions).
