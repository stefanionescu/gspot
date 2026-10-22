export const MIGRATION_SYNTAX_SKIP = 'A migration does not parse. postgres/migration-order reports where.';

export const CONSTRAINT_SUFFIXES: Readonly<Record<string, string>> = {
    CONSTR_PRIMARY: 'pkey',
    CONSTR_UNIQUE: 'key',
    CONSTR_FOREIGN: 'fkey',
} as const;

export const PUBLIC_SCHEMA = 'public';

/** Match the SQL comment line that starts the down section. */
export const MIGRATION_DOWN = /^[\t ]*--[\t ]*migrate:down\b/mu;

/** The position of the schema in a qualified name, directly before the relation name. */
export const SCHEMA_PART_INDEX = -2;

export const DOWN_MIGRATION_SUFFIX = '.down.sql';

export const SQUAWK_CHECK = 'postgres/squawk';
