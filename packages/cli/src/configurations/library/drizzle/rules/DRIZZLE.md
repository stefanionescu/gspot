# Drizzle

Read this rule when you change Drizzle schemas, queries, or migrations.

These decisions cover Drizzle with PostgreSQL. Use the adapter and APIs of the installed release. In a Supabase project, the
Supabase rule holds the connection and identity decisions.

## Connections and schema ownership

Construct one bounded server-side pool with a clear lifetime. Close a script's connection in cleanup, not a shared pool
after each query. Keep request identity out of shared client state. Create no connection and run no migration in a
schema module.

Inferred types, `$type<T>()`, and `sql<T>` validate nothing at runtime. Drizzle-only defaults and update callbacks do
not cover another writer. Choose database defaults or triggers when the contract must cover every write path.

## Authorized operations

Select only the fields the caller may see. Apply resource and tenant restrictions in the query or an enforced policy. A
row identifier proves no permission, and an inferred insert type allows fields a public request must not set. Keep
public schemas apart from persistence types.

Give every `update` and `delete` a `where` clause. The check covers the clients in `drizzle.client_names`, `db` by
default; add each other client or transaction name, such as `tx`.

Scope writes to the authorized resource and verify affected rows. Bound growing collections and use deterministic
ordering with a unique tie-breaker. An absent filter differs from zero or false. Use a version predicate or an atomic
expression for concurrent updates.

## Transactions and migrations

Pass `tx` to every participating operation and await it before the transaction returns. Keep network calls and
irreversible effects outside. Retry only bounded serialization failures or deadlocks, and publish success or
invalidation after commit. Use a durable outbox when an external effect must follow the commit.

After you change a schema, run `drizzle-kit generate`, and commit the migration it writes. Review generated SQL for
unintended drops, renames, constraints, grants, row-level security (RLS), and provider-owned
objects. Keep one authoritative migration history; push schema changes only in disposable local experiments. Keep reads
that must observe a write or current permissions on the primary.
