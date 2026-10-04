import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { patchToml } from '#cli/parsers/toml/patch.ts';
import type { KeyPath } from '#cli/types/platform/document.ts';
import type { TomlDocument } from '#cli/types/parsers/toml.ts';
import { isRecord, valueAt as getValue } from '#cli/platform/objects.ts';

// The TOML table a key path's parent names, created on the way when a value is being set.
function getTomlTable(
    document: Record<string, unknown>,
    path: KeyPath,
    create: boolean,
): Record<string, unknown> | undefined {
    let table = document;
    for (const key of path) {
        if (!Object.hasOwn(table, key)) {
            if (!create) return undefined;
            Object.defineProperty(table, key, { value: {}, enumerable: true, writable: true, configurable: true });
        }
        const child = table[key];
        if (!isRecord(child)) throw new Error(`TOML configuration field is not a table: ${String(key)}`);
        table = child;
    }
    return table;
}

/**
 * Reads and edits TOML keys while preserving comments and layout.
 * @param source the TOML file text
 * @returns the document used by managed config-file edits
 */
export function openTomlDocument(source: string): TomlDocument {
    const document: Record<string, unknown> = parseToml(source);
    return {
        value: (path) => getValue(document, path),
        set(path, value) {
            if (path.some((key) => typeof key !== 'string'))
                throw new Error('TOML configuration fields require table keys.');
            const key = path.at(-1);
            if (key === undefined) throw new Error('A configuration key path cannot be empty.');
            const table = getTomlTable(document, path.slice(0, -1), value !== undefined);
            if (table === undefined) return;
            if (value === undefined) Reflect.deleteProperty(table, key);
            else Object.defineProperty(table, key, { value, enumerable: true, writable: true, configurable: true });
        },
        text() {
            const text = patchToml(source, document);
            if (!isDeepStrictEqual(parseToml(text), document))
                throw new Error('Cannot preserve shared TOML configuration while editing its fields.');
            return text;
        },
    };
}
