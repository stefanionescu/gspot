---
title: Postgres
---

# Postgres

Migrations, tables, row security, functions, grants, data migrations, and tests of a Postgres
database. Roles and schemas are the ones the application declares.

## Migrations

- Create a blank migration with the project's migration command, then edit the generated file.
- Repair migration history only when the user asks for that task.
- Every durable change is a migration, never a web console or SQL editor on a remote database.
- Use idempotent DDL only when repeated execution is a contract and existing definitions are
  verified. Do not hide schema drift with `IF NOT EXISTS`.

## Tables

- Use UUIDv7 keys when rows need time order.
- Timestamps are `TIMESTAMPTZ`. Mutable rows that need audit columns get `created_at` and
  `updated_at`, which the declared timestamp trigger or write owner updates.
- Index common filters, ordering columns, and frequent row security predicates.
- Durable invariants live in the database as generated columns, uniqueness, and check
  constraints, not only in client validation.

## Row-level security

- Fully qualify cross-schema references inside functions and policies.
- Every policy names its roles with `TO`, unless every role belongs in it.
- Wrap the identity function of an ownership check in a scalar subquery, so the planner evaluates
  it once per statement instead of once per row.
- `UPDATE` needs both a `SELECT` policy and an `UPDATE` policy.

| Operation   | Policy expression                                                               |
| ----------- | ------------------------------------------------------------------------------- |
| Read rows   | `USING` selects visible existing rows                                           |
| Insert rows | `WITH CHECK` validates the proposed row; an insert policy has no `USING` clause |
| Update rows | `USING` selects existing rows and `WITH CHECK` validates their new values       |
| Delete rows | `USING` selects rows that may be deleted                                        |

- Permissive policies broaden access and restrictive policies add conditions; review how every
  policy for the role combines.
- Check resource ownership and tenant membership. Check proposed values too, so an update cannot
  move a row into another user's or tenant's scope.
- Handle an unauthenticated identity explicitly, and limit anonymous access to the rows and
  operations meant to be public.
- Authorize from trusted claims and current membership data, never from user-editable template
  metadata, and account for stale claims after a membership change.
- Grants and RLS are separate controls: restrict table and schema privileges, then limit rows with
  policies. RLS does not cover `TRUNCATE`.
- A `USING (true)` policy fits only a table that is genuinely public or service-only, and the
  migration says why.
- A privileged service role still needs explicit table grants, never a bypass for precise ones.
- A view that clients can read sets `security_invoker = true` on Postgres 15 and later to respect
  the RLS of its tables. Otherwise, revoke access to it or keep it in a private schema.

## Functions and grants

- Functions are `SECURITY INVOKER`, the default. `SECURITY DEFINER` is for a function that must
  cross RLS or role boundaries, and its comment says why.
- Start every object from least privilege: `REVOKE ALL ON <object> FROM PUBLIC` and from broad roles.
- Grant execute with the full function signature, only to the roles that need it. A trigger
  function gets no direct execute grant.
- Grant schema usage only to roles that resolve objects in it, `SELECT` only for a real read path,
  and write access by column list.
- Avoid dynamic SQL. When it is required, quote identifiers and values safely and constrain the
  input domain.
- Raise exceptions with a meaningful SQLSTATE class when clients or tests branch on it.

## Data migrations

Durable rows live in migrations, not in seed files.

## Tests

- pgTAP tests cover schema, constraints, grants, triggers, RLS, functions, and other behavior a
  migration owns.
- Integration tests run against a local database and exercise client flows, auth, and RLS. They
  never mock grants or policies away, because the database boundary is what they verify.
- A schema change that another project consumes regenerates the types and updates the dependent
  tests.
