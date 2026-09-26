// The literal values checks/postgres reads: names, patterns, limits, and tables.

export const MIGRATION_DOC_SECTIONS: Record<string, string> = {
    CreateSchemaStmt: 'Schema',
    CreateStmt: 'Tables',
    IndexStmt: 'Indexes',
    CreateFunctionStmt: 'Functions',
    CreateTrigStmt: 'Triggers',
    CreateExtensionStmt: 'Extensions',
};
export const MIGRATION_DOC_LABELS: Record<string, RegExp> = {
    CreateStmt: /^--\s*Table:/iu,
    CreateFunctionStmt: /^--\s*Function:/iu,
};
export const FROZEN_NONE = 'none';
export const FROZEN_ALL = 'all';
export const PURPOSE = /^--\s*Purpose:/iu;
export const SECTION = /^-- (?<name>[A-Z][A-Za-z ]+)$/u;
export const BLOCK_REACH = 12;
export const STATEMENT_WORDS: Record<string, string> = {
    CreateSchemaStmt: 'CREATE SCHEMA',
    CreateStmt: 'CREATE TABLE',
    IndexStmt: 'CREATE INDEX',
    CreateFunctionStmt: 'CREATE FUNCTION',
    CreateTrigStmt: 'CREATE TRIGGER',
    CreateExtensionStmt: 'CREATE EXTENSION',
};
export const DOC_SEPARATOR = '-- ============================================================================';
export const MIGRATION_FOLDERS = ['supabase/migrations', 'db/migrations', 'migrations'];
export const MIGRATION_VERSION = /^(?<version>\d+)/u;
export const KEY_KINDS = new Set(['CONSTR_PRIMARY', 'CONSTR_UNIQUE']);
export const CONSTRAINT_SUFFIXES: Record<string, string> = { CONSTR_PRIMARY: 'pkey', CONSTR_UNIQUE: 'key' };
// What the migrations declare, gathered across every file: tables, row security, policies, foreign keys and indexes.
export const DEFAULT_SCHEMA = 'public';
