---
title: SQL Naming
---

# SQL Naming

SQL names are durable infrastructure contracts. Rename them only
through migrations and contract-aware code changes.

## SQL case rules

<!-- level: all -->

Rules:

- SQL schemas, tables, columns, functions, function parameters, indexes,
  triggers, constraints, and policies use `lower_snake_case`.
- Fully qualify grants and function signatures when ambiguity is possible.
- Do not use quoted sentence-style identifiers for local policy names.
- Do not use pluralization or prefixes inconsistently inside one schema.

| Avoid                        | Prefer                           | Meaning                            |
| ---------------------------- | -------------------------------- | ---------------------------------- |
| `public.OrderItems`          | `public.order_items`             | An order-item table.               |
| `users_can_view_order_items` | `users_can_view_own_order_items` | A policy restricted to owned rows. |

The policy name must describe its actual predicate. A name that says "own"
does not establish ownership checks or enable Row Level Security.

## Migration filenames

<!-- level: all -->

Follow the migration tool's file names. Name each migration for its durable database change.

## SQL tables and columns

<!-- level: all -->

Rules:

- Table names identify the domain set stored by the relation.
- Column names identify the value, not the application layer that reads it.
- Foreign-key columns use the referenced concept plus `_id`.
- Timestamp columns use stable event names such as `created_at`,
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

## SQL functions and parameters

<!-- level: all -->

Rules:

- SQL function names use verb phrases or domain operation names. These verbs govern function
  names, not migration filenames.

- Retrieval functions use `get_` regardless of whether they return one row,
  an optional row, a collection, or a paginated collection. Do not use
  `read_`, `find_`, `fetch_`, `load_`, or `list_` as retrieval synonyms.
- Data-access mutation functions use `set_`, `insert_`, `update_`, or
  `delete_` according to the operation they perform. Do not use `create_`,
  `add_`, `save_`, `write_`, `put_`, `upsert_`, or `remove_` as synonyms.
- Function parameters use `lower_snake_case`.
- Parameter names never collide with table column names.
- `SECURITY DEFINER` functions must have names that make the privileged action
  clear.
- Do not name functions like arbitrary script tasks.

Use `archive_expired_orders` for a transactional operation that archives
expired orders. Name its user argument `target_user_id` when `user_id` is
already a column in the affected tables. A generic `run` name hides the
operation, and an unqualified `id` can obscure column ownership.

## Indexes, constraints, triggers, and policies

<!-- level: all -->

Rules:

- Name constraints and scope them to their table or concept.
- Name indexes by table plus indexed columns or purpose.
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
