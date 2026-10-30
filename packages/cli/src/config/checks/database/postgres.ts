export const SECURITY_DEFINER_MESSAGE =
    'This SECURITY DEFINER function sets no search_path. Set an explicit search_path so callers cannot choose the objects it accesses.';

export const DEFINER_SEARCH_PATH_RULE = 'definer-search-path';

export const FROZEN_RULE = 'frozen';

export const FROZEN_EDIT_MESSAGE =
    'This migration is at or before postgres.frozen_through and differs from its committed text. Restore it and write a new migration.';

export const FROZEN_THROUGH_NOTE = 'Set postgres.frozen_through to the last migration that has run everywhere.';

export const FOREIGN_KEY_INDEX_RULE = 'foreign-key-index';

export const GRANT_ALL_RULE = 'grant-all';

export const GRANT_ALL_MESSAGE = 'GRANT ALL gives every privilege, present and future; name the privileges.';

export const MISSING_VERSION_MESSAGE = 'The file name starts with no version number.';

export const RULES = { version: 'version', duplicateVersion: 'duplicate-version', order: 'order' } as const;

export const SQUAWK_CHECK = 'postgres/squawk';

export const DOWN_MIGRATION_SUFFIX = '.down.sql';

export const MIGRATION_SYNTAX_SKIP = 'A migration does not parse. postgres/migration-order reports where.';

export const MIGRATION_DOWN = /^[\t ]*--[\t ]*migrate:down\b/mu;

export const ROW_SECURITY_RULE = 'row-security';

export const PUBLIC_SCHEMA = 'public';

export const CONSTRAINT_SUFFIXES: Readonly<Record<string, string>> = {
    CONSTR_PRIMARY: 'pkey',
    CONSTR_UNIQUE: 'key',
    CONSTR_FOREIGN: 'fkey',
};

export const SCHEMA_NAME_INDEX = -2;
