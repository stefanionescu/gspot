import type { MigrationStatement } from '#cli/types/checks/database/postgres.ts';

export const CONSTRAINT_SUFFIXES: Record<string, string> = {
    CONSTR_PRIMARY: 'pkey',
    CONSTR_UNIQUE: 'key',
    CONSTR_FOREIGN: 'fkey',
};

export const PUBLIC_SCHEMA = 'public';

export const MIGRATION_STATEMENTS: Record<string, MigrationStatement> = {
    CreateSchemaStmt: { section: 'Schema', words: 'CREATE SCHEMA' },
    CreateStmt: { section: 'Tables', words: 'CREATE TABLE' },
    IndexStmt: { section: 'Indexes', words: 'CREATE INDEX' },
    CreateFunctionStmt: { section: 'Functions', words: 'CREATE FUNCTION' },
    CreateTrigStmt: { section: 'Triggers', words: 'CREATE TRIGGER' },
    CreateExtensionStmt: { section: 'Extensions', words: 'CREATE EXTENSION' },
};

export const DOC_LABELS: Record<string, RegExp> = {
    CreateStmt: /^--\s*Table:/iu,
    CreateFunctionStmt: /^--\s*Function:/iu,
};

export const PURPOSE = /^--\s*Purpose:/iu;

export const SECTION = /^-- (?<name>[A-Z][A-Za-z ]+)$/u;

export const BLOCK_REACH = 12;

export const DOC_SEPARATOR = '-- ============================================================================';

/** The down section begins on its own SQL comment line. */
export const MIGRATION_DOWN = /^[\t ]*--[\t ]*migrate:down\b/mu;

/** How many header lines the contract asks for. */
export const HEADER_LINES = 4;

/** From a one-based line to the zero-based index of the line above it. */
export const LINE_ABOVE = 2;

/** The schema precedes the final relation name in a qualified name. */
export const SCHEMA_PART_INDEX = -2;
