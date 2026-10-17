export const CONSTRAINT_SUFFIXES: Readonly<Record<string, string>> = {
    CONSTR_PRIMARY: 'pkey',
    CONSTR_UNIQUE: 'key',
    CONSTR_FOREIGN: 'fkey',
} as const;

export const PUBLIC_SCHEMA = 'public';

/** Match the SQL comment line that starts the down section. */
export const MIGRATION_DOWN = /^[\t ]*--[\t ]*migrate:down\b/mu;

/** The position of the schema, just before the relation name, in a qualified name. */
export const SCHEMA_PART_INDEX = -2;

export const DOWN_MIGRATION_SUFFIX = '.down.sql';
