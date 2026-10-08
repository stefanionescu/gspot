import { VALUE_KINDS, NODE_KIND_SET } from '#cli/config/parsers/toml.ts';

import type {
    Value,
    Kinded,
    Comment,
    KeyValue,
    NodeKind,
    InlineArray,
    InlineTable,
    SourceRange,
} from '#cli/types/parsers/toml.ts';

/**
 * The kind of a syntax node as the literal the parser names it by.
 * @param node the syntax node
 * @returns the kind
 */
export function getKind(node: Kinded): NodeKind {
    const kind = String(node.type);
    if (!NODE_KIND_SET.has(kind)) throw new Error(`The TOML parser produced a node of an unknown kind: ${kind}.`);
    return kind as NodeKind;
}

/**
 * Identify TOML values among concrete syntax nodes.
 * @param node the syntax node.
 * @returns whether the node represents a TOML value.
 */
export function isValue(node: Kinded): node is Value {
    return VALUE_KINDS.has(getKind(node));
}

/**
 * Identify a key assignment.
 * @param node the syntax node
 * @returns whether the node assigns a key
 */
export function isKeyValue(node: Kinded): node is KeyValue {
    return getKind(node) === 'KeyValue';
}

/**
 * Identify a comment.
 * @param node the syntax node
 * @returns whether the node is a comment
 */
export function isComment(node: Kinded): node is Comment {
    return getKind(node) === 'Comment';
}

/**
 * Identify an inline table.
 * @param node the syntax node
 * @returns whether the node is an inline table
 */
export function isInlineTable(node: Kinded): node is InlineTable {
    return getKind(node) === 'InlineTable';
}

/**
 * Identify an inline array.
 * @param node the syntax node
 * @returns whether the node is an inline array
 */
export function isInlineArray(node: Kinded): node is InlineArray {
    return getKind(node) === 'InlineArray';
}

/**
 * Retrieve the extent of a concrete syntax token produced by the native parser.
 * @param node parsed syntax
 * @returns the token's source extent
 */
export function tomlRange(node: SourceRange): readonly [number, number] {
    if (node.range === undefined) throw new Error('The TOML parser omitted a source range.');
    return node.range;
}
