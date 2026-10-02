import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { openRoot } from '#cli/platform/filesystem.ts';
import { patch as patchToml } from '@decimalturn/toml-patch';
import { isRecord, valueAt as getValue } from '#cli/platform/text.ts';
import { isMap, isNode, isAlias, isCollection, parseDocument } from 'yaml';
import type { ConfigurationFormat } from '#cli/types/generation/generation.ts';
import type { KeyPath, KitDocument as Document } from '#cli/types/lifecycle/merge.ts';
import { modify, parseTree, applyEdits, getNodeValue, type ParseError, findNodeAtLocation } from 'jsonc-parser';

function parseJsonTree(text: string) {
    const errors: ParseError[] = [];
    const tree = parseTree(text, errors, { allowTrailingComma: true });
    if (errors.length > 0 || tree?.type !== 'object')
        throw new Error('Shared configuration must be a valid JSON object.');
    return tree;
}

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

// A TOML document edited in memory and printed by patching the source, so comments and layout survive.
function tomlDocument(source: string): Document {
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
            const text = patchToml(source, document, { inlineTableStart: 2, bracketSpacing: false });
            if (!isDeepStrictEqual(parseToml(text), document))
                throw new Error('Cannot preserve shared TOML configuration while editing its fields.');
            return text;
        },
    };
}

// A YAML mapping edited through its own document model.
function yamlDocument(source: string, created: boolean): Document {
    const document = parseDocument(source);
    if (document.errors.length > 0 || !isMap(document.contents))
        throw new Error('Shared configuration must be a valid YAML mapping.');
    if (created) document.contents.flow = false;
    return {
        value(path): unknown {
            let node: unknown = document.contents;
            for (const [index, key] of path.entries()) {
                // Alias expansion needs the document anchors, but only the selected subtree is converted.
                if (isAlias(node)) return getValue(node.toJS(document), path.slice(index));
                if (!isCollection(node)) return undefined;
                node = node.get(key, true);
            }
            return isNode(node) ? node.toJS(document) : node;
        },
        set(path, value) {
            if (value === undefined) document.deleteIn(path);
            else document.setIn(path, value);
        },
        text: () => document.toString(),
    };
}

// A JSON object edited by text edits, so comments and layout survive.
function jsoncDocument(source: string, created: boolean): Document {
    parseJsonTree(source);
    let text = source;
    return {
        value(path) {
            const node = findNodeAtLocation(parseJsonTree(text), path);
            return node === undefined ? undefined : (getNodeValue(node) as unknown);
        },
        set(path, value) {
            const options = created ? { formattingOptions: { insertSpaces: true, tabSize: 4 } } : {};
            text = applyEdits(text, modify(text, path, value, options));
        },
        text: () => text,
    };
}

/**
 * Read and edit declared keys through the parser that owns their file format.
 * @param source the file text.
 * @param format the document format.
 * @param created whether the file is new, so an empty document gets no leading blank line.
 * @returns a document that reads, sets, and prints values by key path.
 */
export function openDocument(source: string, format: ConfigurationFormat, created = false): Document {
    if (format === 'toml') return tomlDocument(source);
    if (format === 'yaml') return yamlDocument(source, created);
    return jsoncDocument(source, created);
}

/**
 * Inspect shared fields through the same parser used by lifecycle plans.
 * @param root the repository root.
 * @param output the shared configuration gspot installs keys into.
 * @param output.path the file path.
 * @param output.format the document format.
 * @param output.changes the keys and the values they must hold.
 * @returns whether the file exists and holds every installed value.
 */
export function hasFields(
    root: string,
    output: {
        path: string;
        format: ConfigurationFormat;
        changes: { path: (string | number)[]; value: unknown }[];
    },
): boolean {
    using files = openRoot(root);
    const current = files.read(output.path);
    if (current === undefined) return false;
    const document = openDocument(current.bytes.toString('utf8'), output.format);
    return output.changes.every((field) => isDeepStrictEqual(document.value(field.path), field.value));
}
