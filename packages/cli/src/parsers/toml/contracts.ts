import { valueAt } from '#cli/platform/contracts.ts';
import { parseDocument } from '@decimalturn/toml-patch';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import { VALUE_KINDS, NODE_KIND_SET } from '#cli/config/parsers/toml.ts';

import type {
    Value,
    Kinded,
    Comment,
    KeyValue,
    NodeKind,
    TomlBlock,
    TomlSyntax,
    InlineArray,
    InlineTable,
    SourceRange,
    TomlComments,
    TomlSyntaxEntry,
    TomlOwnedComment,
    TomlTablePositions,
} from '#cli/types/parsers/toml.ts';

function tablePath(node: Exclude<TomlBlock, KeyValue | Comment>, positions: TomlTablePositions): KeyPath {
    const path: KeyPath = [];
    for (const [index, key] of node.key.item.value.entries()) {
        path.push(key);
        if (!Array.isArray(valueAt(positions.value, path))) continue;
        const name = JSON.stringify(node.key.item.value.slice(0, index + 1));
        let position = positions.active.get(name) ?? 0;
        if (getKind(node) === 'TableArray' && index === node.key.item.value.length - 1) {
            position = positions.counts.get(name) ?? 0;
            positions.counts.set(name, position + 1);
            positions.active.set(name, position);
        }
        path.push(position);
    }
    return path;
}

function valueEntries(node: Value, path: KeyPath): TomlSyntax['entries'] {
    if (isInlineArray(node))
        return node.items.flatMap(({ item }, index): TomlSyntax['entries'] => {
            if (!isValue(item)) throw new Error('The native parser produced a non-value array item.');
            const child = [...path, index];
            return [{ kind: 'item', path: child, node: item }, ...valueEntries(item, child)];
        });
    if (isInlineTable(node))
        return node.items.flatMap(({ item }): TomlSyntax['entries'] => {
            const child = [...path, ...item.key.value];
            return [{ kind: 'key', path: child, node: item }, ...valueEntries(item.value, child)];
        });
    return [];
}

/**
 * Index concrete key, header and array-item owners without changing native layout.
 * @param source authored TOML text
 * @param value parsed native values
 * @returns semantic owners and source-ordered physical comments
 */
export function tomlSyntax(source: string, value: Record<string, unknown>): TomlSyntax {
    const document = parseDocument(source);
    const comments: TomlSyntax['comments'] = [];
    const positions = { value, counts: new Map<string, number>(), active: new Map<string, number>() };
    const entries = document.cst.flatMap((node): TomlSyntax['entries'] => {
        if (isComment(node)) {
            comments.push(node);
            return [];
        }
        if (isKeyValue(node))
            return [{ kind: 'key', path: node.key.value, node }, ...valueEntries(node.value, node.key.value)];
        const path = tablePath(node, positions);
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
                ...valueEntries(child.value, [...path, ...child.key.value]),
            ];
        });
        return [{ kind: 'header', path, node: node.key }, ...children];
    });
    return {
        document,
        value,
        entries,
        comments: comments.toSorted((left, right) => tomlRange(left)[0] - tomlRange(right)[0]),
    };
}

/**
 * Find the key, header or item described by an inline or contiguous leading comment.
 * @param syntax original semantic owners
 * @param comment a concrete comment token
 * @returns its semantic owner, or no owner for separate prose
 */
export function tomlCommentOwner(syntax: TomlSyntax, comment: Comment): TomlSyntaxEntry | undefined {
    const inline = syntax.entries
        .filter(
            ({ node }) =>
                node.loc.end.line === comment.loc.start.line && node.loc.end.column <= comment.loc.start.column,
        )
        .toSorted((left, right) => tomlRange(left.node)[1] - tomlRange(right.node)[1])
        .at(-1);
    if (inline !== undefined) return inline;
    const next = syntax.entries.find(({ node }) => tomlRange(node)[0] > tomlRange(comment)[1]);
    let end = comment.loc.end.line;
    while (
        syntax.comments.some(({ loc }) => loc.start.line === end + 1 && loc.start.column === comment.loc.start.column)
    )
        end++;
    return next?.node.loc.start.line === end + 1 ? next : undefined;
}

/**
 * Place comments immediately before their own key, header or array item, without column alignment.
 * @param comments the original semantic ownership
 * @param kind the concrete syntax owner
 * @param path the canonical key or array-item path
 * @param text the native syntax of that owner
 * @returns syntax with exact source-ordered leading comments
 */
export function emitTomlComments(comments: TomlComments, kind: string, path: KeyPath, text: string): string {
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
 * Retain a physical comment's semantic identity through native document edits.
 * @param syntax indexed native syntax
 * @returns comments with their original owners and stable path identities
 */
export function tomlCommentOwners(syntax: TomlSyntax): TomlOwnedComment[] {
    return syntax.comments.map((comment) => {
        const owner = tomlCommentOwner(syntax, comment);
        const identity = owner === undefined ? 'free' : JSON.stringify([owner.kind, ...owner.path]);
        return { comment, owner, identity };
    });
}

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
