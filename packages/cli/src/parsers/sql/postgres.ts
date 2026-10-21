import type { Parsed } from '#cli/types/shapes.ts';
import { computePosition } from '#cli/system/text.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { Node, RawStmt, ParseResult } from '@pgsql/types';
import { replacePsqlSyntax } from '#cli/parsers/sql/tokens.ts';
import type { SqlFile, SqlNodeFields, SqlStatementView, SqlStatementVisitors } from '#cli/types/parsers/sql.ts';

const PARSED_SQL_FILES = { create: () => new Map<string, Promise<SqlFile>>() };

function buildStatementViews(bytes: Buffer, statement: RawStmt): SqlStatementView[] {
    if (statement.stmt === undefined) return [];
    const start = bytes.subarray(0, statement.stmt_location ?? 0).toString('utf8').length;
    return Object.entries(statement.stmt).map(([kind, fields]) => ({ kind, fields, start }) as SqlStatementView);
}

/**
 * Parses a file as Postgres reads it.
 *
 * @param text the original source before replacing psql commands and variables.
 * @returns the statements, or the parse error with its position.
 */
async function parseSqlText(text: string): Promise<SqlFile> {
    const { text: source, variables } = replacePsqlSyntax(text);
    if (source.trim() === '') return { source, variables, statements: [], error: undefined };
    const parsed = await parsePostgres(source);
    const bytes = Buffer.from(source, 'utf8');
    if ('error' in parsed) {
        let offset = 0;
        let remaining = Math.min(parsed.error.offset, [...source].length);
        for (const character of source) {
            if (remaining <= 0) break;
            offset += character.length;
            remaining -= 1;
        }
        return {
            source,
            variables,
            statements: [],
            error: { text: parsed.error.text, ...computePosition(text, offset) },
        };
    }
    const statements = parsed.value.stmts ?? [];
    return {
        source,
        variables,
        statements: statements.flatMap((statement) => buildStatementViews(bytes, statement)),
        error: undefined,
    };
}

/**
 * Parse SQL text, and keep syntax errors without hiding parser load failures.
 *
 * @param text the SQL.
 * @returns the tree, or the error with its zero-based Unicode offset.
 */
async function parsePostgres(text: string): Promise<Parsed<ParseResult, { text: string; offset: number }>> {
    const { SqlError, parse: parseSql } = await import('libpg-query');
    try {
        return { value: await parseSql(text) };
    } catch (error) {
        if (!(error instanceof SqlError) || error.sqlDetails === undefined) throw error;
        return { error: { text: error.message, offset: error.sqlDetails.cursorPosition } };
    }
}

/**
 * Select one payload from the one-key node union of PostgreSQL.
 *
 * @param node the parse tree item, if any.
 * @param kind the payload type to select.
 * @returns the typed fields of that kind, or undefined for another kind.
 */
export function getNodeFields<Kind extends keyof SqlNodeFields>(
    node: Node | undefined,
    kind: Kind,
): SqlNodeFields[Kind] | undefined {
    if (node === undefined || !(kind in node)) return undefined;
    return (node as Record<Kind, SqlNodeFields[Kind]>)[kind];
}

/**
 * Select the typed payloads of one kind from a node list.
 *
 * @param list the nodes, if any.
 * @param kind the payload type to select.
 * @returns the matching payloads in source order.
 */
export function listNodeFields<Kind extends keyof SqlNodeFields>(
    list: Node[] | undefined,
    kind: Kind,
): SqlNodeFields[Kind][] {
    return (list ?? []).flatMap((node) => {
        const fields = getNodeFields(node, kind);
        return fields === undefined ? [] : [fields];
    });
}

/**
 * Pass a parsed statement to the reader for its kind.
 *
 * @param statement the parse result and source offset.
 * @param readers the functions for each kind.
 * @param readerArguments the extra values to pass on.
 * @returns the result, or undefined for a kind without a reader.
 */
export function visitStatement<Result, Arguments extends unknown[]>(
    statement: SqlStatementView,
    readers: SqlStatementVisitors<Result, Arguments>,
    ...readerArguments: Arguments
): Result | undefined {
    const read = readers[statement.kind] as
        | ((statement: SqlStatementView, ...readerArguments: Arguments) => Result)
        | undefined;
    return read?.(statement, ...readerArguments);
}

/**
 * Parse a PostgreSQL file once per run.
 *
 * @param text the original SQL, including supported psql syntax.
 * @param reads the run cache.
 * @returns the statements and the original error positions.
 */
export function parseSqlFile(text: string, reads: ReadCache): Promise<SqlFile> {
    const files = getCachedValue(reads, PARSED_SQL_FILES);
    let parsed = files.get(text);
    if (parsed === undefined) {
        parsed = parseSqlText(text);
        files.set(text, parsed);
    }
    return parsed;
}
