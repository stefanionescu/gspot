import { configurationFieldsSchema, type OwnershipEntry } from '#cli/lifecycle/journal.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { patch as patchToml } from '@decimalturn/toml-patch';
import { applyEdits, findNodeAtLocation, getNodeValue, modify, parseTree, type ParseError } from 'jsonc-parser';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { isMap, parseDocument } from 'yaml';
import { z } from 'zod';

function jsonDocument(text: string) {
    const errors: ParseError[] = [];
    const tree = parseTree(text, errors, { allowTrailingComma: true });
    if (errors.length > 0 || tree?.type !== 'object')
        throw new Error('Shared configuration must be a valid JSON object.');
    return tree;
}

/**
 * Inspect shared fields through the same parser used by lifecycle proposals.
 * @param root
 * @param output
 * @param output.path
 * @param output.format
 * @param output.changes
 */
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

/**
 * Read and edit declared keys through the parser that owns their file format.
 * @param source
 * @param format
 * @param created
 */
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

/**
 * Remove empty containers only when this owner created them for managed fields.
 * @param document
 * @param parents
 * @param protectedFields
 */
export function pruneConfigurationParents(
    document: ReturnType<typeof configurationDocument>,
    parents: (string | number)[][],
    protectedFields: (string | number)[][] = [],
): (string | number)[][] {
    for (const parent of parents.toSorted((left, right) => right.length - left.length)) {
        if (
            protectedFields.some(
                (field) => field.length <= parent.length && field.every((part, index) => part === parent[index]),
            )
        )
            continue;
        const value = document.value(parent);
        if (value === null || typeof value !== 'object') continue;
        if (
            !Array.isArray(value) &&
            Object.getPrototypeOf(value) !== Object.prototype &&
            Object.getPrototypeOf(value) !== null
        )
            continue;
        if (Object.keys(value).length === 0) document.set(parent, undefined);
    }
    return parents.filter((parent) => document.value(parent) !== undefined);
}

export function planConfiguration(
    path: string,
    format: 'json' | 'yaml' | 'toml',
    changes: { path: (string | number)[]; value: unknown }[],
    current: FileSnapshot | undefined,
    existing: OwnershipEntry | undefined,
    matchesInstalled: boolean,
    takeover: boolean,
):
    | {
          next: FileSnapshot;
          configuration: NonNullable<OwnershipEntry['configuration']>;
          status: 'changed' | 'unchanged';
      }
    | undefined {
    const text = current?.bytes.toString('utf8') ?? (format === 'toml' ? '' : '{}\n');
    if (current !== undefined && !Buffer.from(text).equals(current.bytes))
        throw new Error(`Shared configuration is not UTF-8 text: ${path}`);
    const document = configurationDocument(text, format, current === undefined);
    if (existing?.configuration !== undefined && existing.configuration.format !== format) return undefined;
    const requested = changes.map((change) => ({
        path: change.path,
        installed: z.json().parse(change.value),
    }));
    configurationFieldsSchema.parse(requested);
    const fields = [...(existing?.configuration?.fields ?? [])];
    let parents = [...(existing?.configuration?.parents ?? [])];
    if (existing !== undefined && existing.configuration === undefined && current !== undefined && !matchesInstalled)
        return undefined;
    for (const previous of [...fields]) {
        if (requested.some((field) => isDeepStrictEqual(field.path, previous.path))) continue;
        if (!isDeepStrictEqual(document.value(previous.path), previous.installed)) return undefined;
        document.set(previous.path, previous.original);
        fields.splice(fields.indexOf(previous), 1);
    }
    for (const field of requested) {
        const value = document.value(field.path);
        const previous = fields.find((entry) => isDeepStrictEqual(entry.path, field.path));
        if (previous !== undefined && !isDeepStrictEqual(value, previous.installed)) return undefined;
        if (previous === undefined && current !== undefined && !takeover && !isDeepStrictEqual(value, field.installed))
            return undefined;
        const original =
            previous === undefined ? (value === undefined ? undefined : z.json().parse(value)) : previous.original;
        const entry = { ...field, ...(original === undefined ? {} : { original }) };
        const index = fields.findIndex((entry) => isDeepStrictEqual(entry.path, field.path));
        if (index === -1) fields.push(entry);
        else fields[index] = entry;
        for (let length = 1; length < field.path.length; length++) {
            const parent = field.path.slice(0, length);
            if (document.value(parent) === undefined && !parents.some((path) => isDeepStrictEqual(path, parent)))
                parents.push(parent);
        }
        document.set(field.path, field.installed);
    }
    parents = pruneConfigurationParents(
        document,
        parents,
        requested.map((field) => field.path),
    );
    const nextText = document.text();
    const next = { bytes: Buffer.from(nextText), mode: current?.mode ?? 0o644 };
    const edited =
        existing?.configuration?.edited === true ||
        (existing !== undefined && current !== undefined && !matchesInstalled);
    if (
        existing?.configuration !== undefined &&
        isDeepStrictEqual(fields, existing.configuration.fields) &&
        nextText === text
    )
        return { next, configuration: existing.configuration, status: 'unchanged' };
    return {
        next,
        status: nextText === text ? 'unchanged' : 'changed',
        configuration: {
            format,
            fields,
            ...(parents.length === 0 ? {} : { parents }),
            edited,
            created: existing?.configuration?.created ?? current === undefined,
        },
    };
}
