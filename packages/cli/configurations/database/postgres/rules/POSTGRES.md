# Postgres

Read this rule when you change Postgres migrations, policies, functions, grants, or database tests.

Use the roles and schemas the application declares.

## Migrations

- Create a blank migration with the command the project uses, then edit the generated file.
- Repair migration history only when the user asks.
- Make every durable change through a migration. Never use a web console or SQL editor on a remote database.
- Use idempotent data definition language (DDL) only when the public interface promises repeated execution and you verify existing definitions. Do not hide schema drift with `IF NOT EXISTS`.

## Tables

- Use UUIDv7 keys when rows need time order.
- Use `TIMESTAMPTZ` for timestamps. Mutable rows that need audit columns get `created_at` and
  `updated_at`, which the declared timestamp trigger or the writing code updates.
- Index common filters, ordering columns, and frequent row security predicates.
- Durable invariants live in the database as generated columns, uniqueness, and check
  constraints, not only in client validation.

## Row-level security

- Each policy names its roles with `TO`, unless all roles belong in it.
- Wrap the identity function of an ownership check in a scalar subquery, so the planner evaluates
  it once per statement instead of once per row.
- `UPDATE` needs both a `SELECT` and an `UPDATE` policy.

| Operation   | Policy expression                                                               |
| ----------- | ------------------------------------------------------------------------------- |
| Read rows   | `USING` selects visible existing rows                                           |
| Insert rows | `WITH CHECK` validates the proposed row; an insert policy has no `USING` clause |
| Update rows | `USING` selects existing rows and `WITH CHECK` validates their new values       |
| Delete rows | `USING` selects rows the role may delete                                        |

- Permissive policies broaden access and restrictive ones add conditions; review how all
  policies for the role combine.
- Check resource ownership and tenant membership. Check proposed values too, so an update cannot
  move a row into another user's or tenant's scope.
- Handle an unauthenticated identity explicitly, and limit anonymous access to the rows and
  operations the public API exposes.
- Authorize from trusted claims and current membership data, never from user-editable template
  metadata. Account for stale claims after a membership change.
- Grants and row level security (RLS) control access separately: restrict table and schema privileges, then limit rows with
  policies. RLS does not cover `TRUNCATE`.
- A `USING (true)` policy fits only a public or service-only table, and the
  migration says why.
- A privileged service role still needs explicit table grants, never a bypass for precise ones.
- A view that clients can read sets `security_invoker = true` on Postgres 15 and later to apply
  the RLS of its tables. Otherwise, revoke access to it or keep it in a private schema.

## Functions and grants

- Declare functions `SECURITY INVOKER`, the default. Use `SECURITY DEFINER` only for a function that must
  cross RLS or role boundaries, and its comment says why.
- Start every object from least privilege: `REVOKE ALL ON <object> FROM PUBLIC` and from broad roles.
- Grant execute with the full function signature, only to the roles that need it. A trigger
  function gets no direct execute grant.
- Grant schema usage only to roles that resolve objects in it, `SELECT` only for a real read path,
  and write access by column list.
- Avoid dynamic SQL. When the operation requires it, quote identifiers and values safely and constrain the
  input domain.
- Raise exceptions with a meaningful SQLSTATE class when clients or tests branch on it.

## Data migrations

Durable rows live in migrations, not in seed files.

## Tests

- pgTAP tests cover schema, constraints, grants, triggers, RLS, functions, and other behavior a
  migration owns.
- Integration tests run against a local database and exercise client flows, auth, and RLS. They
  never mock grants or policies away, because they verify the database behavior.
- A schema change that another project consumes regenerates the types and updates the dependent
  tests.

Name pgTAP files for the table or function under test.
