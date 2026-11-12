import type { AlterTableCmd } from '@pgsql/types';

import type { CheckFinding } from '#cli/types/engine/run.ts';
import type { SqlFile, SqlNodeFields, SqlStatement } from '#cli/types/parsers.ts';

export type SourceStatement = { path: string; offset: number; text: string };

export type StatementApplier<Kind extends keyof SqlNodeFields> = (
    statement: SqlStatement<Kind>,
    state: SchemaState,
    migration: Migration,
) => void;

export type SchemaAlterations = Partial<
    Record<NonNullable<AlterTableCmd['subtype']>, (state: SchemaState, at: Location, command: AlterTableCmd) => void>
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
    unprotectedViews: Map<string, SourceStatement>;
    foreignKeys: Array<SourceStatement & { table: string; columns: string[] }>;
    indexed: Map<string, string[][]>;
    policies: Map<string, Map<string, SqlNodeFields['CreatePolicyStmt']>>;
    functions: Map<string, FunctionSecurity>;
};

export type SchemaState = Pick<Schema, 'tables' | 'secured' | 'unprotectedViews' | 'policies' | 'functions'> & {
    indexes: Array<{ schema: string | undefined; table: string; name: string; columns: string[]; constraint: string }>;
    constraints: Map<string, Map<string, Schema['foreignKeys'][number]>>;
};

export type Location = { migration: Migration; statement: SqlStatement; table: string };

export type MigrationRead = { migrations: Migration[]; findings: CheckFinding[] };

type MigrationStatement = { migration: Migration; statement: SqlStatement };

export type FunctionSecurity = MigrationStatement & { definer: boolean; path: boolean };
