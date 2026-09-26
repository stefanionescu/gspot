import type { Identifier } from '#cli/checks/naming/extract.ts';
import { nodesOf, partsOf, textOf } from '#cli/parsers/sql/tree.ts';
import type { SourceObservations } from '#cli/repository/tracked.ts';
import { positionAt, sqlFile } from '#cli/parsers/sql/statements.ts';
import type { SqlFile, SqlNamed, SqlNode, SqlStatementView } from '#cli/parsers/sql/types.ts';

function columns(elements: unknown): SqlNamed[] {
    return nodesOf(elements, 'ColumnDef').map((column) => ({ category: 'columns', name: textOf(column['colname']) }));
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
        { category: 'functions', name: partsOf(fields['funcname']).at(-1) ?? '' },
        ...nodesOf(fields['parameters'], 'FunctionParameter').map((parameter) => ({
            category: 'parameters',
            name: textOf(parameter['name']),
        })),
    ],
};

function identifiers(file: string, source: string, statement: SqlStatementView, parsed: SqlFile): Identifier[] {
    const named = READERS[statement.kind]?.(statement.fields) ?? [];
    let offset = statement.start;
    return named
        .filter((entry) => entry.name !== '')
        .flatMap((entry): Identifier[] => {
            const found = parsed.source.indexOf(entry.name, offset);
            if (found !== -1) offset = found + entry.name.length;
            if (parsed.variables.some(({ start, end }) => found >= start && found < end)) return [];
            return [
                {
                    file,
                    ...positionAt(source, found === -1 ? statement.start : found),
                    language: 'sql',
                    category: entry.category,
                    kind: `sql ${LABELS[entry.category] ?? entry.category}`,
                    name: entry.name,
                },
            ];
        });
}

/**
 * The identifiers a valid SQL file declares. Parse failures stop the analysis.
 * @param file the file path
 * @param source the file text
 * @param observations optional execution observations shared by SQL checks
 * @returns the identifiers
 */
export async function sqlIdentifiers(
    file: string,
    source: string,
    observations?: SourceObservations,
): Promise<Identifier[]> {
    const parsed = await sqlFile(source, observations);
    if (parsed.error !== undefined)
        throw new Error(
            `SQL parse failed at ${String(parsed.error.line)}:${String(parsed.error.column)}: ${parsed.error.text}`,
        );
    return parsed.statements.flatMap((statement) => identifiers(file, source, statement, parsed));
}
