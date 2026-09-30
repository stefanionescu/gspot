// The kinds of TOML syntax nodes, named by the literals the parser uses, because the parser keeps its enum private.
import type { Value, Kinded, KeyValue, NodeKind, TomlBlock } from '#cli/types/policy/policy.ts';

const VALUE_KINDS = new Set(['String', 'Integer', 'Float', 'Boolean', 'DateTime', 'InlineArray', 'InlineTable']);
const KINDS = new Set([
    ...VALUE_KINDS,
    'Document',
    'Table',
    'TableKey',
    'TableArray',
    'TableArrayKey',
    'KeyValue',
    'Key',
    'InlineItem',
    'Comment',
]);

/**
 * The kind of a syntax node as the literal the parser names it by.
 * @param node the syntax node
 * @returns the kind
 */
export function kindOf(node: Kinded): NodeKind {
    const kind = String(node.type);
    if (!KINDS.has(kind)) throw new Error(`The TOML parser produced a node of an unknown kind: ${kind}.`);
    return kind as NodeKind;
}

/**
 * Identify TOML values among concrete syntax nodes.
 * @param node the syntax node.
 * @returns whether the node represents a TOML value.
 */
export function isTomlValue(node: Kinded): node is Value {
    return VALUE_KINDS.has(kindOf(node));
}

/**
 * Identify a key assignment.
 * @param node the syntax node
 * @returns whether the node assigns a key
 */
export function isKeyValue(node: Kinded): node is KeyValue {
    return kindOf(node) === 'KeyValue';
}

/**
 * Identify a comment.
 * @param node the syntax node
 * @returns whether the node is a comment
 */
export function isComment(node: Kinded): node is Extract<TomlBlock, { type: 'Comment' }> {
    return kindOf(node) === 'Comment';
}

/**
 * Identify an array-of-tables header.
 * @param node the syntax node
 * @returns whether the node opens an array of tables
 */
export function isTableArray(node: Kinded): node is Extract<TomlBlock, { type: 'TableArray' }> {
    return kindOf(node) === 'TableArray';
}

/**
 * Identify an inline table.
 * @param node the syntax node
 * @returns whether the node is an inline table
 */
export function isInlineTable(node: Kinded): node is Extract<Value, { type: 'InlineTable' }> {
    return kindOf(node) === 'InlineTable';
}

/**
 * Identify an inline array.
 * @param node the syntax node
 * @returns whether the node is an inline array
 */
export function isInlineArray(node: Kinded): node is Extract<Value, { type: 'InlineArray' }> {
    return kindOf(node) === 'InlineArray';
}
