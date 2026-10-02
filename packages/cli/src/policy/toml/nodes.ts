// The kinds of TOML syntax nodes, named by the literals the parser uses, because the parser keeps its enum private.
import type { Value, Kinded, KeyValue, NodeKind, TomlBlock } from '#cli/types/policy/toml.ts';

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
function getKind(node: Kinded): NodeKind {
    const kind = String(node.type);
    if (!KINDS.has(kind)) throw new Error(`The TOML parser produced a node of an unknown kind: ${kind}.`);
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
export function isComment(node: Kinded): node is Extract<TomlBlock, { type: 'Comment' }> {
    return getKind(node) === 'Comment';
}

/**
 * Identify an inline table.
 * @param node the syntax node
 * @returns whether the node is an inline table
 */
export function isInlineTable(node: Kinded): node is Extract<Value, { type: 'InlineTable' }> {
    return getKind(node) === 'InlineTable';
}

/**
 * Identify an inline array.
 * @param node the syntax node
 * @returns whether the node is an inline array
 */
export function isInlineArray(node: Kinded): node is Extract<Value, { type: 'InlineArray' }> {
    return getKind(node) === 'InlineArray';
}
