# SQL Naming

SQL and Supabase names are durable infrastructure contracts. Rename them only
through migrations and contract-aware code changes.

## SQL Case Rules

Rules:

- SQL schemas, tables, columns, functions, function parameters, indexes,
  triggers, constraints, and policies use `lower_snake_case`.
- SQL keywords are uppercase.
- Storage buckets use `lower_snake_case`.
- Edge Function folders use `kebab-case`.
- Environment variables and secrets use `UPPER_SNAKE_CASE`.
- Storage item keys must be stable, explicit, and validated by policy or
  trigger when user-controlled.
- Fully qualify grants and function signatures when ambiguity is possible.
- Do not use quoted sentence-style identifiers for local policy names.
- Do not use pluralization or prefixes inconsistently inside one schema.

Bad:

```sql
CREATE TABLE public.OrderItems (
    userId uuid NOT NULL,
    createdAt timestamptz NOT NULL
);

CREATE POLICY "users_can_view_order_items" ON public.OrderItems
    FOR SELECT TO authenticated USING (true);
```

Good:

```sql
CREATE TABLE public.order_items (
    userId uuid NOT NULL,
    createdAt timestamptz NOT NULL
);

CREATE POLICY users_can_view_own_order_items ON public.order_items
    FOR SELECT TO authenticated USING (true);
```

## Migration Filenames

Rules:

- Migration filenames use `YYYYMMDDHHMMSS_description.sql`.
- The timestamp is a 14-digit timestamp.
- Timestamps must be strictly increasing in sorted migration order.
- The description uses `lower_snake_case`.
- The description starts with a lowercase letter.
- Use the project migration creation command when creating blank migrations.
- Do not insert an older timestamp before an already committed migration.
- Name the migration for the durable database change, not for the app task.

Recommended migration description verbs:

- `create_*` for new schemas, tables, functions, buckets, indexes, policies, or
  cron wiring.
- `alter_*` for schema or behavior changes.
- `insert_*` for initial durable data.
- `update_*` for durable data updates.
- `delete_*` only for intentional durable data removals.

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

## SQL Tables and Columns

Rules:

- Table names identify the domain set stored by the relation.
- Column names identify the value, not the application layer that reads it.
- Foreign-key columns use the referenced concept plus `_id`.
- Timestamp columns should use stable event names such as `createdAt`,
  `updatedAt`, `deleted_at`, or a concrete domain event time.
- Boolean columns use concise positive assertion names without an `is_`
  prefix.
- Avoid generic columns that hide meaning.

Bad:

```sql
CREATE TABLE public.data (
    id uuid PRIMARY KEY,
    item jsonb NOT NULL,
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

## SQL Functions and Parameters

Rules:

- SQL function names use verb phrases or domain operation names.
- Retrieval functions use `get_` regardless of whether they return one row,
  an optional row, a collection, or a paginated collection. Do not use
  `read_`, `find_`, `fetch_`, `load_`, or `list_` as retrieval synonyms.
- Data-access mutation functions use `set_`, `insert_`, `update_`, or
  `delete_` according to the operation they perform. Do not use `create_`,
  `add_`, `save_`, `write_`, `put_`, `upsert_`, or `remove_` as synonyms.
- Function parameters use `lower_snake_case`.
- Parameter names should not collide confusingly with table columns.
- `SECURITY DEFINER` functions must have names that make the privileged action
  clear.
- Do not name functions like arbitrary script tasks.

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

## Indexes, Constraints, Triggers, and Policies

Rules:

- Name constraints and scope them to their table or concept.
- Name indexes by table plus indexed columns or purpose.
- Name triggers by event and action.
- Name policies by actor plus allowed action.
- Keep names stable because they appear in migrations, errors, grants, and
  database inspection output.

Bad:

```sql
CREATE INDEX idx1 ON public.messages (userId);
ALTER TABLE public.messages ADD CONSTRAINT check_status CHECK (status <> '');
CREATE TRIGGER trigger1 BEFORE UPDATE ON public.messages EXECUTE FUNCTION public.update_updated_at();
CREATE POLICY select_policy ON public.messages FOR SELECT USING (true);
```

Good:

```sql
CREATE INDEX messages_user_id_created_at_idx ON public.messages (userId, createdAt);

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
    USING (userId = auth.uid());
```

## Supabase Edge Functions

Rules:

- Function folders use `kebab-case`.
- The folder name, config entry, and deployable function name must match.
- Shared function code belongs under approved shared function folders and
  follows TypeScript naming.
- Name Edge Functions by the externally callable operation.
- Do not name Edge Functions after implementation technology.

Bad:

```text
functions/SubmitOrder/
functions/provider_handler/
functions/functions/src/submit-order/
```

Good:

```text
functions/submit-order/
functions/refresh-provider-token/
functions/shared-code/
functions/provider-config/
functions/generated-types/
```

## Storage Names

Rules:

- Storage buckets use `lower_snake_case`.
- Storage item keys are stable and explicit.
- User-controlled key segments must be validated and bounded before use.
- Do not embed secrets, provider tokens, raw user text, or private identifiers in
  item keys.
- Do not use display text as storage identity.

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

