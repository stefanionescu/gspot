# SQL

Read this rule when you write SQL.

## SQL style

- Fully qualify cross-schema references.
- Prefer explicit column lists for each `INSERT` and every grant of write
  privileges.
- Keep table constraints close to the definition unless the migration must add them
  later for dependency reasons.

## Naming

### SQL case rules

<!-- level: all -->

- SQL schemas, tables, columns, functions, parameters, indexes,
  triggers, constraints, and policies use `lower_snake_case`.
- Fully qualify grants and function signatures when names have more than one possible meaning.
- Do not use quoted sentence-style identifiers for local policy names.
- Do not use pluralization or prefixes inconsistently inside one schema.

| Avoid                        | Prefer                           | Meaning                            |
| ---------------------------- | -------------------------------- | ---------------------------------- |
| `public.OrderItems`          | `public.order_items`             | An order-item table.               |
| `users_can_view_order_items` | `users_can_view_own_order_items` | A policy restricted to owned rows. |

The policy name must describe what its predicate checks. A name that says "own"
does not establish ownership checks or enable Row Level Security.

### Migration filenames

<!-- level: all -->

Follow the migration tool's file names. Name each migration for its durable database change.

### SQL tables and columns

<!-- level: all -->

- Table names identify the domain set stored by the relation.
- Column names identify the value, not the application layer that reads it.
- Foreign-key columns use the referenced concept plus `_id`.
- Timestamp columns use stable names such as `created_at`,
  `updated_at`, `deleted_at`, or a concrete domain event time.
- Boolean columns use concise positive assertion names without an `is_`
  prefix.
- Avoid generic columns that hide meaning.

| Avoid     | Prefer                      | Meaning                   |
| --------- | --------------------------- | ------------------------- |
| `data`    | `message_delivery_attempts` | Delivery attempt table.   |
| `payload` | `provider_response`         | Response payload column.  |
| `flag`    | `retryable`                 | Retry eligibility column. |
| `date`    | `attempted_at`              | Attempt timestamp column. |

### SQL functions and parameters

<!-- level: all -->

- SQL function names use verb phrases or domain operations. These verbs apply to functions,
  not migration filenames.

- Retrieval functions use `get_` whether they return one row,
  an optional one, a collection, or a paginated one. Do not use
  `read_`, `find_`, `fetch_`, `load_`, or `list_` as retrieval synonyms.
- Data-access mutation functions use `set_`, `insert_`, `update_`, or
  `delete_` according to the operation they perform. Do not use `create_`,
  `add_`, `save_`, `write_`, `put_`, `upsert_`, or `remove_` as synonyms.
- Parameter names never collide with table columns.
- `SECURITY DEFINER` functions must have names that make the privileged action
  clear.
- Do not name functions like arbitrary script tasks.

Use `archive_expired_orders` for a transactional operation that archives
expired orders. Name its user argument `target_user_id` when the affected tables already have a `user_id` column. A generic `run` name hides the
operation, and an unqualified `id` can obscure column ownership.

### Indexes, constraints, triggers, and policies

<!-- level: all -->

- Name constraints and scope them to their table or concept.
- Name indexes by table plus their columns or purpose.
- Name triggers by event and action.
- Name policies by actor plus allowed action.
- Keep names stable because they appear in migrations, errors, grants, and
  database inspection output.

| Avoid           | Prefer                            | Meaning                              |
| --------------- | --------------------------------- | ------------------------------------ |
| `idx1`          | `messages_user_id_created_at_idx` | Index on user and creation time.     |
| `check_status`  | `messages_status_not_empty_check` | Nonempty status constraint.          |
| `trigger1`      | `messages_set_updated_at`         | Update timestamp trigger.            |
| `select_policy` | `users_can_view_own_messages`     | Policy restricted to owned messages. |
