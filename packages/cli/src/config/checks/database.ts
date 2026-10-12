export const CONSTRAINT_SUFFIXES = {
    CONSTR_PRIMARY: 'pkey',
    CONSTR_UNIQUE: 'key',
    CONSTR_FOREIGN: 'fkey',
} as const;

export const PUBLIC_SCHEMA = 'public';

/** The down section begins on its own SQL comment line. */
export const MIGRATION_DOWN = /^[\t ]*--[\t ]*migrate:down\b/mu;

/** The schema precedes the final relation name in a qualified name. */
export const SCHEMA_PART_INDEX = -2;

export const DOWN_MIGRATION_SUFFIX = '.down.sql';

export const POSTGRES_CONFIGURATION = 'postgres';
