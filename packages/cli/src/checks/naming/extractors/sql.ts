import type { Identifier } from '#cli/types/checks.ts';
import { SQL_LABELS } from '#cli/config/checks/naming.ts';
import { sqlFile, positionAt } from '#cli/parsers/sql/statements.ts';
import { textOf, nodesOf, partsOf } from '#cli/parsers/sql/parser.ts';
import type { SourceReads } from '#cli/types/repository/repository.ts';
import type { SqlFile, SqlNode, SqlNamed, SqlStatementView } from '#cli/types/parsers/sql.ts';

function addedColumns(fields: SqlNode): SqlNamed[] {
    return nodesOf(fields['cmds'], 'AlterTableCmd')
        .filter((command) => command['subtype'] === 'AT_AddColumn')
        .flatMap((command) =>
            nodesOf([command['def']], 'ColumnDef').map((column) => ({
                category: 'columns',
                name: textOf(column['colname']),
            })),
        );
}

const READERS: Record<string, (fields: SqlNode) => SqlNamed[]> = {
    CreateSchemaStmt: (fields) => [{ category: 'schemas', name: textOf(fields['schemaname']) }],
    CreateStmt: (fields) => [
        { category: 'tables', name: textOf((fields['relation'] as SqlNode | undefined)?.['relname']) },
        ...nodesOf(fields['tableElts'], 'ColumnDef').map((column) => ({
            category: 'columns',
            name: textOf(column['colname']),
        })),
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
                    kind: `sql ${SQL_LABELS[entry.category] ?? entry.category}`,
                    name: entry.name,
                },
            ];
        });
}

/**
 * The identifiers a valid SQL file declares. Parse failures stop the analysis.
 * @param file the file path
 * @param source the file text
 * @param reads optional execution reads shared by SQL checks
 * @returns the identifiers
 */
export async function sqlIdentifiers(file: string, source: string, reads?: SourceReads): Promise<Identifier[]> {
    const parsed = await sqlFile(source, reads);
    if (parsed.error !== undefined)
        throw new Error(
            `SQL parse failed at ${String(parsed.error.line)}:${String(parsed.error.column)}: ${parsed.error.text}`,
        );
    return parsed.statements.flatMap((statement) => identifiers(file, source, statement, parsed));
}
