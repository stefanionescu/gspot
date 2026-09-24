// Reading the parse tree: a list of nodes of one kind, and the text a field holds.
import type { SqlNode } from '#cli/parsers/sql/types.ts';

/**
 * The nodes of one kind in a list field. Every item of a list is a table of one key, the node kind.
 * @param list the field, a list or nothing
 * @param kind the node kind wanted
 * @returns the fields of each node of that kind
 */
export function nodesOf(list: unknown, kind: string): SqlNode[] {
    const items = Array.isArray(list) ? (list as SqlNode[]) : [];
    return items.flatMap((item) => (item[kind] === undefined ? [] : [item[kind] as SqlNode]));
}

/**
 * The text of a field, or an empty string when the field holds something else.
 * @param field the field
 * @returns the text
 */
export function textOf(field: unknown): string {
    return typeof field === 'string' ? field : '';
}

/**
 * The texts of a list of String nodes, such as a qualified name.
 * @param list the field
 * @returns each part
 */
export function partsOf(list: unknown): string[] {
    return nodesOf(list, 'String').map((node) => textOf(node['sval']));
}
