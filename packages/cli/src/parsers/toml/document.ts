// Reads and edits TOML while preserving comments.
import { PATCH_FORMAT } from '#cli/config/parsers/toml.ts';
import { patch, parse as parseToml } from '@decimalturn/toml-patch';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';
import { isRecord, getValueAt, normalizeTables } from '#cli/system/values.ts';
import type { TomlInput, TomlSyntax, TomlComments, TomlTextChunk, TomlTableOptions } from '#cli/types/parsers/toml.ts';

import {
    getTomlRange,
    addTomlComment,
    parseTomlSyntax,
    insertTomlComments,
    listAnchoredComments,
} from '#cli/parsers/toml/comments.ts';

// The TOML table a key path's parent names, creating missing parents before setting a value.
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
        if (!isRecord(child))
            throw new Error(
                `${options.filePath} has a TOML field that is not a table: ${String(key)}. Fix the field, then run gspot apply.`,
            );
        table = child;
    }
    return table;
}

/**
 * Patch managed tool values and retain comments on their original syntax entries.
 * Text edits preserve the original order and formatting.
 * @param original indexed source before edits.
 * @param values the resulting values.
 * @returns the edited document with its comments.
 */
function buildPatchedToml(original: TomlSyntax, values: Record<string, unknown>): string {
    const patched = patch(original.document.toTomlString, values, PATCH_FORMAT);
    const current = parseTomlSyntax(patched, values);
    const unmatched = new Set(listAnchoredComments(current));
    const retained = new Set(current.pathNodes.map(({ kind, path }) => JSON.stringify([kind, ...path])));
    const comments: TomlComments = new Map();
    const changed = listAnchoredComments(original)
        .map((source) => {
            const found = [...unmatched].find((candidate) => candidate.comment.raw === source.comment.raw);
            if (found !== undefined) unmatched.delete(found);
            return { source, found };
        })
        .filter(({ source, found }) => found?.identity !== source.identity);
    const chunks = changed.flatMap(({ source: { comment, anchor: authored }, found }): TomlTextChunk[] => {
        const owner =
            authored ??
            original.pathNodes.find(
                (entry) =>
                    getTomlRange(entry.node)[0] > getTomlRange(comment)[1] &&
                    retained.has(JSON.stringify([entry.kind, ...entry.path])),
            );
        if (owner === undefined) return [];
        const key = JSON.stringify([owner.kind, ...owner.path]);
        if (!retained.has(key)) return [];
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
    for (const entry of current.pathNodes) {
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
                const retained = patched.slice(position, chunk.start) + chunk.text;
                position = chunk.end;
                return retained;
            })
            .join('') + patched.slice(position)
    );
}

/**
 * Parses TOML and names the file on invalid syntax.
 * @param input the file path and TOML text.
 * @returns the parsed table.
 * @throws a file-specific error with the parser failure as its cause.
 */
function parseTomlFile(input: TomlInput): Record<string, unknown> {
    try {
        return parseToml(input.source) as Record<string, unknown>;
    } catch (error) {
        throw new Error(`${input.path} is not valid TOML. Fix the file, then run gspot apply.`, { cause: error });
    }
}

/**
 * Reads and edits TOML keys while preserving comments and layout.
 * @param input the file path and TOML text.
 * @returns the document used by managed config-file edits.
 */
export function openTomlFile(input: TomlInput): EditableFile {
    const document: Record<string, unknown> = parseTomlFile(input);
    const original = parseTomlSyntax(input.source, document);
    return {
        format: 'toml',
        getValue: (path) => getValueAt(document, path),
        set(path, value) {
            if (path.some((key) => typeof key !== 'string')) throw new Error(`${input.path} requires TOML table keys.`);
            const key = path.at(-1);
            if (key === undefined) throw new Error(`${input.path} has an empty configuration key path.`);
            const table = findTomlTable(document, {
                filePath: input.path,
                keys: path.slice(0, -1),
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
        getText() {
            return buildPatchedToml(original, document);
        },
    };
}
