import type { RuleExplanations } from '#cli/types/tools.ts';
import { SYNTAX_EXPLANATIONS } from '#cli/configurations/syntax.ts';

import {
    FROZEN_RULE,
    POLICY_RULES,
    MIGRATION_RULES,
    DRIFT_GUARD_RULE,
    ROW_SECURITY_RULE,
} from '#cli/config/configurations/postgres.ts';

export const EDITED_MIGRATION_EXPLANATIONS = {
    [FROZEN_RULE]: {
        description: 'A committed migration keeps its committed text.',
        why: 'A database that already ran the migration skips the new text, so it drifts from a new database.',
        fix: 'Undo the edit, and put the change in a new migration.',
        example: 'A changed column type in a committed `20260101_create_orders.sql` reports `frozen`.',
    },
    [DRIFT_GUARD_RULE]: {
        description:
            'No migration after `postgres.frozen_through` uses `IF NOT EXISTS`, except `CREATE INDEX CONCURRENTLY`.',
        why: 'The guard skips the statement when the object exists in another shape, so the schema drifts unnoticed.',
        fix: 'Remove `IF NOT EXISTS`, so that the migration fails when the object already exists.',
        example: '`CREATE TABLE IF NOT EXISTS orders (id bigint)` reports `drift-guard`.',
    },
} as const satisfies RuleExplanations;

export const MIGRATION_ORDER_EXPLANATIONS = {
    [MIGRATION_RULES.order]: {
        description: 'A new migration sorts after every committed migration.',
        why: 'A database that already ran the committed migrations skips an older version, or runs it out of order.',
        fix: 'Rename the new migration with a version after the newest committed one.',
        example: 'A new `20250101_add_index.sql` after a committed `20260101_create_orders.sql` reports `order`.',
    },
    [MIGRATION_RULES.version]: {
        description: 'Each migration file name starts with a version number.',
        why: 'The version sets the order in which the migrations run.',
        fix: 'Rename the file with a version prefix, such as a timestamp.',
        example: '`add_orders.sql` reports `version`; `20260103120000_add_orders.sql` does not.',
    },
    [MIGRATION_RULES.duplicateVersion]: {
        description: 'Each migration has its own version.',
        why: 'Two files with one version run in an order that the migration tool does not define.',
        fix: 'Give one of the files a new version.',
        example: '`20260101_create_orders.sql` and `20260101_create_users.sql` report `duplicate-version`.',
    },
    ...SYNTAX_EXPLANATIONS,
} as const satisfies RuleExplanations;

export const ROW_SECURITY_EXPLANATIONS = {
    [ROW_SECURITY_RULE]: {
        description: 'Each table in a schema of `postgres.client_schemas` turns on row level security.',
        why: 'Without it, any role that has a grant on the table reads and writes every row.',
        fix: 'Run `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` in a migration, and add policies.',
        example: 'A `public.orders` table without `ENABLE ROW LEVEL SECURITY` reports `row-security`.',
    },
    [POLICY_RULES.view]: {
        description: 'Each view in a client schema sets `security_invoker = true`.',
        why: 'A view runs as its owner by default, so it skips the row level security of its tables.',
        fix: 'Create the view `WITH (security_invoker = true)`.',
        example:
            '`CREATE VIEW public.order_totals AS SELECT ...` without the option reports `view-without-security-invoker`.',
    },
    [POLICY_RULES.roles]: {
        description: 'After the frozen migrations, each policy names its roles with `TO`.',
        why: 'A policy without `TO` applies to every role, `anon` included.',
        fix: 'Name the roles after `TO`, such as `TO authenticated`.',
        example: '`CREATE POLICY read_own ON orders USING (...)` without `TO` reports `policy-without-roles`.',
    },
    [POLICY_RULES.identityCall]: {
        description:
            'After the frozen migrations, a policy wraps `auth.uid()` and `current_setting()` in `(select ...)`.',
        why: 'A bare call runs once for each row, which slows queries on large tables.',
        fix: 'Write `(select auth.uid())` instead of `auth.uid()`.',
        example: '`USING (user_id = auth.uid())` reports `per-row-identity-call`.',
    },
    [POLICY_RULES.open]: {
        description: 'After the frozen migrations, a `USING (true)` policy has a comment that gives the reason.',
        why: 'An open policy gives the covered roles every row, and a reader needs to know that it is on purpose.',
        fix: 'Write a `--` comment next to the policy with the reason.',
        example: '`CREATE POLICY read_all ON plans USING (true);` with no comment reports `open-policy`.',
    },
} as const satisfies RuleExplanations;
