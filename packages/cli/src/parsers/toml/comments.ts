// Keep TOML comments at their syntax entries.
import { getValueAt } from '#cli/system/values.ts';
import { parseDocument } from '@decimalturn/toml-patch';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';

import {
    type TomlBlock,
    type TomlValue,
    type TomlSyntax,
    type SourceRange,
    type TomlComments,
    type TomlKeyValue,
    type TomlPathNode,
    type TomlCommentNode,
    type TomlTablePositions,
    type TomlAnchoredComment,
    type TomlCommentPlacement,
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

function listNestedNodes(node: TomlValue, path: KeyPath): TomlSyntax['pathNodes'] {
    if (isTomlKind(node, 'InlineArray'))
        return node.items.flatMap(({ item }, index): TomlSyntax['pathNodes'] => {
            const value = item as TomlValue;
            const child = [...path, index];
            return [{ kind: 'item', path: child, node: value }, ...listNestedNodes(value, child)];
        });
    if (isTomlKind(node, 'InlineTable'))
        return node.items.flatMap(({ item }): TomlSyntax['pathNodes'] => {
            const child = [...path, ...item.key.value];
            return [{ kind: 'key', path: child, node: item }, ...listNestedNodes(item.value, child)];
        });
    return [];
}

/**
 * Find the key, header, or item that an inline or adjacent leading comment describes.
 * @param syntax the indexed document.
 * @param comment a concrete `#` token.
 * @returns its syntax entry, or no entry for a separate comment.
 */
function findCommentAnchor(syntax: TomlSyntax, comment: TomlCommentNode): TomlPathNode | undefined {
    const inline = syntax.pathNodes
        .filter(
            ({ node }) =>
                node.loc.end.line === comment.loc.start.line && node.loc.end.column <= comment.loc.start.column,
        )
        .toSorted((left, right) => getTomlRange(left.node)[1] - getTomlRange(right.node)[1])
        .at(-1);
    if (inline !== undefined) return inline;
    const next = syntax.pathNodes.find(({ node }) => getTomlRange(node)[0] > getTomlRange(comment)[1]);
    let end = comment.loc.end.line;
    while (
        syntax.comments.some(({ loc }) => loc.start.line === end + 1 && loc.start.column === comment.loc.start.column)
    )
        end++;
    return next?.node.loc.start.line === end + 1 ? next : undefined;
}

/**
 * Narrow a parsed TOML node by the syntax kind of the library.
 * @param node the parsed item to test.
 * @param node.type its library enum value.
 * @param kind the type name to match.
 * @returns whether the node has that kind.
 */
function isTomlKind<Kind extends string>(
    node: { type: unknown },
    kind: Kind,
): node is Extract<TomlBlock | TomlValue, { type: Kind }> {
    return String(node.type) === kind;
}

/**
 * Index concrete keys, headers, and array items without changing layout.
 * @param source TOML text.
 * @param value what the TOML parser returned.
 * @returns syntax entries and source-ordered comments.
 */
function parseTomlSyntax(source: string, value: Record<string, unknown>): TomlSyntax {
    const document = parseDocument(source);
    const comments: TomlSyntax['comments'] = [];
    const positions = { value, counts: new Map<string, number>(), active: new Map<string, number>() };
    const entries = document.cst.flatMap((node): TomlSyntax['pathNodes'] => {
        if (isTomlKind(node, 'Comment')) {
            comments.push(node);
            return [];
        }
        if (isTomlKind(node, 'KeyValue'))
            return [{ kind: 'key', path: node.key.value, node }, ...listNestedNodes(node.value, node.key.value)];
        const path = buildTablePath(node, positions);
        const children = node.items.flatMap((child): TomlSyntax['pathNodes'] => {
            if (isTomlKind(child, 'Comment')) {
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
        pathNodes: entries,
        comments: comments.toSorted((left, right) => getTomlRange(left)[0] - getTomlRange(right)[0]),
    };
}

/**
 * Place comments just before their own key, header, or array item, without column alignment.
 * @param comments the original syntax entries.
 * @param kind the type of the entry.
 * @param path the keys and array indexes of the entry.
 * @param text the entry contents.
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
 * Keep each comment tied to its entry through document edits.
 * @param syntax the indexed entries.
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
 * Read the extent of a parsed syntax token.
 * @param node parsed syntax.
 * @returns the start and end offsets.
 */
function getTomlRange(node: SourceRange): readonly [number, number] {
    if (node.range === undefined) throw new Error('The TOML parser omitted a source range.');
    return node.range;
}

/**
 * Add a source comment to its retained TOML entry.
 * @param comments the collected comment blocks.
 * @param entry what to add, and where.
 */
function addTomlComment(comments: TomlComments, entry: TomlCommentPlacement): void {
    const { kind, path, comment, placement } = entry;
    if (path === undefined) return;
    const id = JSON.stringify([kind, ...path]);
    const block = comments.get(id) ?? { path, owned: [], free: [] };
    block[placement].push({
        raw: comment.raw,
        start: getTomlRange(comment)[0],
        line: comment.loc.start.line,
    });
    comments.set(id, block);
}

export { isTomlKind, getTomlRange, addTomlComment, parseTomlSyntax, insertTomlComments, listAnchoredComments };
