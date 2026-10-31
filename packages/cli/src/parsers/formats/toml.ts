import type { z } from 'zod';
import { GspotError, parseFileFields } from '#cli/system/errors.ts';
import { isTable, findValueAt, normalizeTables } from '#cli/system/tables.ts';
import type { KeyPath, EditableFile } from '#cli/types/parsers/editable-file.ts';
import { patch, stringify, parseDocument, parse as parseToml } from '@decimalturn/toml-patch';
import { MESSAGE_END, PATCH_FORMAT, TABLE_PROPERTY_FLAGS, MISSING_RANGE_MESSAGE } from '#cli/config/parsers/formats.ts';

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
    type TomlCommentMove,
    type TomlTableOptions,
    type TomlTablePositions,
    type TomlAnchoredComment,
    type TomlCommentPlacement,
} from '#cli/types/parsers/formats.ts';

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
                ...TABLE_PROPERTY_FLAGS,
            });
        }
        const child = table[key];
        if (!isTable(child))
            throw new GspotError(
                'parse',
                `${options.filePath} has a TOML field that is not a table: ${String(key)}. Fix the field, then run gspot apply.`,
            );
        table = child;
    }
    return table;
}

function buildTablePath(
    node: Exclude<TomlBlock, TomlKeyValue | TomlCommentNode>,
    positions: TomlTablePositions,
): KeyPath {
    const path: KeyPath[number][] = [];
    for (const [index, key] of node.key.item.value.entries()) {
        path.push(key);
        if (!Array.isArray(findValueAt(positions.value, path))) continue;
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

function listNestedNodes(node: TomlValue, keys: KeyPath): TomlSyntax['pathNodes'] {
    if (isTomlKind(node, 'InlineArray'))
        return node.items.flatMap(({ item }, index): TomlSyntax['pathNodes'] => {
            const value = item as TomlValue;
            const child = [...keys, index];
            return [{ kind: 'item', path: child, node: value }, ...listNestedNodes(value, child)];
        });
    if (isTomlKind(node, 'InlineTable'))
        return node.items.flatMap(({ item }): TomlSyntax['pathNodes'] => {
            const child = [...keys, ...item.key.value];
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

function insertTomlComments(comments: TomlComments, kind: string, keys: KeyPath, text: string): string {
    const id = JSON.stringify([kind, ...keys]);
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

function listAnchoredComments(syntax: TomlSyntax): TomlAnchoredComment[] {
    return syntax.comments.map((comment) => {
        const anchor = findCommentAnchor(syntax, comment);
        const identity = anchor === undefined ? 'free' : JSON.stringify([anchor.kind, ...anchor.path]);
        return { comment, anchor, identity };
    });
}

function addTomlComment(comments: TomlComments, commentPlacement: TomlCommentPlacement): void {
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

function replaceTomlValues(previous: TomlSyntax, values: Record<string, unknown>, format: Parameters<typeof patch>[2]) {
    const appended: Record<string, unknown> = {};
    const assigned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
        if (!Object.hasOwn(previous.value, key) && Array.isArray(value) && value.length > 0 && value.every(isTable))
            appended[key] = value;
        else assigned[key] = value;
    }
    const patched = patch(previous.document.toTomlString, assigned, format);
    const suffix = Object.keys(appended).length === 0 ? '' : `\n\n${stringify(appended, format)}`;
    return { patched, suffix };
}

function pairChangedComments(previous: TomlSyntax, reparsed: TomlSyntax): TomlCommentMove[] {
    const unmatched = new Set(listAnchoredComments(reparsed));
    return listAnchoredComments(previous)
        .map((source) => {
            const found = unmatched.values().find((comment) => comment.comment.raw === source.comment.raw);
            if (found !== undefined) unmatched.delete(found);
            return { source, found };
        })
        .filter(({ source, found }) => found?.identity !== source.identity);
}

/**
Write the values over the TOML text, and keep its order, its layout, and its comments. A top-level array of tables that the text lacks goes at its end.

@param previous the parsed text.
@param values the table to write.
@param format the toml-patch format of the new values.
@returns the TOML text.
*/
export function buildPatchedToml(
    previous: TomlSyntax,
    values: Record<string, unknown>,
    format: Parameters<typeof patch>[2],
): string {
    const { patched, suffix } = replaceTomlValues(previous, values, format);
    const reparsed = parseTomlSyntax(patched, values);
    const kept = new Set(reparsed.pathNodes.map(({ kind, path }) => JSON.stringify([kind, ...path])));
    const comments: TomlComments = new Map();
    const changed = pairChangedComments(previous, reparsed);
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
    for (const pathNode of reparsed.pathNodes) {
        const text = insertTomlComments(comments, pathNode.kind, pathNode.path, '');
        if (text === '') continue;
        const start = getTomlRange(pathNode.node)[0];
        chunks.push({ start, end: start, text: text + '\n' });
    }
    let position = 0;
    return (
        (
            chunks
                .toSorted((left, right) => left.start - right.start)
                .map((chunk) => {
                    const piece = patched.slice(position, chunk.start) + chunk.text;
                    position = chunk.end;
                    return piece;
                })
                .join('') + patched.slice(position)
        ).trimEnd() +
        suffix +
        '\n'
    );
}

export function parseTomlFile(path: string, text: string): Record<string, unknown>;

export function parseTomlFile<Value>(path: string, text: string, schema: z.ZodType<Value>): Value;

/**
Parse TOML, and name the file and position on invalid syntax or fields.

@param path the source file.
@param text the TOML contents.
@param schema the shape to check, when supplied.
*/
export function parseTomlFile(path: string, text: string, schema?: z.ZodType): unknown {
    let value: Record<string, unknown>;
    try {
        value = parseToml(text) as Record<string, unknown>;
    } catch (error) {
        const issue = error as Error;
        const position =
            'line' in issue && typeof issue.line === 'number' && 'column' in issue && typeof issue.column === 'number'
                ? `${path}:${String(issue.line)}:${String(issue.column + 1)}`
                : path;
        const detail = issue.message.trimEnd().split('\n').slice(-1).join('').replace(MESSAGE_END, '');
        throw new GspotError('parse', `${position} is not valid TOML: ${detail}. Fix the file.`, {
            cause: issue,
        });
    }
    return schema === undefined ? value : parseFileFields(path, value, schema);
}

/**
Open a TOML file for key edits, and keep its comments and layout.

@param path the repository-relative TOML file.
@param text the complete TOML document.
*/
export function openTomlFile(path: string, text: string): EditableFile {
    const document: Record<string, unknown> = parseTomlFile(path, text);
    const previous = parseTomlSyntax(text, document);
    return {
        getValue: (keys) => findValueAt(document, keys),
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
                    ...TABLE_PROPERTY_FLAGS,
                });
        },

        getText: () => buildPatchedToml(previous, document, PATCH_FORMAT),
    };
}

/**
Check the kind of a TOML syntax node, and narrow its type.

@param node the block or value node.
@param node.type the kind that the parser gave the node.
@param kind the kind to match, for example InlineArray.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The parser's private node enum needs this predicate to narrow concrete syntax tree unions.
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
Read the extent of a parsed syntax token.

@param node parsed syntax.
*/
export function getTomlRange(node: SourceRange): readonly [number, number] {
    if (node.range === undefined) throw new Error(MISSING_RANGE_MESSAGE);
    return node.range;
}
