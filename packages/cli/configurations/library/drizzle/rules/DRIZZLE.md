---
title: Drizzle
---

# Drizzle

These rules cover Drizzle with PostgreSQL. Supabase connection modes and verified identity are
in the Supabase rules.

## Connections

Drizzle ORM, Drizzle Kit, and the driver stay on compatible pinned versions. The installed release's
column casing, relations, RLS, and configuration APIs are used throughout. The adapter matches the
driver: Postgres.js for `postgres`, node-postgres for `pg`.

Connection construction lives in a server module with a clear lifetime, marked `server-only` in
Next.js. Credentials, clients, and privileged query code stay out of browser imports, props, and
public environment variables. Standalone applications read the environment explicitly, and
schema declarations read none.

Connection, idle, and query timeouts are set. Connections are budgeted across every instance,
worker, and deployment. One bounded pool is reused, never a pool per request or development reload,
with request identity kept out of client state.

A short-lived script closes its connection in cleanup, and a shared pool is never closed after a
query. Certificate verification stays on. Transaction pooling moves transactions between server
connections, so a setting a query depends on stays inside its transaction and a notification
listener uses a persistent connection.

## Organize code and preserve contracts

<!-- level: all -->

Separate schema declarations, driver construction, domain operations, and migration execution into
directories that describe their responsibility. Keep a small schema together and split a larger one
by domain. Put each query beside the behavior it serves, named for its purpose, not in global
`insert`, `select`, `update`, and `delete` files.

After moving a schema file, run `drizzle-kit generate` and confirm that it proposes no unintended
drop or provider-owned object. Schema modules create no
connection, take no request, and run no migration. Operations that join a larger transaction take a
handle typed for the adapter. Row types come from `$inferSelect` and `$inferInsert`, and projected
results from the query. Public request and response schemas stay apart from persistence types,
because an inferred insert type authorizes no caller to set every column. Server runtime exports
stay apart from shared input schemas.

## Design the schema

Database constraints enforce what every writer depends on and protect against concurrent writes and
other clients. Application validation supplies useful errors
([constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)).

- Every entity has a primary key chosen for generation, storage, and distribution. Foreign
  keys point at a primary or unique key, and a required reference is non-null.
- One-to-one cardinality needs uniqueness on the referencing key, because a relation declared
  as `one` prevents nothing. Many-to-many uses a junction table with a composite key or unique
  pair.
- Tenant identity joins a constraint when a relationship must stay within one tenant. Each
  delete and update action follows the data's lifecycle with the full cascade checked.
- Store a changing fact once, and keep intentional historical snapshots such as an agreed
  price. Split values into fields the application validates, queries, or updates.
- Use JSON for flexible structure and columns for anything that needs foreign keys,
  uniqueness, or frequent filtering. Give a polymorphic reference a shared parent entity.
- State how soft deletion affects queries, uniqueness, relationships, and retention, with a
  partial unique index where uniqueness applies to active rows only.

### Column types, validation, defaults

| Value                            | Representation rule                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Integer identifiers and counters | Match the PostgreSQL range; JavaScript numbers only within the safe integer range                            |
| Large integers                   | `bigint` or a validated decimal string, with a defined API serialization                                     |
| Money and exact decimals         | `numeric` with suitable precision and scale, or bounded integer minor units, exact in application arithmetic |
| An instant                       | `timestamp with time zone` and one application representation                                                |
| A calendar date                  | `date`, preserved across time zones                                                                          |
| A local wall-clock appointment   | The local value plus the time-zone identifier when future zone rules matter                                  |
| Structured JSON                  | `jsonb` or `json` chosen deliberately, validated at untrusted entry points                                   |
| A fixed value set                | A PostgreSQL enum, check constraint, or reference table, by how the set changes                              |

`timestamp with time zone` keeps no named zone, and precision is checked when mapping into `Date` or
cursors. `$type<T>()`, text enum inference, and `sql<T>` describe TypeScript values and validate
nothing. External values are validated before writing, and decoding stays accurate for raw SQL,
aggregates, custom types, and views. A range pairs `NOT NULL` with a check constraint, because a
check evaluating to null rejects nothing.

Unique constraints choose their null behavior (`NULLS NOT DISTINCT` when nulls must conflict). SQL
null, an omitted field, and an explicit replacement stay distinct. A `pgEnum` is a database object.

Database defaults and triggers apply to every writer. `.default(...)`, `.defaultNow()`, and identity
or UUID defaults become database behavior through the migration. `$defaultFn()` and `$onUpdate()`
run only through Drizzle. If other code writes the table, make the update timestamp's behavior
explicit. When you write tests, cover both write paths.
Identifiers use a collision-resistant generator under a uniqueness constraint, and tokens use
cryptographic randomness ([column types](https://orm.drizzle.team/docs/column-types)).

Validators derive from `createInsertSchema`, `createUpdateSchema`, or `createSelectSchema`. They are
narrowed to the fields the caller may set, domain validation is added, and the parsed result is
passed on. A constructed validator validates nothing until called. Result validation matches the
selected columns, an absent row is handled before parsing, and field overrides and coercion stay
deliberate ([Zod integration](https://orm.drizzle.team/docs/zod)).

A generated column is deterministic and stays out of writable schemas, with its migration reviewed
for expression restrictions ([generated columns](https://orm.drizzle.team/docs/generated-columns)).
Use a custom type only when built-in mappings misrepresent the value. When you write tests, cover
its conversion through selects, writes, and nested results without converting a value twice through a driver codec
([custom types](https://orm.drizzle.team/docs/custom-types)).

## Define relations

Relations describe how queries assemble related objects; foreign keys and uniqueness enforce which
relationships are valid. Several links between the same tables get distinct names on their own
columns, and junction constraints survive an API that hides the junction. Relation filters are query
behavior rather than authorization. A non-null reference guarantees no visible row under RLS, soft
deletion, or a filter ([relations](https://orm.drizzle.team/docs/relations)).

## Write queries

Every query selects the columns the operation needs and returns a safe projection, nested relations
and views included. Resource and tenant restrictions live in the query or an enforced policy,
because a user-provided row ID establishes no permission. Page and nested collection sizes are
bounded. Ordering is deterministic with a unique tie-breaker, and growing histories use keyset
pagination. An optional filter applies by presence, because zero and false are valid input. An
absent row, an empty collection, an access denial, and a database failure stay distinct without
revealing private resource existence.

Predicates combine with `and()` and `or()`, because repeated `.where()` calls do not accumulate and
`.$dynamic()` relaxes typing without merging clauses. Data values bind through operators and the
`sql` template, and user-selected sort fields map to an allowlist. `sql.raw()` holds only small
trusted fragments ([SQL expressions](https://orm.drizzle.team/docs/sql)).

Each create and update operation has an explicit input schema. Ownership, tenant, role, and audit
fields come from verified server context, and `Partial<SelectRow>` is never a public update schema.
Updates and deletes are scoped to the authorized resource, and affected rows or a `returning`
projection are checked. An upsert ties to a deliberate unique constraint. Concurrent changes use
atomic expressions or a version predicate, and constraint errors map through their codes without
exposing raw SQL.

`.set()` ignores `undefined` and writes SQL null for `null`. Bulk sizes are bounded, an upsert batch
is deduplicated by its conflict key, and `onConflictDoNothing()` results are matched by stable keys
([inserts](https://orm.drizzle.team/docs/insert)). A query is prepared only when the measured
workload benefits and the pooler supports it.

## Use transactions

Every participating query takes `tx`, because a global client inside the callback runs outside the
transaction and its identity. All work is awaited before the callback returns. Transactions stay
short, with input prepared beforehand and network calls, user interaction, and provider work
outside. Isolation and locking follow the invariant: a unique constraint for uniqueness, an atomic
update for a counter, locking for a read-modify-write across rows.

Only serialization failures and deadlocks are retried, whole and bounded, with no irreversible
effect in the callback. Repeatable writes carry an idempotency key under a unique constraint.
External effects tied to a commit go through a durable job or outbox record. Invalidation and
success publish after commit ([transactions](https://orm.drizzle.team/docs/transactions)).

## Caching and replicas

Query caching needs a defined freshness and invalidation policy. Keys hold every value affecting the
result, including verified identity, because two users can share SQL and parameters while their
claims differ. Writes outside the cached client are invalidated, an expiry is defined, and
fill-write races are checked. Transaction reads stay out of caches that cannot preserve visibility
([caching](https://orm.drizzle.team/docs/cache)).

Replicas serve reads that tolerate delay. A read that must observe a preceding write uses
`$primary`, as does authorization that depends on current membership. A unit of work never splits
between them ([read replicas](https://orm.drizzle.team/docs/read-replicas)).

## Views and migrations

- Declare a raw SQL view's result columns with their actual types and nullability. Mark an
  externally managed view as existing.
- `drizzle-kit generate` produces migration files. `drizzle-kit migrate` applies the history, and
  `drizzle-kit pull` reads the database schema. Use `drizzle-kit push` only for disposable local
  experiments under the project's migration policy.
- After generating a migration, inspect its SQL for unintended drops, renames, conversions,
  nullability changes, constraints, RLS, grants, and external objects.
- Declare provider-managed roles as existing through `pgRole` rather than creating duplicate roles.
  A table's RLS declaration takes effect only when its migration is applied.

See [migrations](https://orm.drizzle.team/docs/migrations),
[views](https://orm.drizzle.team/docs/views), and
[RLS declarations](https://orm.drizzle.team/docs/rls).
