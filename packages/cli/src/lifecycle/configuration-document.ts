import { openConfinedRoot } from '#cli/lifecycle/confined.ts';
import { patch as patchToml } from '@decimalturn/toml-patch';
import { applyEdits, findNodeAtLocation, getNodeValue, modify, parseTree, type ParseError } from 'jsonc-parser';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { isMap, parseDocument } from 'yaml';

function jsonDocument(text: string) {
    const errors: ParseError[] = [];
    const tree = parseTree(text, errors, { allowTrailingComma: true });
    if (errors.length > 0 || tree?.type !== 'object')
        throw new Error('Shared configuration must be a valid JSON object.');
    return tree;
}

/** Inspect shared fields through the same parser used by lifecycle proposals. */
export function hasConfiguration(
    root: string,
    output: {
        path: string;
        format: 'json' | 'yaml' | 'toml';
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

/** Read and edit declared keys through the parser that owns their file format. */
export function configurationDocument(source: string, format: 'json' | 'yaml' | 'toml', created = false) {
    if (format === 'toml') {
        const document: Record<string, unknown> = parseToml(source);
        return {
            value(path: (string | number)[]): unknown {
                let value: unknown = document;
                for (const key of path) {
                    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
                    value = (value as Record<string, unknown>)[key];
                }
                return value;
            },
            set(path: (string | number)[], value: unknown): void {
                if (path.some((key) => typeof key !== 'string'))
                    throw new Error('TOML configuration fields require table keys.');
                let table = document;
                for (const key of path.slice(0, -1)) {
                    if (!Object.hasOwn(table, key)) {
                        if (value === undefined) return;
                        Object.defineProperty(table, key, {
                            value: {},
                            enumerable: true,
                            writable: true,
                            configurable: true,
                        });
                    }
                    const child = table[key];
                    if (child === null || typeof child !== 'object' || Array.isArray(child) || child instanceof Date)
                        throw new Error(`TOML configuration field is not a table: ${String(key)}`);
                    table = child as Record<string, unknown>;
                }
                const key = path.at(-1)!;
                if (value === undefined) Reflect.deleteProperty(table, key);
                else Object.defineProperty(table, key, { value, enumerable: true, writable: true, configurable: true });
            },
            text(): string {
                const text = patchToml(source, document, { inlineTableStart: 2, bracketSpacing: false });
                if (!isDeepStrictEqual(parseToml(text), document))
                    throw new Error('Cannot preserve shared TOML configuration while editing its fields.');
                return text;
            },
        };
    }
    if (format === 'yaml') {
        const document = parseDocument(source);
        if (document.errors.length > 0 || !isMap(document.contents))
            throw new Error('Shared configuration must be a valid YAML mapping.');
        if (created) document.contents.flow = false;
        return {
            value(path: (string | number)[]): unknown {
                let value: unknown = document.toJS();
                for (const key of path) {
                    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
                    value = (value as Record<string, unknown>)[key];
                }
                return value;
            },
            set(path: (string | number)[], value: unknown): void {
                if (value === undefined) document.deleteIn(path);
                else document.setIn(path, value);
            },
            text(): string {
                return document.toString();
            },
        };
    }
    jsonDocument(source);
    let text = source;
    return {
        value(path: (string | number)[]): unknown {
            const node = findNodeAtLocation(jsonDocument(text), path);
            return node === undefined ? undefined : getNodeValue(node);
        },
        set(path: (string | number)[], value: unknown): void {
            text = applyEdits(
                text,
                modify(text, path, value, created ? { formattingOptions: { insertSpaces: true, tabSize: 4 } } : {}),
            );
        },
        text(): string {
            return text;
        },
    };
}
