// SQL payloads use PostgreSQL's native node union; procedural output has a separate external shape.
import type { Node } from '@pgsql/types';
import { SqlError, parse as parseSql } from 'libpg-query';
import type { SqlParse, SqlNodeFields, SqlStatementView, SqlStatementReaders } from '#cli/types/parsers/sql.ts';

/**
 * Parses SQL text and retains syntax diagnostics without hiding parser-loading failures.
 * @param text the SQL
 * @returns the tree, or its zero-based Unicode diagnostic offset
 */
export async function parse(text: string): Promise<SqlParse> {
    try {
        // An empty SQL function body is valid input to PostgreSQL; the public API refuses an empty string.
        return { tree: await parseSql(text === '' ? ' ' : text), error: undefined };
    } catch (error) {
        if (!(error instanceof SqlError) || error.sqlDetails === undefined) throw error;
        return { tree: undefined, error: { text: error.message, offset: error.sqlDetails.cursorPosition } };
    }
}

/**
 * Selects one payload from PostgreSQL's one-key native node union.
 * @param node the native node, when present
 * @param kind the wanted native kind
 * @returns that kind's typed fields, or nothing for a different kind
 */
export function nodeOf<Kind extends keyof SqlNodeFields>(
    node: Node | undefined,
    kind: Kind,
): SqlNodeFields[Kind] | undefined {
    if (node === undefined || !(kind in node)) return undefined;
    return (node as Record<Kind, SqlNodeFields[Kind]>)[kind];
}

/**
 * Selects the typed payloads of one kind from a native node list.
 * @param list the optional node list
 * @param kind the wanted native kind
 * @returns the matching payloads in source order
 */
export function nodesOf<Kind extends keyof SqlNodeFields>(list: Node[] | undefined, kind: Kind): SqlNodeFields[Kind][] {
    return (list ?? []).flatMap((node) => {
        const fields = nodeOf(node, kind);
        return fields === undefined ? [] : [fields];
    });
}

/**
 * Dispatches a correlated native statement to its typed reader.
 * @param statement the parsed statement and source offset
 * @param readers the readers indexed by native kind
 * @param args the required reader context
 * @returns the reader result, or nothing for a kind without a reader
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
 * Reads the text parts of a qualified native name.
 * @param list the optional list of String nodes
 * @returns each part in source order
 */
export function partsOf(list: Node[] | undefined): string[] {
    return nodesOf(list, 'String').map((node) => node.sval ?? '');
}
