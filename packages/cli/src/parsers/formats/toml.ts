import type { z } from 'zod';
import { PATCH_FORMAT } from '#cli/config/parsers/formats/toml.ts';
import { GspotError, parseFileFields } from '#cli/system/errors.ts';
import { isTable, getValueAt, normalizeTables } from '#cli/system/tables.ts';
import type { KeyPath, EditableFile } from '#cli/types/parsers/editable-file.ts';
import { patch, parseDocument, parse as parseToml } from '@decimalturn/toml-patch';

import {
    type TomlBlock,
    type TomlValue,
    type TomlSyntax,
    type SourceRange,
    type TomlComments,
    type TomlKeyValue,
    type TomlPathNode,
    type TomlTextChunk,
    type TomlCommentNode,
    type TomlTableOptions,
    type TomlTablePositions,
    type TomlAnchoredComment,
    type TomlCommentPlacement,
} from '#cli/types/parsers/formats/toml.ts';

function findTomlTable(
    document: Record<string, unknown>,
    options: TomlTableOptions,
): Record<string, unknown> | undefined {
    let table = document;
    for (const key of options.keys) {
        if (!Object.hasOwn(table, key)) {
            if (!options.create) return undefined;
            Object.defineProperty(table, key, {
                value: normalizeTables({}),
                enumerable: true,
                writable: true,
                configurable: true,
            });
        }
        const child = table[key];
        if (!isTable(child))
            throw new GspotError(
                'filesystem',
                `${options.filePath} has a TOML field that is not a table: ${String(key)}. Fix the field, then run gspot apply.`,
            );
        table = child;
    }
    return table;
}

function buildPatchedToml(previous: TomlSyntax, values: Record<string, unknown>): string {
    const patched = patch(previous.document.toTomlString, values, PATCH_FORMAT);
    const reparsed = parseTomlSyntax(patched, values);
    const unmatched = new Set(listAnchoredComments(reparsed));
    const kept = new Set(reparsed.pathNodes.map(({ kind, path }) => JSON.stringify([kind, ...path])));
    const comments: TomlComments = new Map();
    const changed = listAnchoredComments(previous)
        .map((source) => {
            const found = [...unmatched].find(
                (unmatchedComment) => unmatchedComment.comment.raw === source.comment.raw,
            );
            if (found !== undefined) unmatched.delete(found);
            return { source, found };
        })
        .filter(({ source, found }) => found?.identity !== source.identity);
    const chunks = changed.flatMap(({ source: { comment, anchor: authored }, found }): TomlTextChunk[] => {
        const owner =
            authored ??
            previous.pathNodes.find(
                (pathNode) =>
                    getTomlRange(pathNode.node)[0] > getTomlRange(comment)[1] &&
                    kept.has(JSON.stringify([pathNode.kind, ...pathNode.path])),
            );
        if (owner === undefined) return [];
        const key = JSON.stringify([owner.kind, ...owner.path]);
        if (!kept.has(key)) return [];
        addTomlComment(comments, {
            kind: owner.kind,
            path: owner.path,
            comment,
            placement: authored === undefined ? 'free' : 'owned',
        });
        if (found === undefined) return [];
        const [start, end] = getTomlRange(found.comment);
        return [{ start, end: end + Number(patched[end] === '\n'), text: '' }];
    });
    for (const entry of reparsed.pathNodes) {
        const text = insertTomlComments(comments, entry.kind, entry.path, '');
        if (text === '') continue;
        const start = getTomlRange(entry.node)[0];
        chunks.push({ start, end: start, text: text + '\n' });
    }
    let position = 0;
    return (
        chunks
            .toSorted((left, right) => left.start - right.start)
            .map((chunk) => {
                const kept = patched.slice(position, chunk.start) + chunk.text;
                position = chunk.end;
                return kept;
            })
            .join('') + patched.slice(position)
    );
}

export function parseTomlFile(path: string, text: string): Record<string, unknown>;
export function parseTomlFile<Value>(path: string, text: string, schema: z.ZodType<Value>): Value;
/**
Parse TOML, and name the file and position on invalid syntax or fields.

@param path the source file.
@param text the TOML contents.
@param schema the shape to check, when supplied.
@returns the parsed table.
*/
export function parseTomlFile(path: string, text: string, schema?: z.ZodType): unknown {
    let value: Record<string, unknown>;
    try {
        value = parseToml(text) as Record<string, unknown>;
    } catch (error_) {
        const error = error_ as Error;
        const position =
            'line' in error && typeof error.line === 'number' && 'column' in error && typeof error.column === 'number'
                ? `${path}:${String(error.line)}:${String(error.column + 1)}`
                : path;
        const detail = error.message.trimEnd().split('\n').slice(-1).join('').replace(/[.:]$/u, '');
        throw new GspotError('filesystem', `${position} is not valid TOML: ${detail}. Fix the file.`, { cause: error });
    }
    return schema === undefined ? value : parseFileFields(path, value, schema);
}

/**
Open a TOML file for key edits, and keep its comments and layout.

@param path the repository-relative TOML file.
@param text the complete TOML document.
@returns the editable document.
*/
export function openTomlFile(path: string, text: string): EditableFile {
    const document: Record<string, unknown> = parseTomlFile(path, text);
    const previous = parseTomlSyntax(text, document);
    return {
        getValue: (keys) => getValueAt(document, keys),
        set(keys, value) {
            if (keys.some((key) => typeof key !== 'string')) throw new Error(`${path} requires TOML table keys.`);
            const key = keys.at(-1);
            if (key === undefined) throw new Error(`${path} has an empty key path.`);
            const table = findTomlTable(document, {
                filePath: path,
                keys: keys.slice(0, -1),
                create: value !== undefined,
            });
            if (table === undefined) return;
            if (value === undefined) Reflect.deleteProperty(table, key);
            else
                Object.defineProperty(table, key, {
                    value: normalizeTables(value),
                    enumerable: true,
                    writable: true,
                    configurable: true,
                });
        },

        // eslint-disable-next-line gspot/no-trivial-functions -- reason: The TOML document type declares it.
        getText() {
            return buildPatchedToml(previous, document);
        },
    };
}

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
        if (isTomlKind(node, 'TableArray') && index === node.key.item.value.length - 1) {
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
Narrow a parsed TOML node by the syntax kind of the library.

@param node the parsed item to test.
@param node.type its library enum value.
@param kind the type name to match.
@returns whether the node has that kind.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers narrow the type through it.
export function isTomlKind<Kind extends string>(
    node: { type: unknown },
    kind: Kind,
): node is Extract<TomlBlock | TomlValue, { type: Kind }> {
    return String(node.type) === kind;
}

/**
Index concrete keys, headers, and array items without changing layout.

@param source TOML text.
@param parsed what the TOML parser returned.
@returns syntax entries and source-ordered comments.
*/
export function parseTomlSyntax(source: string, parsed: Record<string, unknown>): TomlSyntax {
    const document = parseDocument(source);
    const comments: TomlSyntax['comments'] = [];
    const positions = { value: parsed, counts: new Map<string, number>(), active: new Map<string, number>() };
    const pathNodes = document.cst.flatMap((node): TomlSyntax['pathNodes'] => {
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
        value: parsed,
        pathNodes: pathNodes,
        comments: comments.toSorted((left, right) => getTomlRange(left)[0] - getTomlRange(right)[0]),
    };
}

/**
Place comments directly before their own key, header, or array item, without column alignment.

@param comments the syntax entries as written.
@param kind the type of the entry.
@param path the keys and array indexes of the entry.
@param text the entry contents.
@returns syntax with exact source-ordered leading comments.
*/
export function insertTomlComments(comments: TomlComments, kind: string, path: KeyPath, text: string): string {
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
        ...(free === '' ? [] : [free, ...(text === '' && owned.length === 0 ? [] : [''])]),
        ...owned,
        ...(text === '' ? [] : [text]),
    ].join('\n');
}

/**
Find the entry that each comment describes, with an identity that stays the same through document edits.

@param syntax the indexed entries.
@returns comments with their original anchors and stable path identities.
*/
export function listAnchoredComments(syntax: TomlSyntax): TomlAnchoredComment[] {
    return syntax.comments.map((comment) => {
        const anchor = findCommentAnchor(syntax, comment);
        const identity = anchor === undefined ? 'free' : JSON.stringify([anchor.kind, ...anchor.path]);
        return { comment, anchor, identity };
    });
}

/**
Read the extent of a parsed syntax token.

@param node parsed syntax.
@returns the start and end offsets.
*/
export function getTomlRange(node: SourceRange): readonly [number, number] {
    if (node.range === undefined) throw new Error('The TOML parser omitted a source range.');
    return node.range;
}

/**
Add a source comment to its TOML entry.

@param comments the collected comment blocks.
@param commentPlacement what to add, and where.
*/
export function addTomlComment(comments: TomlComments, commentPlacement: TomlCommentPlacement): void {
    const { kind, path, comment, placement } = commentPlacement;
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
