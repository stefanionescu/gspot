---
title: Drizzle
---

# Drizzle

These decisions cover Drizzle with PostgreSQL. Use the adapter and APIs of the installed release.
Supabase connection and identity decisions remain in the Supabase rules.

## Connections and schema ownership

Construct one bounded server-side pool with a clear lifetime. Close a script's connection in
cleanup, not a shared pool after each query. Budget across instances and keep request identity
out of shared client state. Schema modules create no connection and run no migration.

Database constraints protect every writer. Inferred types, `$type<T>()`, and `sql<T>` validate
nothing at runtime. Relations assemble results; foreign keys and uniqueness enforce integrity.
Drizzle-only defaults and update callbacks do not cover another writer. Choose database defaults
or triggers when the contract must cover every write path.

See [column types](https://orm.drizzle.team/docs/column-types)
and [relations](https://orm.drizzle.team/docs/relations).

## Authorized operations

Select only the fields the caller may see. Apply resource and tenant restrictions in the query or
an enforced policy. A row identifier proves no permission, and an inferred insert type permits
fields a public request must not set. Keep public schemas apart from persistence types.

Scope writes to the authorized resource and verify affected rows. Bound growing collections and
use deterministic ordering with a unique tie-breaker. An absent filter differs from zero or false.
Use a version predicate or an atomic expression for concurrent updates.

See [queries](https://orm.drizzle.team/docs/select).

## Transactions and migrations

Pass `tx` to every participating operation and await it before the transaction returns. Keep
network calls and irreversible effects outside. Retry only bounded serialization failures or
deadlocks, and publish success or invalidation after commit. Use a durable outbox when an external
effect must follow the commit.

Review generated SQL for unintended drops, renames, constraints, grants, RLS, and provider-owned
objects. Keep one authoritative migration history; push schema changes only in disposable local
experiments. Reads that must observe a write or current permissions stay on the primary.

See [transactions](https://orm.drizzle.team/docs/transactions)
and [migrations](https://orm.drizzle.team/docs/migrations).
