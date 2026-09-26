import { isAlias, isCollection, isNode, isMap, parseDocument } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { patch as patchToml } from '@decimalturn/toml-patch';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { ConfigurationDocument, ConfigurationFormat, KeyPath } from '#cli/types/lifecycle/lifecycle.ts';
import { applyEdits, findNodeAtLocation, getNodeValue, modify, parseTree, type ParseError } from 'jsonc-parser';

function jsonDocument(text: string) {
    const errors: ParseError[] = [];
    const tree = parseTree(text, errors, { allowTrailingComma: true });
    if (errors.length > 0 || tree?.type !== 'object')
        throw new Error('Shared configuration must be a valid JSON object.');
    return tree;
}

// The value at a key path inside a parsed object, or undefined when any key is absent.
function valueAt(root: unknown, path: KeyPath): unknown {
    let value: unknown = root;
    for (const key of path) {
        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
        value = (value as Record<string, unknown>)[key];
    }
    return value;
}

// Whether a parsed TOML value can hold keys: a table, not a list, a date, or a scalar.
function isTable(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

// The TOML table a key path's parent names, created on the way when a value is being set.
function tomlTable(
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
        if (!isTable(child)) throw new Error(`TOML configuration field is not a table: ${String(key)}`);
        table = child;
    }
    return table;
}

// A TOML document edited in memory and printed by patching the source, so comments and layout survive.
function tomlDocument(source: string): ConfigurationDocument {
    const document: Record<string, unknown> = parseToml(source);
    return {
        value: (path) => valueAt(document, path),
        set(path, value) {
            if (path.some((key) => typeof key !== 'string'))
                throw new Error('TOML configuration fields require table keys.');
            const key = path.at(-1);
            if (key === undefined) throw new Error('A configuration key path cannot be empty.');
            const table = tomlTable(document, path.slice(0, -1), value !== undefined);
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
function yamlDocument(source: string, created: boolean): ConfigurationDocument {
    const document = parseDocument(source);
    if (document.errors.length > 0 || !isMap(document.contents))
        throw new Error('Shared configuration must be a valid YAML mapping.');
    if (created) document.contents.flow = false;
    return {
        value(path) {
            let node: unknown = document.contents;
            for (const [index, key] of path.entries()) {
                // Alias expansion needs the document anchors, but only the selected subtree is converted.
                if (isAlias(node)) return valueAt(node.toJS(document), path.slice(index));
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
function jsoncDocument(source: string, created: boolean): ConfigurationDocument {
    jsonDocument(source);
    let text = source;
    return {
        value(path) {
            const node = findNodeAtLocation(jsonDocument(text), path);
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
 * @param source the file text
 * @param format the document format
 * @param created whether the file is new, so an empty document gets no leading blank line
 * @returns a document that reads, sets, and prints values by key path
 */
export function configurationDocument(
    source: string,
    format: ConfigurationFormat,
    created = false,
): ConfigurationDocument {
    if (format === 'toml') return tomlDocument(source);
    if (format === 'yaml') return yamlDocument(source, created);
    return jsoncDocument(source, created);
}

/**
 * Inspect shared fields through the same parser used by lifecycle proposals.
 * @param root the repository root
 * @param output the shared configuration gspot installs keys into
 * @param output.path the file path
 * @param output.format the document format
 * @param output.changes the keys and the values they must hold
 * @returns whether the file exists and holds every installed value
 */
export function hasConfiguration(
    root: string,
    output: {
        path: string;
        format: ConfigurationFormat;
        changes: { path: (string | number)[]; value: unknown }[];
    },
): boolean {
    const files = openConfinedRoot(root);
    try {
        const current = files.read(output.path);
        if (current === undefined) return false;
        const document = configurationDocument(current.bytes.toString('utf8'), output.format);
        return output.changes.every((field) => isDeepStrictEqual(document.value(field.path), field.value));
    } finally {
        files.close();
    }
}
