import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { patch } from '@decimalturn/toml-patch';
import { PATCH_FORMAT } from '#cli/config/parsers/toml.ts';
import type { ConfigurationDocument } from '#cli/types/parsers/document.ts';
import { isRecord, normalizeTables, valueAt as getValue } from '#cli/platform/contracts.ts';
import { tomlRange, tomlSyntax, emitTomlComments, tomlCommentOwners } from '#cli/parsers/toml/contracts.ts';
import type { TomlInput, TomlSyntax, TomlComments, TomlTextChunk, TomlTableOptions } from '#cli/types/parsers/toml.ts';

// The TOML table a key path's parent names, created on the way when a value is being set.
function getTomlTable(
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
 * Reads and edits TOML keys while preserving comments and layout.
 * @param input the file path and TOML text
 * @returns the document used by managed config-file edits
 */
export function openTomlDocument(input: TomlInput): ConfigurationDocument {
    const document: Record<string, unknown> = parseTomlFile(input);
    const original = tomlSyntax(input.source, document);
    return {
        format: 'toml',
        value: (path) => getValue(document, path),
        set(path, value) {
            if (path.some((key) => typeof key !== 'string')) throw new Error(`${input.path} requires TOML table keys.`);
            const key = path.at(-1);
            if (key === undefined) throw new Error(`${input.path} has an empty configuration key path.`);
            const table = getTomlTable(document, {
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
        text() {
            const text = patchToml(original, document);
            if (!isDeepStrictEqual(parseTomlFile({ path: input.path, source: text }), document))
                throw new Error(`Cannot preserve ${input.path} while editing its TOML fields.`);
            return text;
        },
    };
}

/**
 * Parses authored TOML and names the file when syntax is invalid.
 * @param input the file path and TOML text
 * @returns the parsed table
 * @throws a file-specific error with the parser failure as its cause
 */
export function parseTomlFile(input: TomlInput): Record<string, unknown> {
    try {
        return parseToml(input.source);
    } catch (error) {
        throw new Error(`${input.path} is not valid TOML. Fix the file, then run gspot apply.`, { cause: error });
    }
}

/**
 * Patch managed tool values and retain comments on their original semantic owners.
 * Native chunks keep their authored order and formatting.
 * @param original indexed authored source before edits
 * @param values the resulting native values
 * @returns the native edited document with its owned comments
 */
export function patchToml(original: TomlSyntax, values: Record<string, unknown>): string {
    const patched = patch(original.document.toTomlString, values, PATCH_FORMAT);
    const current = tomlSyntax(patched, values);
    const unmatched = new Set(tomlCommentOwners(current));
    const retained = new Set(current.entries.map(({ kind, path }) => JSON.stringify([kind, ...path])));
    const comments: TomlComments = new Map();
    const changed = tomlCommentOwners(original)
        .map((source) => {
            const found = [...unmatched].find((candidate) => candidate.comment.raw === source.comment.raw);
            if (found !== undefined) unmatched.delete(found);
            return { source, found };
        })
        .filter(({ source, found }) => found?.identity !== source.identity);
    const chunks = changed.flatMap(({ source: { comment, owner: authored }, found }): TomlTextChunk[] => {
        const owner =
            authored ??
            original.entries.find(
                (entry) =>
                    tomlRange(entry.node)[0] > tomlRange(comment)[1] &&
                    retained.has(JSON.stringify([entry.kind, ...entry.path])),
            );
        if (owner === undefined) return [];
        const key = JSON.stringify([owner.kind, ...owner.path]);
        if (!retained.has(key)) return [];
        const block = comments.get(key) ?? { path: owner.path, owned: [], free: [] };
        block[authored === undefined ? 'free' : 'owned'].push({
            raw: comment.raw,
            start: tomlRange(comment)[0],
            line: comment.loc.start.line,
        });
        comments.set(key, block);
        if (found === undefined) return [];
        const [start, end] = tomlRange(found.comment);
        return [{ start, end: end + Number(patched[end] === '\n'), text: '' }];
    });
    for (const entry of current.entries) {
        const text = emitTomlComments(comments, entry.kind, entry.path, '');
        if (text === '') continue;
        const start = tomlRange(entry.node)[0];
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
