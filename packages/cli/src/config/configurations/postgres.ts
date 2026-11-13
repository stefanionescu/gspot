// definer-search-path check

export const DEFINER_SEARCH_PATH_RULE = 'definer-search-path';
export const SECURITY_DEFINER_MESSAGE =
    'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.';

// edited-migrations check
export const DRIFT_GUARD_MESSAGE =
    '`IF NOT EXISTS` hides schema drift. Use it only on `CREATE INDEX CONCURRENTLY`, which cannot run in a transaction.';
export const DRIFT_GUARD_RULE = 'drift-guard';
export const FROZEN_EDIT_MESSAGE =
    'This migration differs from its committed text. Restore it and write a new migration.';
export const FROZEN_RULE = 'frozen';

// foreign-key-indexes check
export const FOREIGN_KEY_INDEX_RULE = 'foreign-key-index';

// generated config
export const SQUAWK_ALL_LEVEL_ON = ['require-table-schema'] as const;

// grants check
export const GRANT_ALL_MESSAGE = 'GRANT ALL gives every privilege, present and future; name the privileges.';
export const GRANT_ALL_RULE = 'grant-all';

// migration-order check
export const MIGRATION_RULES = { version: 'version', duplicateVersion: 'duplicate-version', order: 'order' } as const;
export const MISSING_VERSION_MESSAGE = 'The file name starts with no version number.';

// migrations check
export const DOWN_MIGRATION_SUFFIX = '.down.sql';
export const MIGRATION_DOWN = /^[\t ]*--[\t ]*migrate:down\b/mu;
export const MIGRATION_SYNTAX_SKIP = 'A migration does not parse. postgres/migration-order reports where.';
export const MIGRATION_VERSION = /^V?(?<version>\d+(?:[._]\d+)*)/u;
export const PRISMA_MIGRATION_FILE = 'migration.sql';
export const SQUAWK_CHECK = 'postgres/squawk';

// row-level-security check
export const IDENTITY_CALL_MESSAGE =
    'Wrap this identity call in `(select ...)`, so that the planner evaluates it once per statement.';
export const IDENTITY_FUNCTIONS: ReadonlySet<string> = new Set(['auth.uid', 'current_setting']);
export const OPEN_POLICY_MESSAGE =
    'This `USING (true)` policy has no comment. Say why the table is public or service-only.';
export const POLICY_ROLES_MESSAGE = 'This policy names no role. Add `TO` with the roles that it covers.';
export const POLICY_RULES = {
    roles: 'policy-without-roles',
    identityCall: 'per-row-identity-call',
    open: 'open-policy',
    view: 'view-without-security-invoker',
} as const;
export const ROW_SECURITY_RULE = 'row-security';
export const SECURITY_INVOKER_MESSAGE =
    'Clients can read this view, and it skips the row security of its tables. Set `security_invoker = true`.';
export const SQL_COMMENT = /--|\/\*/u;

// schema check
export const CONSTRAINT_SUFFIXES: Readonly<Record<string, string>> = {
    CONSTR_PRIMARY: 'pkey',
    CONSTR_UNIQUE: 'key',
    CONSTR_FOREIGN: 'fkey',
};
export const DISABLED_OPTION_VALUES: ReadonlySet<string> = new Set(['false', 'off', '0']);
export const POLICY_SCHEMA_INDEX = -3;
export const PUBLIC_SCHEMA = 'public';
export const SCHEMA_NAME_INDEX = -2;
export const SECURITY_INVOKER_OPTION = 'security_invoker';
