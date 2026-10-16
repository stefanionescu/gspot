// Retains TOML comments at their syntax entries.
import { getValueAt } from '#cli/system/values.ts';
import { parseDocument } from '@decimalturn/toml-patch';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';

import type {
    TomlBlock,
    TomlValue,
    TomlSyntax,
    InlineArray,
    InlineTable,
    SourceRange,
    TomlComments,
    TomlKeyValue,
    TomlCommentNode,
    TomlSyntaxEntry,
    TomlTablePositions,
    TomlAnchoredComment,
} from '#cli/types/parsers/toml.ts';

function buildTablePath(
    node: Exclude<TomlBlock, TomlKeyValue | TomlCommentNode>,
    positions: TomlTablePositions,
): KeyPath {
    const path: KeyPath[number][] = [];
    for (const [index, key] of node.key.item.value.entries()) {
        path.push(key);
        if (!Array.isArray(getValueAt(positions.value, path))) continue;
        const name = JSON.stringify(node.key.item.value.slice(0, index + 1));
        let position = positions.active.get(name) ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- reason: Convert the library enum to text before comparing syntax names, as the TOML parser interface requires.
        if (String(node.type) === 'TableArray' && index === node.key.item.value.length - 1) {
            position = positions.counts.get(name) ?? 0;
            positions.counts.set(name, position + 1);
            positions.active.set(name, position);
        }
        path.push(position);
    }
    return path;
}

function listNestedNodes(node: TomlValue, path: KeyPath): TomlSyntax['entries'] {
    if (isInlineArray(node))
        return node.items.flatMap(({ item }, index): TomlSyntax['entries'] => {
            const value = item as TomlValue;
            const child = [...path, index];
            return [{ kind: 'item', path: child, node: value }, ...listNestedNodes(value, child)];
        });
    if (isInlineTable(node))
        return node.items.flatMap(({ item }): TomlSyntax['entries'] => {
            const child = [...path, ...item.key.value];
            return [{ kind: 'key', path: child, node: item }, ...listNestedNodes(item.value, child)];
        });
    return [];
}

/**
 * Find the key, header or item described by an inline or contiguous leading comment.
 * @param syntax original syntax entries.
 * @param comment a concrete comment token.
 * @returns its syntax entry, or no entry for a separate comment.
 */
function findCommentAnchor(syntax: TomlSyntax, comment: TomlCommentNode): TomlSyntaxEntry | undefined {
    const inline = syntax.entries
        .filter(
            ({ node }) =>
                node.loc.end.line === comment.loc.start.line && node.loc.end.column <= comment.loc.start.column,
        )
        .toSorted((left, right) => getTomlRange(left.node)[1] - getTomlRange(right.node)[1])
        .at(-1);
    if (inline !== undefined) return inline;
    const next = syntax.entries.find(({ node }) => getTomlRange(node)[0] > getTomlRange(comment)[1]);
    let end = comment.loc.end.line;
    while (
        syntax.comments.some(({ loc }) => loc.start.line === end + 1 && loc.start.column === comment.loc.start.column)
    )
        end++;
    return next?.node.loc.start.line === end + 1 ? next : undefined;
}

/**
 * Identify a comment.
 * @param node the syntax node.
 * @param node.type the TOML node kind.
 * @returns whether the node denotes a comment.
 */
function isComment(node: { type: unknown }): node is TomlCommentNode {
    return String(node.type) === 'Comment';
}

/**
 * Index concrete keys, headers, and array items without changing layout.
 * @param source TOML text.
 * @param value parsed values.
 * @returns syntax entries and source-ordered comments.
 */
function parseTomlSyntax(source: string, value: Record<string, unknown>): TomlSyntax {
    const document = parseDocument(source);
    const comments: TomlSyntax['comments'] = [];
    const positions = { value, counts: new Map<string, number>(), active: new Map<string, number>() };
    const entries = document.cst.flatMap((node): TomlSyntax['entries'] => {
        if (isComment(node)) {
            comments.push(node);
            return [];
        }
        if (isKeyValue(node))
            return [{ kind: 'key', path: node.key.value, node }, ...listNestedNodes(node.value, node.key.value)];
        const path = buildTablePath(node, positions);
        const children = node.items.flatMap((child): TomlSyntax['entries'] => {
            if (isComment(child)) {
                comments.push(child);
                return [];
            }
            return [
                {
                    kind: 'key',
                    path: [...path, ...child.key.value],
                    node: child,
                },
                ...listNestedNodes(child.value, [...path, ...child.key.value]),
            ];
        });
        return [{ kind: 'header', path, node: node.key }, ...children];
    });
    return {
        document,
        value,
        entries,
        comments: comments.toSorted((left, right) => getTomlRange(left)[0] - getTomlRange(right)[0]),
    };
}

/**
 * Place comments immediately before their own key, header or array item, without column alignment.
 * @param comments the original syntax entrieship.
 * @param kind the syntax entry kind.
 * @param path the key or array-item path.
 * @param text the entry text.
 * @returns syntax with exact source-ordered leading comments.
 */
function insertTomlComments(comments: TomlComments, kind: string, path: KeyPath, text: string): string {
    const id = JSON.stringify([kind, ...path]);
    const block = comments.get(id);
    if (block === undefined) return text;
    comments.delete(id);
    const free = block.free
        .toSorted((left, right) => left.start - right.start)
        .map(
            (comment, index, list) =>
                (index > 0 && comment.line > (list[index - 1]?.line ?? 0) + 1 ? '\n' : '') + comment.raw,
        )
        .join('\n');
    const owned = block.owned.toSorted((left, right) => left.start - right.start).map(({ raw }) => raw);
    return [
        ...(free === '' ? [] : [free, ...(owned.length === 0 && text === '' ? [] : [''])]),
        ...owned,
        ...(text === '' ? [] : [text]),
    ].join('\n');
}

/**
 * Retain a physical comment's semantic identity through document edits.
 * @param syntax indexed syntax.
 * @returns comments with their original anchors and stable path identities.
 */
function listAnchoredComments(syntax: TomlSyntax): TomlAnchoredComment[] {
    return syntax.comments.map((comment) => {
        const anchor = findCommentAnchor(syntax, comment);
        const identity = anchor === undefined ? 'free' : JSON.stringify([anchor.kind, ...anchor.path]);
        return { comment, anchor, identity };
    });
}

/**
 * Identify a key assignment.
 * @param node the syntax node.
 * @param node.type the TOML node kind.
 * @returns whether the node assigns a key.
 */
function isKeyValue(node: { type: unknown }): node is TomlKeyValue {
    return String(node.type) === 'KeyValue';
}

/**
 * Identify an inline table.
 * @param node the syntax node.
 * @param node.type the TOML node kind.
 * @returns whether the node denotes an inline table.
 */
function isInlineTable(node: { type: unknown }): node is InlineTable {
    return String(node.type) === 'InlineTable';
}

/**
 * Identify an inline array.
 * @param node the syntax node.
 * @param node.type the TOML node kind.
 * @returns whether the node denotes an inline array.
 */
function isInlineArray(node: { type: unknown }): node is InlineArray {
    return String(node.type) === 'InlineArray';
}

/**
 * Retrieve the extent of a concrete syntax token produced by the parser.
 * @param node parsed syntax.
 * @returns the token's source extent.
 */
function getTomlRange(node: SourceRange): readonly [number, number] {
    if (node.range === undefined) throw new Error('The TOML parser omitted a source range.');
    return node.range;
}

/**
 * Add a source comment to its retained TOML entry.
 * @param comments the collected comment blocks.
 * @param kind the syntax entry kind.
 * @param path the entry path, absent after removing the entry.
 * @param comment the original comment.
 * @param placement whether it belongs to an entry or stands alone.
 */
function addTomlComment(
    comments: TomlComments,
    kind: string,
    path: KeyPath | undefined,
    comment: TomlCommentNode,
    placement: 'owned' | 'free',
): void {
    if (path === undefined) return;
    const id = JSON.stringify([kind, ...path]);
    const block = comments.get(id) ?? { path, owned: [], free: [] };
    block[kind === 'preamble' ? 'free' : placement].push({
        raw: comment.raw,
        start: getTomlRange(comment)[0],
        line: comment.loc.start.line,
    });
    comments.set(id, block);
}

export {
    isKeyValue,
    getTomlRange,
    isInlineTable,
    isInlineArray,
    addTomlComment,
    parseTomlSyntax,
    insertTomlComments,
    listAnchoredComments,
};
