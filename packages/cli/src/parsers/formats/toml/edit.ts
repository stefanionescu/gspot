import { patch } from '@decimalturn/toml-patch';

import { PATCH_FORMAT, TABLE_PROPERTY_FLAGS } from '#cli/config/parsers/formats.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { getTomlRange, parseTomlSyntax } from '#cli/parsers/formats/toml/syntax.ts';
import { GspotError } from '#cli/system/errors.ts';
import { findValueAt, isTable, normalizeTables } from '#cli/system/tables.ts';
import type {
    EditableFile,
    KeyPath,
    TomlAnchoredComment,
    TomlCommentMove,
    TomlCommentNode,
    TomlComments,
    TomlPathNode,
    TomlSyntax,
    TomlTableOptions,
    TomlTextChunk,
} from '#cli/types/parsers.ts';

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
                `${options.filePath} has a TOML field that is not a table: ${String(key)}. Fix the field, then run gspot install.`,
            );
        table = child;
    }
    return table;
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
    const commentLines = new Set(
        syntax.comments
            .filter(({ loc }) => loc.start.column === comment.loc.start.column)
            .map(({ loc }) => loc.start.line),
    );
    let end = comment.loc.end.line;
    while (commentLines.has(end + 1)) end++;
    return next?.node.loc.start.line === end + 1 ? next : undefined;
}

function insertTomlComments(comments: TomlComments, kind: string, keys: KeyPath): string {
    const id = JSON.stringify([kind, ...keys]);
    const block = comments.get(id);
    if (block === undefined) return '';
    comments.delete(id);
    return block
        .toSorted((left, right) => left.start - right.start)
        .map(({ raw }) => raw)
        .join('\n');
}

function listAnchoredComments(syntax: TomlSyntax): TomlAnchoredComment[] {
    return syntax.comments.map((comment) => {
        const anchor = findCommentAnchor(syntax, comment);
        const identity = anchor === undefined ? 'free' : JSON.stringify([anchor.kind, ...anchor.path]);
        return { comment, anchor, identity };
    });
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

function setTomlValue({
    document,
    path,
    keys,
    value,
}: {
    document: Record<string, unknown>;
    path: string;
    keys: KeyPath;
    value: unknown;
}): void {
    if (keys.some((key) => typeof key !== 'string')) throw new Error(`${path} requires TOML table keys.`);
    const key = keys.at(-1);
    if (key === undefined) throw new Error(`${path} has an empty key path.`);
    const table = findTomlTable(document, { filePath: path, keys: keys.slice(0, -1), create: value !== undefined });
    if (table === undefined) return;
    if (value === undefined) Reflect.deleteProperty(table, key);
    else Object.defineProperty(table, key, { value: normalizeTables(value), ...TABLE_PROPERTY_FLAGS });
}

export function buildPatchedToml(
    previous: TomlSyntax,
    values: Record<string, unknown>,
    format: Parameters<typeof patch>[2],
): string {
    const patched = patch(previous.document.toTomlString, values, format);
    const reparsed = parseTomlSyntax(patched, values);
    const kept = new Set(reparsed.pathNodes.map(({ kind, path }) => JSON.stringify([kind, ...path])));
    const comments: TomlComments = new Map();
    const changed = pairChangedComments(previous, reparsed);
    const chunks = changed.flatMap(({ source: { comment, anchor, identity }, found }): TomlTextChunk[] => {
        if (anchor === undefined || !kept.has(identity)) return [];
        comments.set(identity, [
            ...(comments.get(identity) ?? []),
            { raw: comment.raw, start: getTomlRange(comment)[0] },
        ]);
        if (found === undefined) return [];
        const [start, end] = getTomlRange(found.comment);
        return [{ start, end: end + Number(patched[end] === '\n'), text: '' }];
    });
    for (const pathNode of reparsed.pathNodes) {
        const text = insertTomlComments(comments, pathNode.kind, pathNode.path);
        if (text === '') continue;
        const start = getTomlRange(pathNode.node)[0];
        chunks.push({ start, end: start, text: `${text}\n` });
    }
    let position = 0;
    return `${(
        chunks
            .toSorted((left, right) => left.start - right.start)
            .map((chunk) => {
                const piece = patched.slice(position, chunk.start) + chunk.text;
                position = chunk.end;
                return piece;
            })
            .join('') + patched.slice(position)
    ).trimEnd()}\n`;
}

export function openTomlFile(path: string, text: string): EditableFile {
    const document: Record<string, unknown> = parseTomlFile(path, text);
    const previous = parseTomlSyntax(text, document);
    return {
        getValue: (keys) => findValueAt(document, keys),
        set: (keys, value) => {
            setTomlValue({ document, path, keys, value });
        },

        getText: () => buildPatchedToml(previous, document, PATCH_FORMAT),
    };
}
