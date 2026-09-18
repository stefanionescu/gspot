// Identifiers a SQL file declares: schemas, tables, columns, functions, parameters, indexes, triggers and policies.
import type { Identifier } from '#types/naming.ts';
import { positionAt, sqlFile } from '#cli/sql/statements.ts';
import type { SqlNamed, SqlNode, SqlStatementView } from '#types/sql.ts';

function nodes(value: unknown, kind: string): SqlNode[] {
    const list = Array.isArray(value) ? (value as SqlNode[]) : [];
    return list.flatMap((item) => (item[kind] === undefined ? [] : [item[kind] as SqlNode]));
}

function text(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function columns(elements: unknown): SqlNamed[] {
    return nodes(elements, 'ColumnDef').map((column) => ({ category: 'columns', name: text(column['colname']) }));
}

function lastName(parts: unknown): string {
    return text(nodes(parts, 'String').at(-1)?.['sval']);
}

function addedColumns(fields: SqlNode): SqlNamed[] {
    return nodes(fields['cmds'], 'AlterTableCmd')
        .filter((command) => command['subtype'] === 'AT_AddColumn')
        .flatMap((command) => columns([command['def']]));
}

const LABELS: Record<string, string> = {
    schemas: 'schema',
    tables: 'table',
    columns: 'column',
    indexes: 'index',
    triggers: 'trigger',
    policies: 'policy',
    functions: 'function',
    parameters: 'parameter',
};

const READERS: Record<string, (fields: SqlNode) => SqlNamed[]> = {
    CreateSchemaStmt: (fields) => [{ category: 'schemas', name: text(fields['schemaname']) }],
    CreateStmt: (fields) => [
        { category: 'tables', name: text((fields['relation'] as SqlNode | undefined)?.['relname']) },
        ...columns(fields['tableElts']),
    ],
    ViewStmt: (fields) => [{ category: 'tables', name: text((fields['view'] as SqlNode | undefined)?.['relname']) }],
    AlterTableStmt: addedColumns,
    IndexStmt: (fields) => [{ category: 'indexes', name: text(fields['idxname']) }],
    CreateTrigStmt: (fields) => [{ category: 'triggers', name: text(fields['trigname']) }],
    CreatePolicyStmt: (fields) => [{ category: 'policies', name: text(fields['policy_name']) }],
    CreateFunctionStmt: (fields) => [
        { category: 'functions', name: lastName(fields['funcname']) },
        ...nodes(fields['parameters'], 'FunctionParameter').map((parameter) => ({
            category: 'parameters',
            name: text(parameter['name']),
        })),
    ],
};

function identifiers(file: string, source: string, statement: SqlStatementView): Identifier[] {
    const named = READERS[statement.kind]?.(statement.fields) ?? [];
    return named
        .filter((entry) => entry.name !== '')
        .map((entry) => {
            const found = source.indexOf(entry.name, statement.start);
            return {
                file,
                ...positionAt(source, found === -1 ? statement.start : found),
                language: 'sql',
                category: entry.category,
                kind: `sql ${LABELS[entry.category] ?? entry.category}`,
                name: entry.name,
            };
        });
}

/**
 * The identifiers a SQL file declares. A file that does not parse declares none; the syntax check reports it.
 * @param file the file path
 * @param source the file text
 * @returns the identifiers
 */
export async function sqlIdentifiers(file: string, source: string): Promise<Identifier[]> {
    const parsed = await sqlFile(source);
    return parsed.statements.flatMap((statement) => identifiers(file, source, statement));
}
