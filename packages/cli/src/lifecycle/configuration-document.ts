import { z } from 'zod';
import { isMap, parseDocument } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import { parse as parseToml } from 'smol-toml';
import { patch as patchToml } from '@decimalturn/toml-patch';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { configurationFieldsSchema, type OwnershipEntry } from '#cli/lifecycle/journal.ts';
import { applyEdits, findNodeAtLocation, getNodeValue, modify, parseTree, type ParseError } from 'jsonc-parser';

function jsonDocument(text: string) {
    const errors: ParseError[] = [];
    const tree = parseTree(text, errors, { allowTrailingComma: true });
    if (errors.length > 0 || tree?.type !== 'object')
        throw new Error('Shared configuration must be a valid JSON object.');
    return tree;
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
 * @param document the parsed document
 * @param parents the container paths this owner created, deepest last
 * @param protectedFields the key paths whose containers stay whatever they hold
 * @returns the created containers that still exist
 */
export function pruneConfigurationParents(
    document: ConfigurationDocument,
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

/**
 * Plans the merge of owned keys into a shared configuration file the developer keeps.
 * @param path the file path
 * @param format the document format
 * @param changes the keys to install with their values
 * @param current the file as it is now, or undefined when it does not exist
 * @param existing the recorded ownership of the file
 * @param matchesInstalled whether the file still holds what was installed last time
 * @param takeover whether authored values under owned keys may be replaced
 * @returns the next snapshot with its ownership, or undefined when the recorded format differs
 */
export function planConfiguration(
    path: string,
    format: ConfigurationFormat,
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
    const recorded = existing?.configuration?.fields ?? [];
    let parents = [...(existing?.configuration?.parents ?? [])];
    if (existing !== undefined && existing.configuration === undefined && current !== undefined && !matchesInstalled)
        return undefined;
    // A key no longer requested goes back to its original value, as long as the developer left it as installed.
    const retired = recorded.filter(
        (previous) => !requested.some((field) => isDeepStrictEqual(field.path, previous.path)),
    );
    for (const previous of retired) {
        if (!isDeepStrictEqual(document.value(previous.path), previous.installed)) return undefined;
        document.set(previous.path, previous.original);
    }
    const fields = recorded.filter((previous) => !retired.includes(previous));
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

export type ConfigurationFormat = 'json' | 'yaml' | 'toml';

/** A configuration file read and edited by key path, keeping its comments and layout. */
export type ConfigurationDocument = {
    value(path: (string | number)[]): unknown;
    set(path: (string | number)[], value: unknown): void;
    text(): string;
};
