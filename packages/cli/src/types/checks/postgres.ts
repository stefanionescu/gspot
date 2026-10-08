import type { AlterTableCmd } from '@pgsql/types';
import type { SqlNodeFields, SqlStatementView } from '#cli/types/parsers/sql.ts';

export type StatementReader<Kind extends keyof SqlNodeFields> = (
    statement: SqlStatementView<Kind>,
    state: SchemaState,
    migration: Migration,
) => void;

/** Only PostgreSQL alteration kinds handled by schema state have a reader. */
export type SchemaAlterations = Partial<
    Record<NonNullable<AlterTableCmd['subtype']>, (state: SchemaState, at: Location, command: AlterTableCmd) => void>
>;

/** Where a fact was declared, so a finding points at it. */
export type Declared = { path: string; offset: number; text: string };

/** One foreign key column of a table. */
export type ForeignKey = Declared & { table: string; column: string };

/** One parsed migration file. */
export type Migration = {
    path: string;
    name: string;
    /** The leading version digits, after any V prefix; empty when the name has none. */
    version: string;
    text: string;
    statements: SqlStatementView[];
};

/** What the migrations say about the schema, read across every file. */
export type Schema = {
    /** Qualified table name to where it was created. */
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

/** The documentation section and displayed name of a PostgreSQL statement kind. */
export type MigrationStatement = { section: string; words: string };
