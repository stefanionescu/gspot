import type { AlterTableCmd } from '@pgsql/types';
import type { Finding } from '#cli/types/runs/check.ts';
import type { SqlFile, SqlStatement, SqlNodeFields } from '#cli/types/parsers/code/sql.ts';

type SourceStatement = { path: string; offset: number; text: string };

export type StatementReader<Kind extends keyof SqlNodeFields> = (
    statement: SqlStatement<Kind>,
    state: DatabaseSchema,
    migration: Migration,
) => void;

export type SchemaAlterations = Partial<
    Record<NonNullable<AlterTableCmd['subtype']>, (state: DatabaseSchema, at: Location, command: AlterTableCmd) => void>
>;

export type Migration = {
    error?: NonNullable<SqlFile['error']>;
    path: string;
    name: string;
    version: string;
    text: string;
    statements: SqlStatement[];
};

export type Schema = {
    tables: Map<string, SourceStatement>;
    secured: Set<string>;
    foreignKeys: (SourceStatement & { table: string; column: string })[];
    indexed: Map<string, Set<string>>;
};

export type DatabaseSchema = Pick<Schema, 'tables' | 'secured'> & {
    indexes: { table: string; name: string; column: string; constraint: string }[];
    constraints: Map<string, Map<string, Schema['foreignKeys']>>;
};

export type Location = { migration: Migration; statement: SqlStatement; table: string };

export type MigrationRead = { migrations: Migration[]; findings: Finding[] };
