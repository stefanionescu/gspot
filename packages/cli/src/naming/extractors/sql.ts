// Identifiers a SQL file declares: schemas, tables, columns, functions, parameters, indexes, triggers and policies.
import type { Identifier } from '#types/naming.ts';
import { nodesOf, partsOf, textOf } from '#cli/readers/sql/tree.ts';
import { positionAt, sqlFile } from '#cli/readers/sql/statements.ts';
import type { SqlNamed, SqlNode, SqlStatementView } from '#types/sql.ts';

function columns(elements: unknown): SqlNamed[] {
    return nodesOf(elements, 'ColumnDef').map((column) => ({ category: 'columns', name: textOf(column['colname']) }));
}

function lastName(parts: unknown): string {
    return partsOf(parts).at(-1) ?? '';
}

function addedColumns(fields: SqlNode): SqlNamed[] {
    return nodesOf(fields['cmds'], 'AlterTableCmd')
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
    CreateSchemaStmt: (fields) => [{ category: 'schemas', name: textOf(fields['schemaname']) }],
    CreateStmt: (fields) => [
        { category: 'tables', name: textOf((fields['relation'] as SqlNode | undefined)?.['relname']) },
        ...columns(fields['tableElts']),
    ],
    ViewStmt: (fields) => [{ category: 'tables', name: textOf((fields['view'] as SqlNode | undefined)?.['relname']) }],
    AlterTableStmt: addedColumns,
    IndexStmt: (fields) => [{ category: 'indexes', name: textOf(fields['idxname']) }],
    CreateTrigStmt: (fields) => [{ category: 'triggers', name: textOf(fields['trigname']) }],
    CreatePolicyStmt: (fields) => [{ category: 'policies', name: textOf(fields['policy_name']) }],
    CreateFunctionStmt: (fields) => [
        { category: 'functions', name: lastName(fields['funcname']) },
        ...nodesOf(fields['parameters'], 'FunctionParameter').map((parameter) => ({
            category: 'parameters',
            name: textOf(parameter['name']),
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
