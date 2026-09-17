# Drizzle


Some sections below name Supabase, because it is the Postgres platform these rules were written
against and its pooler, auth and storage behaviour change what is correct. Those passages apply
when the project is on that platform. On any other Postgres, read them as the shape of the problem
and check your own platform's behaviour. Nothing here requires Supabase.

## Check versions and APIs

Read the manifest and lockfile before choosing a driver, schema API, or migration command. Record
which PostgreSQL version and runtime the application uses. Keep Drizzle ORM, Drizzle Kit, and the
driver on compatible, pinned versions. Install through the repository's Bun dependency setup and
commit manifest and lockfile changes together.

- Select a release deliberately. A documentation command containing `@rc` is not a reason to move an
  application to a release candidate. Review compatibility and migration changes before upgrading.
- Check the installed exports and types for column casing, relations, RLS, and configuration. APIs
  such as `getColumns` and `getTableColumns`, `defineRelations` and `relations`, and RLS enablement
  differ between releases. Use the API supported by the installed version throughout the operation.
- Choose the Drizzle adapter that matches the actual driver. A `postgres` client uses the
  Postgres.js adapter; a `pg` client uses the node-postgres adapter. Confirm connection and
  transaction support before selecting an HTTP driver or Edge runtime.
- Keep generated migrations, snapshots, and the journal in the format expected by the selected
  runner. Update them together during a Kit upgrade. Run migration replay only when requested.
- Use locally installed executables through the project's task runner. Hooks use those tools and
  do not fetch a new CLI version while checking a change.

## Configure connections

Keep connection construction in a server module with a clear lifetime. In Next.js, mark the runtime
database module with `server-only`. Keep database credentials, clients, and privileged query code
out of browser imports, props, and public environment variables.

Validate the connection URL before creating the driver. Report a missing variable by name without
printing its value. Read environment variables through the application's established loader. For
standalone Kit configuration and scripts, load the intended environment explicitly before
validation. Keep environment loading out of schema declarations. Commit placeholder credentials
only.

Choose a Supabase endpoint for the workload:

| Workload                                        | Connection choice                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| Short-lived serverless application requests     | Transaction pooler, with a compatible driver                          |
| Persistent server with direct network access    | Direct connection with a bounded application pool                     |
| Persistent server on an IPv4-only network       | Session pooler when the direct endpoint is unavailable                |
| Migrations, dumps, or session-dependent tooling | Direct connection; use a supported session alternative when necessary |

Verify the endpoint and network support in the project's connection settings. Use a separately
configured migration credential with the privileges needed for schema changes. Give the application
role only the privileges needed for runtime operations.
[Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).

- With Postgres.js and Supabase transaction pooling, set `prepare: false`. This disables prepared
  statements, not query prefetching. Recheck prepared-statement support when the driver or pooler
  changes. [Drizzle with Supabase](https://orm.drizzle.team/docs/connect-supabase).
- Set connection, idle, and query timeouts for the workload. Budget connections across all running
  instances, background workers, and deployments. A pool limit on one process is not a global limit.
- Reuse the process's bounded pool when the runtime permits it. Avoid creating a pool per request or
  multiplying pools during development reloads. Keep request identity out of reusable client state.
- Close short-lived script connections in their cleanup path. Do not close a shared application pool
  after each query. Ensure failed scripts release their connections and return a failure code.
- Keep certificate verification enabled for encrypted remote connections. Fix trust configuration
  instead of disabling verification to make a connection succeed.
- Transaction pooling can move successive transactions between server connections. Keep settings
  that a query depends on within its transaction. Use a supported persistent connection for
  operations that require session continuity, such as a long-lived notification listener.

## Organize database code

Separate schema declarations, driver construction, domain operations, and migration execution. Place
them in directories that describe their responsibility within the application.

- Keep a small schema together. Split a larger schema by domain or related tables when that makes
  relationships easier to find. Configure Kit to discover every managed schema file, and export
  every managed table, enum, sequence, view, and policy it needs.
- Inspect discovery after moving files. A missed schema export can make generation propose a drop;
  an unintended export can make it propose creating a provider-owned object.
- Keep schema modules free of connection creation, requests, environment loading, and migration
  execution. Kit needs to evaluate declarations without starting the application.
- Put each domain query beside the behavior it serves. Name operations for their purpose rather than
  collecting unrelated work in global `insert`, `select`, `update`, and `delete` files.
- Pass a database or transaction handle to operations that participate in a larger transaction. Keep
  the handle typed for the selected adapter and supported operations.
- Infer stored-row and insert types with `$inferSelect` and `$inferInsert` where those types fit.
  Keep them near their schema or consuming operation. Derive a projected result from the query when
  it differs from the full table shape.
- Define public request and response schemas separately from persistence types. An inferred insert
  type describes database inputs; it does not authorize a caller to set every available column.
- Keep server runtime exports separate from shared input schemas and type-only imports. A UI
  component can consume a safe result type without importing the database connection.

## Design the schema

Use database constraints to enforce the relationships and value rules that every writer depends on.
Application validation supplies useful errors; database constraints protect against concurrent
writes and alternate clients.

### Define keys and relationships

- Give each entity a primary key. Choose identity integers, UUIDs, or another supported identifier
  based on generation, storage, and distribution needs. An identity or serial generator does not
  replace a primary-key or unique constraint.
- Use foreign keys for relationships whose target belongs in the same database. Point them at a
  valid primary or unique key. Make a required reference non-null.
- Enforce one-to-one cardinality with uniqueness on the referencing key. A relation declared as
  `one` does not prevent several rows from referring to the same parent. An optional child can still
  be absent even when its own parent reference is required.
- For many-to-many relationships, use a junction table with foreign keys and a composite primary key
  or unique constraint on the pair. A separate surrogate ID does not replace pair uniqueness.
- Include tenant identity in constraints when a relationship needs to remain within one tenant. For
  example, a composite foreign key can reference a unique tenant-and-resource pair. Validate
  membership as well as resource identity in the application.
- Choose each delete and update action from the data's lifecycle. Use cascading deletion for
  dependent data that should disappear with its parent. Preserve or restrict deletion of records
  with an independent retention requirement. Check the full cascade before enabling it.
- Give important constraints stable, descriptive names so errors and migrations identify the rule
  that failed.
  [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).

### Preserve domain facts

- Store a fact once when several records refer to the same changing fact. Use related tables to
  avoid independently updating copies of names, memberships, or configuration.
- Preserve intentional historical snapshots. A price agreed for an order or an address captured for
  a shipment has different meaning from the current product price or customer address.
- Split values into fields when the application needs to validate, query, or update their parts.
  Choose that structure from actual data meaning. Avoid assuming that a postal code uniquely
  determines a city or that every country shares one address format.
- Use JSON for data whose flexible structure serves the feature. Keep values that need foreign keys,
  uniqueness, or frequent relational filtering in suitable columns or related tables.
- Define how a polymorphic reference remains valid. A generic target type and target ID cannot use
  an ordinary foreign key to reference several tables. Prefer a shared parent entity or explicit
  constrained references when those designs fit the domain.
- State how soft deletion affects queries, uniqueness, relationships, and retention. Keep active-row
  predicates consistent. Choose a partial unique index when uniqueness applies only to active rows.

## Choose column types and defaults

Choose a PostgreSQL type from the value's range and meaning. Then choose a driver representation
that preserves it through queries, application logic, and serialization.

| Value                               | Representation rule                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Integer identifiers and counters    | Match the PostgreSQL range; use JavaScript numbers only within the safe integer range                                         |
| Large integers                      | Keep `bigint` or a validated decimal string; define how the API serializes it                                                 |
| Money and exact decimals            | Use `numeric` with suitable precision and scale, or bounded integer minor units; preserve exactness in application arithmetic |
| Approximate measurements            | Use floating-point types when approximation is acceptable                                                                     |
| An instant, such as creation time   | Use `timestamp with time zone` and a consistent application representation                                                    |
| A calendar date, such as a birthday | Use `date`; preserve it as a calendar date across time zones                                                                  |
| A local wall-clock appointment      | Store the local value and the relevant time-zone identifier when future zone rules matter                                     |
| Structured JSON                     | Choose `jsonb` or `json` deliberately and validate the stored shape at untrusted entry points                                 |
| A fixed database value set          | Choose a PostgreSQL enum, check constraint, or reference table based on how the set changes                                   |

PostgreSQL `timestamp with time zone` represents an instant; it does not retain the original named
time zone. Store that name separately when the feature needs it. Check precision when mapping a
database timestamp into JavaScript `Date`, and keep exact cursor values when pagination depends on
finer precision.
[PostgreSQL date and time types](https://www.postgresql.org/docs/current/datatype-datetime.html).

### Distinguish types from validation

- `$type<T>()`, text enum inference, and `sql<T>` annotations describe TypeScript values. They do
  not validate database content or convert a driver's runtime result into that type.
- Validate external JSON and values before writing them. Use database checks for required stored
  guarantees. Keep result decoding accurate for raw SQL, aggregates, custom types, and views.
- Use `NOT NULL` for required values. Pair it with a check constraint when the field also needs a
  range or other predicate. A check that evaluates to SQL null does not reject a null value.
- Choose null behavior for unique constraints explicitly. Ordinary PostgreSQL uniqueness permits
  multiple null values. Use supported `NULLS NOT DISTINCT` semantics when nulls need to conflict.
- Keep SQL null, an omitted update field, and an explicit replacement value distinct. Reject an
  empty patch when the operation needs at least one change.
- A PostgreSQL enum declared through `pgEnum` is a database object. Apply the TypeScript ban on
  language `enum` declarations to TypeScript source; choose database enum usage by schema needs.

### Put defaults at the correct layer

Use database defaults or triggers when the behavior needs to apply to every writer, including SQL
scripts, Supabase API calls, and administrative tools.

- `.default(...)`, `.defaultNow()`, and supported identity or UUID defaults produce database
  behavior when represented in the migration. Inspect the emitted SQL.
- `$defaultFn()` and `$onUpdate()` run through Drizzle ORM. They do not create database defaults or
  update triggers. Define whether timestamps, generated values, and counters need to work outside
  Drizzle before choosing them.
- Define both insert and update behavior for an update timestamp. Verify an insert that omits it and
  an update made through each supported writer.
- Share column helpers only when their types, defaults, and nullability have the same meaning. Keep
  table-specific constraints visible at the table declaration.
- Use a collision-resistant identifier generator and enforce uniqueness. Use cryptographically
  secure randomness for security tokens. Keep `Math.random()` out of token generation.

See [Drizzle column types and defaults](https://orm.drizzle.team/docs/column-types).

### Derive runtime validators

Use the installed Drizzle validation integration to derive structural checks when that avoids
duplicating column definitions. Match its import path and Zod version to the installed release.

- Choose `createInsertSchema`, `createUpdateSchema`, or `createSelectSchema` for the operation.
  Narrow generated input schemas to the fields the caller may set, then add domain validation.
- Parse incoming values and pass the parsed result to the database operation. Constructing a
  validator without calling it does not validate input.
- Match result validation to the selected columns. A full-table select schema cannot validate a
  projection that intentionally omits required columns. Handle an absent row before parsing it.
- Check field overrides carefully. Replacing a generated field schema can replace its nullability
  and optionality; callback refinements and replacements have different effects.
- Keep coercion deliberate. Define accepted date, numeric, and boolean input formats rather than
  enabling broad coercion to make invalid requests pass.

See [Drizzle Zod integration](https://orm.drizzle.team/docs/zod).

### Define generated columns and custom types

Use a database-generated column when a value should be computed from the row by PostgreSQL. Verify
the installed Drizzle API and PostgreSQL version support the expression and storage mode.

- Keep generated fields out of writable request schemas. A generated expression has different
  behavior from an insert default or an ORM callback.
- Review the emitted migration when adding or changing `.generatedAlwaysAs(...)`. Check expression
  restrictions, existing-row behavior, dependencies, and index changes before applying it.
- Keep SQL expressions deterministic within the database's generated-column requirements. Use
  another mechanism when the value depends on a subquery or external service.

See [Drizzle generated columns](https://orm.drizzle.team/docs/generated-columns) and
[PostgreSQL generated-column requirements](https://www.postgresql.org/docs/current/ddl-generated-columns.html).

Use a custom type only when built-in types and mappings do not represent the value correctly. Define
the SQL type, application value, and driver value separately.

- Implement supported `toDriver`, `fromDriver`, or codec behavior for the actual conversion. Keep
  SQL type configuration under application control.
- Verify round trips through ordinary selects, writes, and nested relational results. JSON-based
  result assembly can use a different conversion path from a direct column read.
- Check precision, null values, invalid input, and serialization through the public API. Prevent
  double conversion when both a driver codec and a column mapping are active.
- Add required extensions or database types through migrations before using the custom column. A
  TypeScript mapping alone does not install a PostgreSQL type.

See [Drizzle custom types](https://orm.drizzle.team/docs/custom-types).

## Define relations

Use Drizzle relations to describe how queries assemble related objects. Define database foreign keys
and uniqueness separately to enforce which relationships are valid.

- Match the relation's source and target columns to their domain meaning. Give multiple links
  between the same tables distinct names, such as author and reviewer. Verify that each relation
  uses its own foreign-key column.
- Keep nullable results accurate. A non-null reference does not guarantee a visible related row when
  RLS, soft deletion, or a relation filter can hide it. Use required-relation typing only when the
  query's full behavior guarantees a result.
- Use junction-table relationships for many-to-many reads. Keep the junction constraints even when a
  relation API hides the junction from the returned shape.
- Treat predefined relation filters as query behavior. Keep authorization checks at the operation
  and database policy that enforce them for all callers.
- When splitting relation declarations, follow the installed release's composition rules. Check that
  combining parts preserves all intended tables and links instead of overwriting a table's
  configuration. Verify inference and representative nested queries after a split.
- Select and limit related collections deliberately. A nested query that uses one SQL statement can
  still scan many rows, produce large JSON results, or repeat expensive work.

See [Drizzle relations](https://orm.drizzle.team/docs/relations).

## Write queries

Choose SQL-like or relational queries according to the required result. Keep predicates,
projections, ordering, and result handling explicit enough to review the generated SQL.

### Read only the required data

- Select the columns the operation needs. Return a safe projection to clients instead of spreading
  every table column into a response. Apply the same rule to nested relations and views.
- Put resource and tenant restrictions in the query or enforced database policy. A user-provided row
  ID alone does not establish permission to read it.
- Bound page sizes and nested collection sizes. Validate page and cursor input before calculating
  limits. Use deterministic ordering with a unique tie-breaker.
- Use offset pagination for bounded results or deliberate page-number navigation. Use keyset
  pagination for growing histories and large ordered collections. Keep filters, sort directions,
  null ordering, and cursor comparison consistent.
- Add an optional filter by checking whether it is present. A numeric maximum of zero or a boolean
  value of false can be valid input. Do not drop those filters through truthiness checks.
- Define whether text search treats `%` and `_` as wildcards. Escape them when the input represents
  a literal pattern. Parameterization protects SQL syntax but does not change wildcard behavior.
- Handle join multiplicity and nullability. A left join can produce no child; joining several child
  collections can multiply rows and inflate counts. Count the intended entity and verify aggregates
  with missing and repeated relationships.
- Distinguish an absent row, an empty collection, an access denial, and a database failure. Map them
  to the operation's documented outcomes without revealing private resource existence.

### Compose queries safely

Build reusable predicates from typed SQL expressions. Keep mandatory access restrictions visible
where the final query is assembled.

- Combine predicates explicitly with `and()` and `or()`. Do not assume repeated `.where()` calls
  accumulate conditions. A query helper must preserve tenant and resource restrictions.
- Use `.$dynamic()` when a helper needs to extend a query builder. It relaxes builder typing; it
  does not automatically merge clauses or make a mutable builder safe to share between requests.
- Keep helper inputs and results typed with the installed dialect's query-builder types. Preserve
  changes to the selected shape when a helper adds joins or fields.
- Create builders for the current operation. Avoid storing a mutable, request-filtered builder in a
  shared module. Inspect the completed SQL when several helpers contribute clauses.

See [Drizzle dynamic query building](https://orm.drizzle.team/docs/dynamic-query-building).

Use a subquery or common table expression (CTE) to name a meaningful intermediate result. Give SQL
expressions an `.as(...)` alias when an outer query needs to reference them. Keep aliases consistent
with the selected fields; fix a `DrizzleTypeError` instead of casting it away. Confirm grouping and
ordering at the query level where they determine the result.
[Drizzle subqueries and CTEs](https://orm.drizzle.team/docs/select#with-clause).

### Parameterize values and restrict dynamic SQL

Use Drizzle operators and the `sql` template to bind data values. Build optional predicates from
typed expressions. Map user-selected sort fields to an allowlist of known columns and directions.

- Keep user strings, claims, and serialized JSON out of `sql.raw()`. Pass them as bound values.
- SQL identifiers are not ordinary value parameters. Choose tables, columns, role names, and SQL
  keywords from trusted application definitions; do not accept arbitrary identifier text.
- Use `sql.raw()` only for trusted SQL whose structure is controlled by the application. Keep the
  fragment small and explain why the query builder cannot express it.
- Use runtime decoding or the driver's supported mapping when an expression returns a different
  representation from the one the application needs. A generic annotation alone does not convert a
  string count into a number.

See [Drizzle SQL expressions](https://orm.drizzle.team/docs/sql).

### Restrict writes to the operation

- Define an explicit input schema for each create and update operation. Allow callers to set only
  the fields the operation exposes. Derive ownership, tenant, role, and audit fields from verified
  server context.
- Avoid accepting `Partial<SelectRow>` as a public update schema. It can expose IDs, ownership,
  counters, generated fields, and other server-controlled values.
- Scope updates and deletes to the authorized resource. Treat an absent `where` clause as an
  explicit bulk operation with its own restricted caller and bounded impact.
- Check the affected rows or a suitable `returning` projection. Handle a row that disappeared or
  changed since the caller read it. Do not report success merely because the query completed.
- Tie an upsert to a deliberate unique constraint. Define which fields may change on conflict and
  retain tenant restrictions on that path. Handle uniqueness failures without exposing private data
  from another row.
- Use atomic expressions or a version predicate for concurrent changes. Avoid reading a counter into
  JavaScript and writing it back when another request can change it in between.
- Map expected constraint errors through their structured codes and constraint names. Keep raw SQL,
  parameters, and database diagnostics out of public errors.

### Handle patches and bulk writes

In Drizzle updates, `.set()` ignores `undefined` values; passing `null` writes SQL null. Keep that
distinction in request parsing and field mapping. Decide whether omitted fields may still receive an
ORM update callback, and reject patches that do not represent a supported operation.
[Drizzle update values](https://orm.drizzle.team/docs/update).

- Bound bulk insert and upsert sizes by parameter limits, payload size, memory, and transaction
  duration. Define whether all batches succeed together or whether partial progress is allowed.
- Deduplicate an upsert batch by its conflict key before execution, using an explicit rule for
  competing inputs. Keep that key consistent with the database constraint.
- Handle `onConflictDoNothing()` as a skipped insert. Its `returning` result may contain fewer rows
  than the input. Match results by stable keys instead of pairing arrays by position.
- Distinguish the conflict-target predicate from the condition that allows an existing row to be
  updated. Use the installed API for each; preserve access restrictions on the update path.

See [Drizzle inserts and conflict handling](https://orm.drizzle.team/docs/insert).

### Reuse prepared queries

Prepare a query when repeated execution benefits the measured workload and the driver and pooler
support it. Follow the [connection rules](#configure-connections) before enabling named prepared
statements.

- Put changing values in supported `sql.placeholder(...)` parameters. Pass each request's values at
  execution time, including tenant and resource restrictions.
- Give named statements stable names for stable SQL shapes. Avoid reusing a name for different
  statements or creating unbounded names from user input.
- Keep a prepared query tied to the correct client and lifetime. A query prepared on a global client
  does not inherit another handle's transaction or RLS identity. Execute protected work through the
  handle that owns its verified context.
- Measure execution and planning costs. Preparation does not remove the need for suitable indexes,
  bounded results, or correct authorization.

See [Drizzle prepared queries and placeholders](https://orm.drizzle.team/docs/perf-queries).

## Use transactions

Group changes that need to succeed or fail together in a database transaction. Pass the transaction
handle through every operation in that unit of work.

- Use `tx` for every participating query. Calling a shared global client inside the callback can run
  work outside the transaction and outside its request identity.
- Await all database work before the callback returns. Do not let background promises escape the
  transaction or assume parallel queries share a single connection safely.
- Keep transactions short. Prepare input before opening one, and keep network calls, user
  interaction, and long-running provider work outside it.
- Choose isolation and locking from the concurrency invariant. Use a unique constraint for
  uniqueness, an atomic update for a counter, and appropriate locking or isolation for a
  read-modify-write operation that spans rows.
- Retry only failures whose outcome and driver behavior make retry safe. Retry the whole transaction
  for a retryable serialization failure or deadlock, with a bounded attempt count. Keep retry
  callbacks free of irreversible external side effects.
- Use an idempotency key when a caller can repeat a write. Persist its outcome under a unique
  constraint. For external effects tied to a commit, use a durable job or outbox record written in
  the transaction, then process it with duplicate handling.
- Publish cache invalidation and success only after commit. A database rollback does not reverse an
  email, provider charge, or already published message.
- Use the selected driver's supported rollback and savepoint behavior. Do not catch a failed SQL
  statement and continue an aborted transaction as though it remained usable.

See [Drizzle transactions](https://orm.drizzle.team/docs/transactions).

## Control query caching

Enable Drizzle query caching only for operations with a defined freshness and invalidation policy.
Coordinate database cache invalidation with application caches.

- Inspect the installed cache adapter's keys and supported query paths. Include every value that
  affects the result, including verified identity when results depend on it.
- For RLS-backed reads, verify identity isolation explicitly. SQL and bound parameters can be
  identical for two users while transaction claims differ. Keep shared caching disabled for that
  path unless its keys and authorization preserve isolation.
- Handle invalidation for writes outside the cached client, including raw SQL, transactions,
  Supabase API calls, triggers, and administrative tools. Check adapter support for relational
  queries and views rather than assuming every query participates.
- Invalidate committed data and define an expiry as a fallback. Check races between a cache fill and
  a write. Keep transaction reads out of caches that cannot preserve transaction visibility.
- Verify result serialization, cache failure behavior, and permission changes with two users.

Apply the application's identity and invalidation requirements when reviewing the adapter's
documented behavior. See [Drizzle caching](https://orm.drizzle.team/docs/cache).

## Read from replicas

Use read replicas for operations that tolerate replication delay. Keep writes and reads requiring
the latest committed state on the primary database.

- With `withReplicas()`, inspect which operations the installed adapter sends to replicas. Use
  `$primary` or the primary handle for reads that must observe a preceding write.
- Keep authorization decisions that require current membership or revocation state on a suitable
  authoritative path. A stale replica can retain access data after it changes on the primary.
- Execute every statement in a transaction through its transaction handle. Do not split a unit of
  work between the primary and an independently selected replica.
- Verify schema rollout, roles, extensions, and connection limits for each endpoint. Define how
  replica failure affects the operation and whether fallback load is safe for the primary.
- Test a write followed immediately by a read, delayed replication, and replica failure. Include
  cache behavior when a replica result can populate a cache.

See [Drizzle read replicas](https://orm.drizzle.team/docs/read-replicas).

## Design indexes

Build indexes from query predicates, joins, ordering, and expected data volume. Inspect the actual
query plan before adding an index to solve a performance problem.

- Account for indexes created by primary keys and unique constraints. Avoid adding another index
  with the same columns and order without a measured reason.
- PostgreSQL does not automatically index the referencing side of every foreign key. Consider those
  indexes for joins, child lookups, and parent deletion checks.
- A junction primary key on `(user_id, group_id)` already supplies an index for that ordered pair.
  Evaluate an index beginning with `group_id` for reverse lookups. Do not automatically add both
  single-column indexes and another copy of the pair index.
- Match composite index order to the workload. Consider tenant restrictions, equality predicates,
  range predicates, and pagination ordering together. Verify the plan with realistic selectivity.
- Use partial and expression indexes only when queries use compatible predicates and expressions.
  Include RLS predicates in performance review because they contribute to the executed query.
- Measure read benefit against write cost, storage, and maintenance. A single SQL statement is not
  proof of efficient execution.
- Inspect a plan with representative data. `EXPLAIN ANALYZE` executes the statement; use isolated
  data for writes and account for triggers or external effects before running it.
- Plan large index builds around locking and the migration runner. PostgreSQL
  `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. Verify runner support and
  recovery from a failed concurrent build before deploying it.

See [PostgreSQL index creation](https://www.postgresql.org/docs/current/sql-createindex.html).

## Define views

Use a view for a reusable database projection or query. Select its columns explicitly, including
when a query builder infers the view's TypeScript shape.

- Review access to sensitive columns before granting access to a view. A convenient `select *` can
  include credentials, internal flags, or new columns that were never intended for callers.
- For raw SQL views, declare result columns to match the SQL's real types and nullability. A
  TypeScript declaration does not add a constraint to the underlying data.
- Mark externally managed views as existing where the installed Drizzle API supports it. Keep their
  creation and changes with their actual migration owner.
- Check the privileges used to access underlying tables. For a view intended to respect caller
  permissions and RLS, use supported `security_invoker` behavior and verify the caller's grants.
  This uses underlying table policies; it does not create row policies on the view itself.
- Treat a materialized view as stored results with a freshness policy. Define who refreshes it, when
  consumers may read it, and what happens if refresh fails. Restrict access to the stored results
  independently of the query that populated them.
- Use concurrent refresh only when PostgreSQL's requirements are met, including a populated view and
  a qualifying unique index. Coordinate refresh attempts for the same view.

See
[Supabase view security](https://supabase.com/docs/guides/database/postgres/row-level-security#views)
and
[PostgreSQL materialized view refresh](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html).

## Manage migrations

Choose one schema authority and one runner that records applied migrations for each database. Keep
that choice visible in the configuration and executable tasks.

### Choose the migration authority

| Approach                                | Responsibility                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| Drizzle schema defines the database     | Generate reviewed SQL from the schema and apply it with the selected runner          |
| SQL migrations define the database      | Apply reviewed SQL and regenerate or reconcile Drizzle declarations from that schema |
| An external system manages some objects | Reference those objects without taking over their creation or deletion               |

Use `drizzle-kit generate` to generate migration files, `migrate` to apply the selected Drizzle
history, and `pull` to inspect a database into declarations. Use `push` for deliberate schema
experiments on disposable local databases. Deliver shared-environment changes as reviewed,
version-controlled migrations.
[Drizzle migration approaches](https://orm.drizzle.team/docs/migrations).

- Configure the dialect, schema discovery, output directory, and target environment explicitly. Keep
  configuration secrets out of version control and command output.
- Keep SQL, snapshots, and journals together in the format required by the installed Kit release. Do
  not mix artifacts from different migration formats or delete snapshots to force a clean diff.
- When Supabase CLI applies migrations, produce files in the format and naming convention it
  accepts. Drizzle's output directory alone does not make its migration history compatible with
  Supabase's. Use a deliberate generation or conversion step and verify replay through Supabase.
- Keep one applied-history ledger authoritative. Do not alternate Drizzle `migrate` and
  `supabase db push` against the same change set as interchangeable runners.
- Review the selected Supabase project and pending migration list before remote application. Keep
  remote migration execution in a deliberate task, separate from ordinary lint hooks.
- Preserve Supabase-managed schemas, roles, and objects, including authentication infrastructure.
  Scope schema discovery and role management to the application's objects. Use supported existing
  object declarations or provider helpers for references, and inspect the resulting SQL.
- Establish a baseline for an existing database by comparing its real schema with the intended
  history. Record the baseline through the runner's supported process. Do not comment out failed
  creates or add `IF NOT EXISTS` broadly to hide an unexplained mismatch.

See [Drizzle configuration](https://orm.drizzle.team/docs/drizzle-config-file) and
[Supabase migration history](https://supabase.com/docs/guides/local-development/database-migrations).

### Review and apply schema changes

1. Update the schema or authoritative SQL and generate the required artifacts with installed tools.
2. Inspect the SQL for unintended drops, rename detection, type conversions, nullability, defaults,
   constraints, RLS, grants, and changes to externally managed objects.
3. Plan data movement. For populated tables, backfill and validate values before enforcing a new
   requirement. Use bounded batches when a single update would hold locks for too long.
4. Update affected application callers for the new schema in the same change. Do not add dual
   reads, dual writes, phased compatibility releases, or support for the old schema.
5. Apply the migration only when migration execution is requested. Use the selected runner and
   report its result. Run replay or application checks only when those checks are requested.

Move required data directly to the new schema. Coordinate the schema and application change as one
cutover rather than keeping old and new implementations running together. Do not discard required
records to avoid writing the data migration.

- Keep applied migrations immutable. Correct a deployed schema with a new migration. Resolve
  divergent unpublished migration histories before application, preserving the runner's ordering and
  metadata requirements.
- Include policies, grants, functions, triggers, and custom SQL in versioned changes. A dashboard
  edit that is absent from history cannot be reproduced by a fresh environment.
- Keep migrations out of module imports, request handlers, Server Component rendering, and ordinary
  application builds. Coordinate deployment migration execution so several instances do not race.
- Use custom SQL where the schema generator cannot express the required database operation. Keep
  that SQL in the same reviewed migration history and check future diffs for conflicting changes.
- Separate disposable seed data from production reference-data migrations. Keep development seeds
  deterministic and free of real user data or production credentials.

## Enforce row-level security

Row-level security (RLS) restricts which rows a database role can access. Define the runtime role,
table grants, policies, and verified request identity together.

- Enable RLS for application tables exposed through Supabase's Data API. When creating tables
  through SQL or Drizzle, inspect the migration for actual RLS enablement and policies.
- Test with the role the application uses. Superusers and roles with `BYPASSRLS` bypass row
  policies; table owners normally bypass them too. A successful test as an administrative role does
  not establish protection for application access.
- Keep administrative access in separate, explicit operations. A policy naming a service role does
  not remove that role's bypass privileges.
- Treat SQL grants and RLS as separate controls. Restrict table and schema privileges, then use
  policies to limit rows. RLS does not cover every operation, including `TRUNCATE`.
- With RLS enabled and no applicable policy, ordinary row access is denied. Check that deployment
  creates the intended policy before exposing a new operation.

See [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

### Define the policy for each operation

| Operation   | Policy expression                                                               |
| ----------- | ------------------------------------------------------------------------------- |
| Read rows   | `USING` selects visible existing rows                                           |
| Insert rows | `WITH CHECK` validates the proposed row; an insert policy has no `USING` clause |
| Update rows | `USING` selects existing rows and `WITH CHECK` validates their new values       |
| Delete rows | `USING` selects rows that may be deleted                                        |

Check related select permissions for updates, deletes, upserts, and `RETURNING`. Review how all
applicable policies combine: permissive policies can broaden access, while restrictive policies add
conditions.
[PostgreSQL policy semantics](https://www.postgresql.org/docs/current/sql-createpolicy.html).

- Validate both resource ownership and tenant membership. Prevent an update from moving a row into
  another user's or tenant's scope by checking its proposed values.
- Handle unauthenticated identity explicitly. Keep unauthenticated access limited to the rows and
  operations intended to be public.
- Base authorization on trusted claims and current membership data. Keep user-editable profile
  metadata out of privilege decisions. Account for stale token claims after membership changes.
- Scope role generation carefully when using `pgRole` and Kit role management. Mark provider roles
  as existing through the installed API and inspect additions after provider or Kit upgrades.
- Review security-definer functions separately: restrict who can execute them, control their search
  path, and give them only the authority needed for the operation.

See [Drizzle RLS declarations](https://orm.drizzle.team/docs/rls) and
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Use verified identity in a transaction

A direct PostgreSQL connection does not automatically receive the Supabase user's identity. If the
application passes identity into PostgreSQL, keep that bridge in one reviewed server operation.

1. Verify the access token with the supported Supabase authentication API or a correctly configured
   JSON Web Token (JWT) verifier. Check the trusted issuer, signature, audience, and time
   constraints appropriate to the application. Decoding a token or reading `getSession()` alone does
   not establish trust.
2. Map verified identity to a small set of allowed application roles. Reject unexpected roles. Keep
   administrative roles out of this user-request path.
3. Open a transaction using the intended restricted database connection. Set identity claims with
   parameterized values and transaction-local settings, such as `set_config` with its local flag.
   Choose a role from fixed trusted SQL definitions, not interpolated token text.
4. Execute all protected queries through that transaction's handle. Do not pass a global database
   client to a callback that expects the transaction's role and claims.
5. Let commit or rollback end the transaction-local context. Verify that successful requests,
   failures, and pooled connection reuse cannot carry identity into the next request.

Use Supabase's [verified claims API](https://supabase.com/docs/reference/javascript/auth-getclaims)
according to the installed SDK and signing configuration. When the operation requires confirmation
that a session remains active, use the supported server-side session check in addition to the
required token verification.

- Bind JSON claim values as parameters. Do not embed `JSON.stringify(token)` in `sql.raw()` or quote
  an interpolated raw fragment to construct a settings statement.
- Keep role selection separate from value binding. SQL role identifiers require a controlled
  allowlist and supported identifier handling; they are not arbitrary string parameters.
- Use transaction-local settings from the start. Do not depend on cleanup SQL to undo persistent
  session changes after a failure. A failed transaction may reject cleanup statements until it is
  rolled back.
- Keep the authenticated user's connection path separate from administrative access. Avoid an API
  that casually returns both handles to every caller.
- Test the bridge with malformed and expired tokens, unexpected roles, two different users,
  cross-tenant requests, forced query failures, and reuse of a small connection pool.

## Verify database behavior

Run database checks, lint, formatting, typechecks, or tests only when explicitly requested. Do not
add a verification pipeline, fixtures, or mandatory evidence records when adopting Drizzle.

For requested checks, use the affected schema and runtime role. Cover the behavior under change,
such as an access predicate, transaction, or migration. Keep the database target explicit; do not
apply remote migrations or reset shared databases as a verification shortcut.

The Drizzle ESLint plugin checks for missing `.where()` clauses on updates and deletes. A present
`.where()` does not prove tenant isolation or a restrictive predicate. Review aliased builders and
operation predicates. See [Drizzle ESLint](https://orm.drizzle.team/docs/eslint-plugin).

When using Squawk, configure the deployed PostgreSQL version and the migration runner's transaction
behavior. Keep SQL outside a transaction only when the runner supports that execution mode.
Static analysis does not execute migrations. Scope any suppression to the reviewed operation and
explain the deployment constraints. See [Squawk CLI](https://squawkhq.com/docs/cli).

Knip's Drizzle adapter discovers configured schema entry points when `drizzle-kit` is declared. Keep
custom migration scripts and generated-code boundaries explicit in its configuration. See
[Knip's Drizzle plugin](https://knip.dev/reference/plugins/drizzle).

When reporting requested verification, state what ran and whether it passed. Do not claim database
behavior was verified by a static check. Keep credentials and private row data out of diagnostics.
