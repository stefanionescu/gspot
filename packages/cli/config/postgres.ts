// Constants of the postgres checks.

/** Where migrations live when tools.postgres.migrations_dir names no folder, in the order searched. */
export const MIGRATION_FOLDERS = ['supabase/migrations', 'db/migrations', 'migrations'];

/** The digits that lead a migration file name and order it. */
export const MIGRATION_VERSION = /^(?<version>\d+)/u;

/** The schema a table belongs to when its statement names none. */
export const DEFAULT_SCHEMA = 'public';

/** The line that boxes a heading in a documented migration. */
export const DOC_SEPARATOR = '-- ============================================================================';

/** The section names a documented migration may box, and the statement each one holds. */
export const DOC_SECTIONS: Record<string, string> = {
    CreateSchemaStmt: 'Schema',
    CreateStmt: 'Tables',
    IndexStmt: 'Indexes',
    CreateFunctionStmt: 'Functions',
    CreateTrigStmt: 'Triggers',
    CreateExtensionStmt: 'Extensions',
};

/** The words a statement kind is called in a finding. */
export const STATEMENT_WORDS: Record<string, string> = {
    CreateSchemaStmt: 'CREATE SCHEMA',
    CreateStmt: 'CREATE TABLE',
    IndexStmt: 'CREATE INDEX',
    CreateFunctionStmt: 'CREATE FUNCTION',
    CreateTrigStmt: 'CREATE TRIGGER',
    CreateExtensionStmt: 'CREATE EXTENSION',
};
