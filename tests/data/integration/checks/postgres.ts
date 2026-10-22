export const UNWRAPPED_MIGRATION_SQL = `SET lock_timeout = '5s';
SET statement_timeout = '30s';
ALTER TABLE public.teams ADD COLUMN size BIGINT;
`;

export const SQUAWK_ROOT_MIGRATION_PATH = 'supabase/migrations/0001_initial.sql';

export const SQUAWK_CHILD_MIGRATION_PATH = 'transactional/child/supabase/migrations/0001_initial.sql';

export const SQUAWK_SCOPE_SETTINGS = `[tools.squawk]
assume_in_transaction = false
[[scope]]
path = "transactional"

[scope.tools.squawk]
assume_in_transaction = true
[[scope]]
path = "transactional/child"

`;
