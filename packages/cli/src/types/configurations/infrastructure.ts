import type { z } from 'zod';
import type { Scalar } from 'yaml';
import type { AlterTableCmd } from '@pgsql/types';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { WORKFLOW_SHAPE_RULES } from '#cli/config/configurations/infrastructure.ts';
import type { composeSchema, supabaseProjectFileSchema } from '#cli/schemas/configurations.ts';
import type { SqlFile, SqlStatement, NumberedLine, SqlNodeFields } from '#cli/types/parsers.ts';

export type SourceStatement = { path: string; offset: number; text: string };

export type StatementReader<Kind extends keyof SqlNodeFields> = (
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
    foreignKeys: (SourceStatement & { table: string; columns: string[] })[];
    indexed: Map<string, string[][]>;
};

export type SchemaState = Pick<Schema, 'tables' | 'secured' | 'unprotectedViews'> & {
    indexes: { schema: string | undefined; table: string; name: string; columns: string[]; constraint: string }[];
    constraints: Map<string, Map<string, Schema['foreignKeys'][number]>>;
};

export type StoragePolicies = Map<string, SqlNodeFields['CreatePolicyStmt']>;

export type WorkflowShapeHit = { kind: keyof typeof WORKFLOW_SHAPE_RULES; node: Scalar };

export type DockerInstruction = { name: string; text: string; line: number };

export type Location = { migration: Migration; statement: SqlStatement; table: string };

export type MigrationRead = { migrations: Migration[]; findings: CheckFinding[] };

type MigrationStatement = { migration: Migration; statement: SqlStatement };

export type FunctionSecurity = MigrationStatement & { definer: boolean; path: boolean };

export type ComposeDeclaration = {
    name: string;
    path: string;
    service: NonNullable<z.infer<typeof composeSchema>['services']>[string];
};

export type DockerIgnoredSource = { line: number; source: string };

export type ComposeFiles = { last: TrackedFile; before: TrackedFile[] };

export type ComposeDocuments = {
    findings: CheckFinding[];
    declarations: ComposeDeclaration[];
    contexts: Map<string, string[]>;
};

export type ImageFinding = { rule: string; message: string };

export type Mount = { path: string; source: string; target: string; text: string };

export type NginxMounts = { configs: Pick<Mount, 'source' | 'target'>[]; certificate: string; key: string };

export type HeaderBlock = { path: string; headers: { name: string; value: string }[] };

export type ParsedHeadersFile = { blocks: HeaderBlock[]; errors: NumberedLine[] };

export type SupabaseProjectFile = z.infer<typeof supabaseProjectFileSchema>;

export type FunctionEntrypoint = { path: string; importMap?: string | undefined };

export type SqlStatementVisitors<Result, Arguments extends unknown[] = []> = {
    [Kind in keyof SqlNodeFields]?: (statement: SqlStatement<Kind>, ...readerArguments: Arguments) => Result;
};
