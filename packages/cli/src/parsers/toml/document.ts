import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { patchToml } from '#cli/parsers/toml/patch.ts';
import { isRecord, valueAt as getValue } from '#cli/platform/objects.ts';
import type { TomlInput, TomlDocument, TomlTableOptions } from '#cli/types/parsers/toml.ts';

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
                value: normalizeTomlTables({}),
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
export function openTomlDocument(input: TomlInput): TomlDocument {
    const document: Record<string, unknown> = parseTomlFile(input);
    return {
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
                    value: normalizeTomlTables(value),
                    enumerable: true,
                    writable: true,
                    configurable: true,
                });
        },
        text() {
            const text = patchToml(input.source, document);
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
 * Give edited TOML tables the parser's null prototype while preserving dates and array order.
 * @param value a TOML field created by an edit
 * @returns the same TOML values with consistent table prototypes
 */
export function normalizeTomlTables(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => normalizeTomlTables(entry));
    if (!isRecord(value)) return value;
    const table = Object.fromEntries<unknown>(
        Object.entries(value).map(([key, entry]) => [key, normalizeTomlTables(entry)]),
    );
    Object.setPrototypeOf(table, null);
    return table;
}
