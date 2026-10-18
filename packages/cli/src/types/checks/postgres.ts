import type { AlterTableCmd } from '@pgsql/types';
import type { Finding } from '#cli/types/runs/check.ts';
import type { SqlFile, SqlNodeFields, SqlStatementView } from '#cli/types/parsers/sql.ts';

/** The declaration position of a fact, so a finding points at it. */
type Declared = { path: string; offset: number; text: string };

/** One foreign key column of a table. */
type ForeignKey = Declared & { table: string; column: string };

export type StatementReader<Kind extends keyof SqlNodeFields> = (
    statement: SqlStatementView<Kind>,
    state: SchemaState,
    migration: Migration,
) => void;

/** Only PostgreSQL alteration kinds handled by schema state have a reader. */
export type SchemaAlterations = Partial<
    Record<NonNullable<AlterTableCmd['subtype']>, (state: SchemaState, at: Location, command: AlterTableCmd) => void>
>;

/** One parsed migration file. */
export type Migration = {
    error?: NonNullable<SqlFile['error']>;
    path: string;
    name: string;
    /** The leading version digits, after any V prefix; empty when the name has none. */
    version: string;
    text: string;
    statements: SqlStatementView[];
};

/** What the migrations say about the schema, read across every file. */
export type Schema = {
    /** Qualified table name to its creation position. */
    tables: Map<string, Declared>;
    secured: Set<string>;
    foreignKeys: ForeignKey[];
    /** Qualified table name to the leading column of each index and key on it. */
    indexed: Map<string, Set<string>>;
};

export type SchemaState = Pick<Schema, 'tables' | 'secured'> & {
    indexes: { table: string; name: string; column: string; constraint: string }[];
    constraints: Map<string, Map<string, Schema['foreignKeys']>>;
};

export type Location = { migration: Migration; statement: SqlStatementView; table: string };

/** Parsed migrations and located source syntax failures for the invoking check. */
export type MigrationRead = { migrations: Migration[]; findings: Finding[] };
