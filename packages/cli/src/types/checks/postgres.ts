import type { AlterTableCmd } from '@pgsql/types';
import type { Finding } from '#cli/types/runs/check.ts';
import type { SqlFile, SqlStatement, SqlNodeFields } from '#cli/types/parsers/code/sql.ts';

/**
 * Where the migrations declare something: the file, the offset, and the statement text, so that a finding can point at
 * it.
 */
type SourceStatement = { path: string; offset: number; text: string };

export type StatementReader<Kind extends keyof SqlNodeFields> = (
    statement: SqlStatement<Kind>,
    state: DatabaseSchema,
    migration: Migration,
) => void;

/** A reader for each `ALTER TABLE` command that changes the database schema. */
export type SchemaAlterations = Partial<
    Record<NonNullable<AlterTableCmd['subtype']>, (state: DatabaseSchema, at: Location, command: AlterTableCmd) => void>
>;

/** One parsed migration file. */
export type Migration = {
    error?: NonNullable<SqlFile['error']>;
    path: string;
    name: string;
    /** The leading version digits, after any V prefix; empty when the name has none. */
    version: string;
    text: string;
    statements: SqlStatement[];
};

/** What the migrations say about the schema, read across every file. */
export type Schema = {
    /** Each table, by its name with its schema such as public.users, and where a migration creates it. */
    tables: Map<string, SourceStatement>;
    secured: Set<string>;
    foreignKeys: (SourceStatement & { table: string; column: string })[];
    /** Each table, by its name with its schema, and the first column of each index and key on it. */
    indexed: Map<string, Set<string>>;
};

export type DatabaseSchema = Pick<Schema, 'tables' | 'secured'> & {
    indexes: { table: string; name: string; column: string; constraint: string }[];
    constraints: Map<string, Map<string, Schema['foreignKeys']>>;
};

export type Location = { migration: Migration; statement: SqlStatement; table: string };

/** The parsed migrations and a finding for each syntax error. */
export type MigrationRead = { migrations: Migration[]; findings: Finding[] };
