// Reads PostgreSQL statements and their parse trees.
// SQL payloads use PostgreSQL's node union; procedural output has a separate external shape.
import type { Parsed } from '#cli/types/errors.ts';
import { maskPsqlSyntax } from '#cli/parsers/sql/lexer.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { Node, RawStmt, ParseResult } from '@pgsql/types';
import { computePosition, codePointLength } from '#cli/system/text.ts';
import type { SqlFile, SqlNodeFields, SqlStatementView, SqlStatementReaders } from '#cli/types/parsers/sql.ts';

const SQL_MEMO = { create: () => new Map<string, Promise<SqlFile>>() };

function statementView(bytes: Buffer, statement: RawStmt): SqlStatementView[] {
    if (statement.stmt === undefined) return [];
    const start = bytes.subarray(0, statement.stmt_location ?? 0).toString('utf8').length;
    return Object.entries(statement.stmt).map(([kind, fields]) => ({ kind, fields, start }) as SqlStatementView);
}

/**
 * Parses a file as Postgres reads it.
 * @param text the SQL text.
 * @returns the statements, or the parse error with its position.
 */
async function parseSqlText(text: string): Promise<SqlFile> {
    const prepared = maskPsqlSyntax(text);
    const source = prepared.text;
    const variables = prepared.variables;
    if (source.trim() === '') return { source, variables, statements: [], error: undefined };
    const parsed = await parsePostgres(source);
    const bytes = Buffer.from(source, 'utf8');
    if ('error' in parsed) {
        let offset = 0;
        let remaining = Math.min(parsed.error.offset, codePointLength(source));
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
        statements: statements.flatMap((statement) => statementView(bytes, statement)),
        error: undefined,
    };
}

/**
 * Parses SQL text and retains syntax diagnostics without hiding parser-loading failures.
 * @param text the SQL.
 * @returns the tree, or its zero-based Unicode diagnostic offset.
 */
export async function parsePostgres(text: string): Promise<Parsed<ParseResult, { text: string; offset: number }>> {
    const { SqlError, parse: parseSql } = await import('libpg-query');
    try {
        // PostgreSQL accepts empty function bodies; the public API refuses an empty string.
        return { value: await parseSql(text === '' ? ' ' : text) };
    } catch (error) {
        if (!(error instanceof SqlError) || error.sqlDetails === undefined) throw error;
        return { error: { text: error.message, offset: error.sqlDetails.cursorPosition } };
    }
}

/**
 * Selects one payload from PostgreSQL's one-key node union.
 * @param node the node, when present.
 * @param kind the wanted kind.
 * @returns that kind's typed fields, or nothing for a different kind.
 */
export function nodeOf<Kind extends keyof SqlNodeFields>(
    node: Node | undefined,
    kind: Kind,
): SqlNodeFields[Kind] | undefined {
    if (node === undefined || !(kind in node)) return undefined;
    return (node as Record<Kind, SqlNodeFields[Kind]>)[kind];
}

/**
 * Selects the typed payloads of one kind from a node list.
 * @param list the optional node list.
 * @param kind the wanted kind.
 * @returns the matching payloads in source order.
 */
export function nodesOf<Kind extends keyof SqlNodeFields>(list: Node[] | undefined, kind: Kind): SqlNodeFields[Kind][] {
    return (list ?? []).flatMap((node) => {
        const fields = nodeOf(node, kind);
        return fields === undefined ? [] : [fields];
    });
}

/**
 * Dispatches a correlated statement to its typed reader.
 * @param statement the parsed statement and source offset.
 * @param readers the readers indexed by kind.
 * @param args the required reader context.
 * @returns the reader result, or nothing for a kind without a reader.
 */
export function readStatement<Result, Arguments extends unknown[]>(
    statement: SqlStatementView,
    readers: SqlStatementReaders<Result, Arguments>,
    ...args: Arguments
): Result | undefined {
    const read = readers[statement.kind] as ((statement: SqlStatementView, ...args: Arguments) => Result) | undefined;
    return read?.(statement, ...args);
}

/**
 * Reads the text parts of a qualified name.
 * @param list the optional list of String nodes.
 * @returns each part in source order.
 */
export function partsOf(list: Node[] | undefined): string[] {
    return nodesOf(list, 'String').map((node) => node.sval ?? '');
}

/**
 * Reuses a PostgreSQL file parse within one source read lifetime.
 * @param text the original SQL, including supported psql syntax.
 * @param reads the execution reads, omitted for standalone parsing.
 * @returns statements and original diagnostic positions.
 */
export function parseSqlFile(text: string, reads?: ReadCache): Promise<SqlFile> {
    if (reads === undefined) return parseSqlText(text);
    const files = getCachedValue(reads, SQL_MEMO);
    let parsed = files.get(text);
    if (parsed === undefined) {
        parsed = parseSqlText(text);
        files.set(text, parsed);
    }
    return parsed;
}

/**
 * Visit every named field in an SQL parse tree.
 * @param value the parsed value.
 * @param visit the callback for each field and its value.
 */
export function walkSqlTree(value: unknown, visit: (key: string, child: unknown) => void): void {
    if (Array.isArray(value)) {
        for (const child of value) walkSqlTree(child, visit);
    } else if (value !== null && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            visit(key, child);
            walkSqlTree(child, visit);
        }
    }
}
