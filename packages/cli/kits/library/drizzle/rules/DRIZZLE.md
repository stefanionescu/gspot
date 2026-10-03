---
title: Drizzle
---

# Drizzle

Some sections name Supabase, the Postgres platform these rules were written against, whose
pooler, auth, and storage behavior change what is correct. On another Postgres, read them as the
shape of the problem.

## Connections

Drizzle ORM, Drizzle Kit, and the driver stay on compatible pinned versions. The installed
release's column casing, relations, RLS, and configuration APIs are used throughout. The
adapter matches the driver: Postgres.js for `postgres`, node-postgres for `pg`.

Connection construction lives in a server module with a clear lifetime, marked `server-only`
in Next.js. Credentials, clients, and privileged query code stay out of browser imports,
props, and public environment variables. The connection URL is validated before the driver is
created, and a missing variable is reported by name without its value. The environment is
read through the application's loader, explicitly in standalone Kit configuration. Schema
declarations load no environment. Only placeholder credentials are committed.

| Workload                                        | Connection choice                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| Short-lived serverless application requests     | Transaction pooler, with a compatible driver                          |
| Persistent server with direct network access    | Direct connection with a bounded application pool                     |
| Persistent server on an IPv4-only network       | Session pooler when the direct endpoint is unavailable                |
| Migrations, dumps, or session-dependent tooling | Direct connection; use a supported session alternative when necessary |

A separate migration credential holds schema privileges. The application role holds only
what runtime needs ([connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)).
Postgres.js under transaction pooling sets `prepare: false`, rechecked when the driver or
pooler changes. Connection, idle, and query timeouts are set. Connections are budgeted across
every instance, worker, and deployment. One bounded pool is reused, never a pool per request
or development reload, with request identity kept out of client state.

A short-lived script closes its connection in cleanup, and a shared pool is never closed after
a query. Certificate verification stays on. Transaction pooling moves transactions between
server connections, so a setting a query depends on stays inside its transaction and a
notification listener uses a persistent connection.

## Organize code and preserve contracts

<!-- level: all -->

Separate schema declarations, driver construction, domain operations, and migration execution
into directories that describe their responsibility. Keep a small schema together and split a
larger one by domain. Put each query beside the behavior it serves, named for its purpose,
not in global `insert`, `select`, `update`, and `delete` files.

Kit discovers every managed schema file, rechecked after moving files, because a missed
export proposes a drop and an unintended one proposes a provider-owned object. Schema
modules create no connection, take no request, and run no migration. Operations that join a
larger transaction take a handle typed for the adapter. Row types come from `$inferSelect`
and `$inferInsert`, and projected results from the query. Public request and response
schemas stay apart from persistence types, because an inferred insert type authorizes no
caller to set every column. Server runtime exports stay apart from shared input schemas.

## Design the schema

Database constraints enforce what every writer depends on and protect against concurrent
writes and other clients. Application validation supplies useful errors
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

`timestamp with time zone` keeps no named zone, and precision is checked when mapping into
`Date` or cursors. `$type<T>()`, text enum inference, and `sql<T>` describe TypeScript values
and validate nothing. External values are validated before writing, and decoding stays
accurate for raw SQL, aggregates, custom types, and views. A range pairs `NOT NULL` with a
check constraint, because a check evaluating to null rejects nothing.

Unique constraints choose their null behavior (`NULLS NOT DISTINCT` when nulls must
conflict). SQL null, an omitted field, and an explicit replacement stay distinct. A `pgEnum`
is a database object.

Database defaults and triggers apply to every writer. `.default(...)`, `.defaultNow()`, and
identity or UUID defaults become database behavior through the migration. `$defaultFn()` and
`$onUpdate()` run only through Drizzle, so an update timestamp defines both paths and each
writer is verified. Identifiers use a collision-resistant generator under a uniqueness
constraint, and tokens use cryptographic randomness ([column types](https://orm.drizzle.team/docs/column-types)).

Validators derive from `createInsertSchema`, `createUpdateSchema`, or `createSelectSchema`.
They are narrowed to the fields the caller may set, domain validation is added, and the
parsed result is passed on. A constructed validator validates nothing until called. Result
validation matches the selected columns, an absent row is handled before parsing, and field
overrides and coercion stay deliberate ([Zod integration](https://orm.drizzle.team/docs/zod)).

A generated column is deterministic and stays out of writable schemas, with its migration
reviewed for expression restrictions ([generated columns](https://orm.drizzle.team/docs/generated-columns)).
A custom type exists only when built-in mappings misrepresent the value. Its conversion is
verified through selects, writes, and nested results, with no double conversion with a driver
codec ([custom types](https://orm.drizzle.team/docs/custom-types)).

## Define relations

Relations describe how queries assemble related objects; foreign keys and uniqueness enforce
which relationships are valid. Several links between the same tables get distinct names on
their own columns, and junction constraints survive an API that hides the junction. Relation
filters are query behavior rather than authorization. A non-null reference guarantees no
visible row under RLS, soft deletion, or a filter ([relations](https://orm.drizzle.team/docs/relations)).

## Write queries

Every query selects the columns the operation needs and returns a safe projection, nested
relations and views included. Resource and tenant restrictions live in the query or an
enforced policy, because a user-provided row ID establishes no permission. Page and nested
collection sizes are bounded. Ordering is deterministic with a unique tie-breaker, and
growing histories use keyset pagination. An optional filter applies by presence, because zero
and false are valid input. An absent row, an empty collection, an access denial, and a
database failure stay distinct without revealing private resource existence.

Predicates combine with `and()` and `or()`, because repeated `.where()` calls do not
accumulate and `.$dynamic()` relaxes typing without merging clauses. Data values bind through
operators and the `sql` template, and user-selected sort fields map to an allowlist.
`sql.raw()` holds only small trusted fragments ([SQL expressions](https://orm.drizzle.team/docs/sql)).

Each create and update operation has an explicit input schema. Ownership, tenant, role, and
audit fields come from verified server context, and `Partial<SelectRow>` is never a public
update schema. Updates and deletes are scoped to the authorized resource, and affected rows or
a `returning` projection are checked. An upsert ties to a deliberate unique constraint.
Concurrent changes use atomic expressions or a version predicate, and constraint errors map
through their codes without exposing raw SQL.

`.set()` ignores `undefined` and writes SQL null for `null`. Bulk sizes are bounded, an upsert
batch is deduplicated by its conflict key, and `onConflictDoNothing()` results are matched by
stable keys ([inserts](https://orm.drizzle.team/docs/insert)). A query is prepared only when
the measured workload benefits and the pooler supports it.

## Use transactions

Every participating query takes `tx`, because a global client inside the callback runs
outside the transaction and its identity. All work is awaited before the callback returns.
Transactions stay short, with input prepared beforehand and network calls, user interaction,
and provider work outside. Isolation and locking follow the invariant: a unique constraint
for uniqueness, an atomic update for a counter, locking for a read-modify-write across rows.

Only serialization failures and deadlocks are retried, whole and bounded, with no
irreversible effect in the callback. Repeatable writes carry an idempotency key under a
unique constraint. External effects tied to a commit go through a durable job or outbox
record. Invalidation and success publish after commit
([transactions](https://orm.drizzle.team/docs/transactions)).

## Caching and replicas

Query caching needs a defined freshness and invalidation policy. Keys hold every value
affecting the result, including verified identity, because two users can share SQL and
parameters while their claims differ. Writes outside the cached client are invalidated, an
expiry is defined, and fill-write races are checked. Transaction reads stay out of caches that
cannot preserve visibility ([caching](https://orm.drizzle.team/docs/cache)).

Replicas serve reads that tolerate delay. A read that must observe a preceding write uses `$primary`, as
does authorization that depends on current membership. A unit of work never splits between
them ([read replicas](https://orm.drizzle.team/docs/read-replicas)).

## Indexes and views

Indexes follow predicates, joins, ordering, and volume, checked against the plan with
representative data. Primary keys and unique constraints already index their columns, and
PostgreSQL does not index the referencing side of a foreign key. Composite order matches
tenant restrictions, equality, range, and pagination, weighed against write cost.
`EXPLAIN ANALYZE` executes the statement, and `CREATE INDEX CONCURRENTLY` cannot run inside a
transaction block ([indexes](https://www.postgresql.org/docs/current/sql-createindex.html)).

A view selects its columns explicitly, never `select *`. A raw SQL view declares result
columns to match real types and nullability. An externally managed view is marked existing.
A view uses `security_invoker` to respect caller permissions through the table policies. A
materialized view is stored results with a freshness policy, a refresh owner, and separately
restricted access. Concurrent refresh needs a populated view and a qualifying unique index
([view security](https://supabase.com/docs/guides/database/postgres/row-level-security#views)).

## Manage migrations

One schema authority and one runner record applied migrations per database, visible in
configuration and tasks. `generate` produces files, `migrate` applies the history, `pull`
inspects a database, and `push` serves disposable local experiments only
([migrations](https://orm.drizzle.team/docs/migrations)). SQL, snapshots, and logs share one
format. When the Supabase CLI applies migrations, files take its format, and replay is
verified through it. One applied-history ledger is authoritative.

Remote application is a deliberate task, provider-managed schemas and roles are declared as
existing, and an existing database is baselined through the runner rather than `IF NOT EXISTS`
([migration history](https://supabase.com/docs/guides/local-development/database-migrations)).

A schema change generates the artifacts and inspects the SQL for unintended drops, renames,
type conversions, nullability, defaults, constraints, RLS, grants, and external objects. It
plans bounded backfills and updates the callers in the same change with no dual reads or
phased compatibility. It applies only when asked. Applied migrations are immutable. Policies,
grants, functions, and triggers are versioned rather than dashboard edits. Migrations run
outside imports, handlers, rendering, and builds, and seeds are deterministic without real
data.

## Row-level security and verified identity

The RLS contract of the database applies unchanged: RLS on every exposed table, `USING` for
visibility, `WITH CHECK` for proposed rows, explicit grants, and the `SECURITY DEFINER`
rules. A table declaration enables nothing until the migration says so. Superusers,
`BYPASSRLS` roles, and owners bypass policies, so tests run as the application's role.
Administrative access stays in separate operations. Provider roles are declared existing
under `pgRole`, and deployment creates the policy before exposing an operation
([RLS declarations](https://orm.drizzle.team/docs/rls)).

A direct connection carries no Supabase identity. Where the application passes identity into
PostgreSQL, one reviewed server operation verifies the token (issuer, signature, audience,
time) and maps it to a small set of allowed roles. It opens a transaction on the restricted
connection and sets claims with parameterized transaction-local `set_config` and a role from
fixed trusted SQL. Every protected query runs through that handle, and commit or rollback
ends the context, never cleanup SQL
([verified claims](https://supabase.com/docs/reference/javascript/auth-getclaims)). Tests
cover malformed and expired tokens, unexpected roles, two users, cross-tenant requests,
forced failures, and pool reuse.

## Verify database behavior

The behavior under change is verified with the affected schema and runtime role against an
explicit target. A remote migration or a shared reset is not a shortcut, and a present
`.where()` does not prove tenant isolation. Squawk is configured with the deployed PostgreSQL
version and the runner's transaction behavior, with any suppression scoped to the reviewed
operation. Reports say what ran and whether it passed. They hold no credentials.
