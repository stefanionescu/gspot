# SQL

Read this rule when you write SQL.

## SQL style

- Fully qualify cross-schema references.
- Prefer explicit column lists for each `INSERT` and every grant of write privileges.
- Keep table constraints close to the definition unless the migration must add them later for dependency reasons.
- Write keywords, type names, and the literals `NULL`, `TRUE`, and `FALSE` in uppercase, and identifiers and function
  names in lowercase. Start each clause on its own line:

```sql
SELECT count(*)
FROM order_items
WHERE deleted_at IS NULL;
```

## Naming

<!-- level: all -->

### SQL case rules

- Fully qualify grants and function signatures when names have more than one possible meaning.
- Do not use quoted sentence-style identifiers for local policy names.
- Do not use pluralization or prefixes inconsistently inside one schema.

### Migration filenames

Follow the migration tool's file names. Name each migration for its durable database change.

### SQL tables and columns

- Table names identify the domain set stored by the relation.
- Column names identify the value, not the application layer that reads it.
- Foreign-key columns use the referenced concept plus `_id`.
- Timestamp columns use stable names such as `created_at`, `updated_at`, `deleted_at`, or a concrete domain event time.

### SQL functions and parameters

- SQL function names use the verbs of `NAMING.md`. These verbs apply to functions, not migration filenames.
- Parameter names never collide with table columns.
- Name a `SECURITY DEFINER` function for the privileged action it takes.
- Do not name functions like arbitrary script tasks.

### Indexes, constraints, triggers, and policies

- Name constraints and scope them to their table or concept.
- Name indexes by table plus their columns or purpose.
- Name triggers by event and action.
- Name policies by actor plus allowed action.
- Keep names stable because they appear in migrations, errors, grants, and database inspection output.
