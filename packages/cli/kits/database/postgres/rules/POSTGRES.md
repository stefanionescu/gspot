---
title: Postgres
---

# Postgres

Migrations, tables, row security, functions, grants, data migrations, and tests of a Postgres
database. Roles and exposed schemas are the ones the application declares.

## Migrations

- Create a blank migration with the project's migration command, then edit the generated file.
  Timestamps stay chronological.
- A migration on the base branch or applied to any remote database is immutable: never rename,
  reorder, squash, split, or edit it. A production correction is a new forward-only migration.
- A migration that exists only on your local branch, unpushed and unreviewed, can change before
  merge, together with its paired generated sources.
- Repair migration history only when the user asks for that task.
- Every durable change is a migration, never a web console or SQL editor on a remote database.

### Migration structure

<!-- level: all -->

Every hand-written migration carries the header and section headings that the SQL documentation
check requires; this rule does not repeat its list. A comment block labels each important object,
and a descriptive comment sits within five lines above each `CREATE TRIGGER`.

```sql
-- ============================================================================
-- Table: orders
-- Purpose: Represents a submitted order owned by an account.
-- ============================================================================
CREATE TABLE commerce.orders (
    id UUID PRIMARY KEY
);
```

## Tables

- UUIDv7 primary keys fit when ordered identifiers suit the application. Use the generator of the
  deployed Postgres version or the one the application declares, and add a UUIDv7 check
  constraint. The example table takes its identifier from the caller.
- Timestamps are `TIMESTAMPTZ`. Mutable rows that need audit columns get `created_at` and
  `updated_at`, which the declared timestamp trigger or write owner updates.
- Plan for account deletion: a table can skip the foreign key to the user table so its history
  survives. Soft delete fits where the product relies on retained history.
- Index foreign keys, common filters, ordering columns, and frequent row security predicates.
- Durable invariants live in the database as generated columns, uniqueness, and check
  constraints, not only in client validation.

## Row-level security

- Enable row-level security (RLS) on every application table in an exposed schema. A table with
  RLS and no policy is unreachable through the API roles.
- A new table comes with `ENABLE ROW LEVEL SECURITY`, `REVOKE ALL` from broad roles, a `GRANT` for
  only the roles and columns needed, and policies for user-facing access.
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
- Authorize from trusted claims and current membership data, never from user-editable profile
  metadata, and account for stale claims after a membership change.
- Grants and RLS are separate controls: restrict table and schema privileges, then limit rows with
  policies. RLS does not cover `TRUNCATE`.
- A `USING (true)` policy fits only a table that is genuinely public or service-only, and the
  migration says why.
- A privileged service role still needs explicit table grants, never a bypass for precise ones.
- A view in an exposed schema sets `security_invoker = true` on Postgres 15 and later to respect
  the RLS of its tables. Otherwise, revoke access to it or keep it out of exposed schemas.

## Functions and grants

- Functions are `SECURITY INVOKER`, the default. `SECURITY DEFINER` is for a function that must
  cross RLS or role boundaries, and its comment says why.
- A `SECURITY DEFINER` function sets `search_path = ''` and fully qualifies every object.
- Start every object from least privilege: `REVOKE ALL ON <object> FROM PUBLIC` and from each API
  role.
- Grant execute with the full function signature, only to the roles that need it. A trigger
  function gets no direct execute grant.
- Grant schema usage only to roles that resolve objects in it, `SELECT` only for a real read path,
  and write access by column list.
- Roles that a platform creates for auth, cron, or storage stay scoped to the functions and
  schemas they need.
- Avoid dynamic SQL. When it is required, quote identifiers and values safely and constrain the
  input domain.
- Raise exceptions with a meaningful SQLSTATE class when clients or tests branch on it.

## Data migrations

Durable rows live in timestamped migrations, never in a seed file that a reset reapplies. A
generator emits a large or structured data migration from source data:

- Each generator stays paired with its emitted migration, which states its purpose.
- Relative imports stay inside the generator's own folder. Data from another generator is
  duplicated or promoted only for a clear ownership reason.
- Source constants stay separate from the code that composes SQL.
- Generated `UPDATE` and `DELETE` statements carry explicit `WHERE` conditions.
- Regenerate the SQL after changing its source, and check the drift during review.
- Once the emitted migration is immutable, a source change that alters it becomes a new
  migration.

Generated SQL follows the same naming and documentation rules as hand-written SQL.

## Tests

- pgTAP tests cover schema, constraints, grants, triggers, RLS, functions, and other behavior a
  migration owns.
- Integration tests run against a local database and exercise client flows, auth, and RLS. They
  never mock grants or policies away, because the database boundary is what they verify.
- A schema change that another project consumes regenerates the types and updates the dependent
  tests.
