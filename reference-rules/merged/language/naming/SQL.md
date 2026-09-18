---
layer: language
preset: sql
title: SQL Naming
---

# SQL Naming

SQL names are durable infrastructure contracts. Rename them only
through migrations and contract-aware code changes.

## SQL case rules

Rules:

- SQL schemas, tables, columns, functions, function parameters, indexes,
  triggers, constraints, and policies use `lower_snake_case`. `enforced-by: naming/identifiers`
- SQL keywords are uppercase. `enforced-by: structure/sql-migration-docs`
- Storage buckets use `lower_snake_case`. `enforced-by: naming/identifiers`
- Edge Function folders use `kebab-case`. `enforced-by: naming/identifiers`
- Environment variables and secrets use `UPPER_SNAKE_CASE`. `enforced-by: naming/identifiers`
- Storage object keys must be stable, explicit, and validated by policy or
  trigger when user-controlled. `enforced-by: naming/identifiers`
- Fully qualify grants and function signatures when ambiguity is possible. `enforced-by: structure/sql-migration-docs`
- Do not use quoted sentence-style identifiers for local policy names. `enforced-by: naming/identifiers`
- Do not use pluralization or prefixes inconsistently inside one schema. `enforced-by: naming/identifiers`

Bad:

```sql
CREATE TABLE public.OrderItems (
    user_id uuid NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE POLICY "users_can_view_order_items" ON public.OrderItems
    FOR SELECT TO authenticated USING (true);
```

Good:

```sql
CREATE TABLE public.order_items (
    user_id uuid NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE POLICY users_can_view_own_order_items ON public.order_items
    FOR SELECT TO authenticated USING (true);
```

## Migration filenames

Rules:

- Migration filenames use `YYYYMMDDHHMMSS_description.sql`. `enforced-by: naming/identifiers`
- The timestamp is a 14-digit timestamp. `enforced-by: naming/identifiers`
- Timestamps must be strictly increasing in sorted migration order. `enforced-by: postgres/migrations-frozen`
- The description uses `lower_snake_case`. `enforced-by: naming/identifiers`
- The description starts with a lowercase letter. `enforced-by: naming/identifiers`
- Use the project migration creation command when creating blank migrations. `enforced-by: postgres/migrations-frozen`
- Do not insert an older timestamp before an already committed migration. `enforced-by: postgres/migrations-frozen`
- Name the migration for the durable database change, not for the app task. `unenforced`

The description starts with one of these verbs and no other. These verbs govern migration
filenames only; function names follow the SQL Functions rules below.

- `create_*` for new schemas, tables, functions, buckets, indexes, policies, or
  cron wiring. `unenforced`
- `alter_*` for schema or behavior changes. `unenforced`
- `insert_*` for initial durable data. `enforced-by: naming/identifiers`
- `update_*` for durable data updates. `enforced-by: naming/identifiers`
- `delete_*` only for intentional durable data removals. `enforced-by: naming/identifiers`

Bad:

```text
20260101120000_add_stuff.sql
20260101120000_CreateUsers.sql
20260101120000_fix.sql
```

Good:

```text
20260101120000_create_order_items.sql
20260101121500_alter_accounts_add_avatar_path.sql
20260101123000_insert_default_notification_options.sql
```

## SQL tables and columns

Rules:

- Table names identify the domain set stored by the relation. `unenforced`
- Column names identify the value, not the application layer that reads it. `unenforced`
- Foreign-key columns use the referenced concept plus `_id`. `enforced-by: naming/identifiers`
- Timestamp columns use stable event names such as `created_at`,
  `updated_at`, `deleted_at`, or a concrete domain event time. `enforced-by: postgres/migrations-frozen`
- Boolean columns use concise positive assertion names without an `is_`
  prefix. `enforced-by: naming/identifiers`
- Avoid generic columns that hide meaning. `enforced-by: naming/identifiers`

Bad:

```sql
CREATE TABLE public.data (
    id uuid PRIMARY KEY,
    payload jsonb NOT NULL,
    flag boolean NOT NULL,
    date timestamptz NOT NULL
);
```

Good:

```sql
CREATE TABLE public.message_delivery_attempts (
    id uuid PRIMARY KEY,
    message_id uuid NOT NULL REFERENCES public.messages (id),
    provider_response jsonb NOT NULL,
    retryable boolean NOT NULL,
    attempted_at timestamptz NOT NULL
);
```

## SQL functions and parameters

Rules:

- SQL function names use verb phrases or domain operation names. `enforced-by: naming/identifiers`
These verbs govern function names, not migration filenames.

- Retrieval functions use `get_` regardless of whether they return one row,
  an optional row, a collection, or a paginated collection. Do not use
  `read_`, `find_`, `fetch_`, `load_`, or `list_` as retrieval synonyms. `enforced-by: naming/identifiers`
- Data-access mutation functions use `set_`, `insert_`, `update_`, or
  `delete_` according to the operation they perform. Do not use `create_`,
  `add_`, `save_`, `write_`, `put_`, `upsert_`, or `remove_` as synonyms. `enforced-by: naming/identifiers`
- Function parameters use `lower_snake_case`. `enforced-by: naming/identifiers`
- Parameter names never collide with table column names. `enforced-by: naming/identifiers`
- `SECURITY DEFINER` functions must have names that make the privileged action
  clear. `enforced-by: postgres/squawk`
- Do not name functions like arbitrary script tasks. `enforced-by: naming/identifiers`

Bad:

```sql
CREATE FUNCTION public.run(id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    ...
END;
$$;
```

Good:

```sql
CREATE FUNCTION public.archive_expired_orders(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    ...
END;
$$;
```

## Indexes, constraints, triggers, and policies

Rules:

- Name constraints and scope them to their table or concept. `enforced-by: naming/identifiers`
- Name indexes by table plus indexed columns or purpose. `enforced-by: naming/identifiers`
- Name triggers by event and action. `enforced-by: naming/identifiers`
- Name policies by actor plus allowed action. `enforced-by: naming/identifiers`
- Keep names stable because they appear in migrations, errors, grants, and
  database inspection output. `enforced-by: naming/identifiers`

Bad:

```sql
CREATE INDEX idx1 ON public.messages (user_id);
ALTER TABLE public.messages ADD CONSTRAINT check_status CHECK (status <> '');
CREATE TRIGGER trigger1 BEFORE UPDATE ON public.messages EXECUTE FUNCTION public.update_updated_at();
CREATE POLICY select_policy ON public.messages FOR SELECT USING (true);
```

Good:

```sql
CREATE INDEX messages_user_id_created_at_idx ON public.messages (user_id, created_at);

ALTER TABLE public.messages
    ADD CONSTRAINT messages_status_not_empty_check CHECK (status <> '');

CREATE TRIGGER messages_set_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY users_can_view_own_messages
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
```

## Storage names

Rules:

- Storage buckets use `lower_snake_case`. `enforced-by: naming/identifiers`
- Storage object keys are stable and explicit. `enforced-by: naming/identifiers`
- User-controlled key segments must be validated and bounded before use. `unenforced`
- Do not embed secrets, provider tokens, raw user text, or private identifiers in
  object keys. `unenforced`
- Do not use display text as storage identity. `enforced-by: naming/identifiers`

Bad:

```text
Profile Pictures
avatars/john@example.com/avatar image.png
uploads/latest
```

Good:

```text
avatar_images
avatars/user_01hxx8j2r6/profile.png
reports/report_01hxx8j2r6/export.pdf
```

