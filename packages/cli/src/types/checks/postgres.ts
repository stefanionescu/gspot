import type { AlterTableCmd } from '@pgsql/types';
import type { Finding } from '#cli/types/runs/check.ts';
import type { SqlFile, SqlStatement, SqlNodeFields } from '#cli/types/parsers/sql.ts';

/** The declaration position of a fact, so a finding points at it. */
type Declared = { path: string; offset: number; text: string };

export type StatementReader<Kind extends keyof SqlNodeFields> = (
    statement: SqlStatement<Kind>,
    state: DatabaseSchema,
    migration: Migration,
) => void;

/** Only PostgreSQL alteration kinds handled by schema state have a reader. */
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
    /** Qualified table name to its creation position. */
    tables: Map<string, Declared>;
    secured: Set<string>;
    foreignKeys: (Declared & { table: string; column: string })[];
    /** Qualified table name to the leading column of each index and key on it. */
    indexed: Map<string, Set<string>>;
};

export type DatabaseSchema = Pick<Schema, 'tables' | 'secured'> & {
    indexes: { table: string; name: string; column: string; constraint: string }[];
    constraints: Map<string, Map<string, Schema['foreignKeys']>>;
};

export type Location = { migration: Migration; statement: SqlStatement; table: string };

/** Parsed migrations and located source syntax failures for the invoking check. */
export type MigrationRead = { migrations: Migration[]; findings: Finding[] };
