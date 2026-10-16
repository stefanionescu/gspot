import { decodeUtf8 } from '#cli/text.ts';
import { isRecord } from '#cli/objects.ts';
import { GspotError } from '#cli/errors.ts';
import { isDeepStrictEqual } from 'node:util';
import { writePlans } from '#cli/ownership/writer.ts';
import type { Writer } from '#cli/types/ownership.ts';
import { keptComments } from '#cli/settings/comments.ts';
import { layOutSettings } from '#cli/settings/layout.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import { tomlSyntax } from '#cli/parsers/toml/comments.ts';
import { dropDefaults } from '#cli/settings/drop-defaults.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import type { FileCopy } from '#cli/types/system/safe-folder.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { calendarDateSchema } from '#cli/settings/schema/parts.ts';
import { tableValuesSchema } from '#cli/settings/schema/tables.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { parse, LocalDate, stringify } from '@decimalturn/toml-patch';
import type { TomlTable, SettingsSource } from '#cli/types/settings/file.ts';
import { ROOT_KEYS, LAST_TABLES, FIRST_TABLES, RECORD_FIELDS, PARSE_CONTEXT_LINES } from '#cli/config/settings/file.ts';

function sortTable(table: TomlTable): TomlTable {
    const order = [
        ...ROOT_KEYS,
        ...FIRST_TABLES,
        ...Object.keys(table)
            .filter((key) => !([...ROOT_KEYS, ...FIRST_TABLES, ...LAST_TABLES] as readonly string[]).includes(key))
            .toSorted((left, right) => left.localeCompare(right)),
        ...LAST_TABLES,
    ];
    return Object.fromEntries(
        order.filter((key) => Object.hasOwn(table, key)).map((key) => [key, sortValue(table[key], [key])]),
    );
}

function sortValue(value: unknown, path: string[]): unknown {
    if (Array.isArray(value)) return value.map((entry: unknown) => sortValue(entry, path));
    if (!isRecord(value)) return value;
    const fields: Readonly<Record<string, readonly string[]>> = RECORD_FIELDS;
    const isEnvelope = ['value', 'reason'].every((field) => Object.hasOwn(value, field));
    const recordOrder: readonly string[] | undefined = isEnvelope ? ['value', 'reason'] : fields[path.join('.')];
    const names = Object.keys(value);
    let order = names;
    if (recordOrder !== undefined)
        order = [
            ...recordOrder.filter((key) => Object.hasOwn(value, key)),
            ...names.filter((key) => !recordOrder.includes(key)),
        ];
    else if (path[0] === 'tools') {
        const sortsNames = path.at(-1) === 'rules' || path.includes('extra');
        if (sortsNames) order = names.toSorted((left, right) => left.localeCompare(right));
    }
    return Object.fromEntries(order.map((key) => [key, sortValue(value[key], [...path, key])]));
}

function ignoreOrder(ignore: TomlTable): string[] {
    const paths: unknown = ignore['paths'];
    return [ignore['check'], ignore['rule'], Array.isArray(paths) ? paths[0] : undefined].map((value) =>
        typeof value === 'string' ? value : '',
    );
}

function compareIgnores(left: TomlTable, right: TomlTable): number {
    const rightParts = ignoreOrder(right);
    for (const [index, part] of ignoreOrder(left).entries()) {
        const other = rightParts[index];
        const order = part.localeCompare(other ?? '');
        if (order !== 0) return order;
    }
    return 0;
}

function mergeIgnores(ignores: TomlTable[]): TomlTable[] {
    const merged: TomlTable[] = [];
    for (const ignore of ignores) mergeIgnore(merged, ignore);
    return merged.toSorted(compareIgnores);
}

/**
 * Merge an written ignore into its matching identity while retaining scope-wide entries.
 * @param ignores the mutable written entries
 * @param ignore the entry whose paths join its existing identity
 * @returns the saved entry, including the merged paths
 */
function mergeIgnore(ignores: TomlTable[], ignore: TomlTable): TomlTable {
    const { paths: writtenPaths, ...identity } = ignore;
    const existing = ignores.find(({ paths: _previousPaths, ...previous }) => isDeepStrictEqual(previous, identity));
    if (existing === undefined) {
        const saved = { ...ignore };
        ignores.push(saved);
        return saved;
    }
    const previous: unknown = existing['paths'];
    if (Array.isArray(writtenPaths) && Array.isArray(previous)) {
        const paths: readonly unknown[] = writtenPaths;
        const previousPaths: readonly unknown[] = previous;
        existing['paths'] = [...new Set([...previousPaths, ...paths])];
    } else Reflect.deleteProperty(existing, 'paths');
    return existing;
}

/**
 * Read written settings or template values while retaining TOML date kinds and source locations.
 * @param text the written TOML
 * @param path the source file or URL
 * @param kind the document to name in the error
 * @returns the parsed table without execution defaults
 */
function parseTomlText(text: string, path: string, kind: 'settings' | 'template'): TomlTable {
    try {
        return parse(text) as TomlTable;
    } catch (error) {
        if (!(error instanceof Error) || !('line' in error) || !('column' in error)) throw error;
        const { line, column } = error;
        if (typeof line !== 'number' || typeof column !== 'number') throw error;
        const detail = error.message.split('\n').slice(PARSE_CONTEXT_LINES).join('\n');
        throw new GspotError(kind, `${path}:${String(line)}:${String(column + 1)} is not valid TOML: ${detail}`);
    }
}

/**
 * Encode written values in a stable key order without adding or omitting defaults.
 * @param table the written table
 * @returns TOML that retains dates, number kinds, and array order
 */
function sortedToml(table: TomlTable): string {
    return stringify(sortTable(table));
}

/**
 * Validate a CLI expiry argument before creating its written value.
 * @param text the date supplied to --until
 * @returns the same calendar date as a TOML value
 */
function parseExpiryDate(text: string): LocalDate {
    const result = calendarDateSchema.safeParse(text);
    if (!result.success) throw new GspotError('settings', 'until must be a valid calendar date in YYYY-MM-DD form.');
    return new LocalDate(result.data);
}

/**
 * Write the settings while retaining written comments and template provenance.
 * @param previousText the original written document, or empty text for initialization
 * @param settings the written values, before execution defaults
 * @returns TOML 1.0 with value encoding
 */
function emitSettings(previousText: string, settings: TomlTable): string {
    const ordered = sortTable(settings);
    let target = dropDefaults(ordered);
    if (target['ignore'] !== undefined)
        target['ignore'] = mergeIgnores(settingsSchema.shape.ignore.unwrap().parse(target['ignore']));
    const format = tableValuesSchema.in.shape.format.parse(target['format']);
    const indent = format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width);
    const syntax = tomlSyntax(previousText, parseTomlText(previousText, SETTINGS_FILE, 'settings'));
    const comments = keptComments(syntax, target, settings);
    target = sortTable(target);
    return layOutSettings(target, indent, comments);
}

/**
 * Read written settings text, following only links contained by the repository.
 * @param root the repository root
 * @returns the UTF-8 settings text
 */
function readSettingsFile(root: string): SettingsSource {
    using files = openSafeFolder(root);
    const original = files.read(SETTINGS_FILE);
    if (original === undefined)
        throw new GspotError('settings', 'There is no gspot.toml here. Run `gspot init` to create one.');
    return { text: decodeSettingsText(original.bytes), original };
}

/**
 * Decode settings bytes captured at the file boundary.
 * @param bytes the captured settings bytes
 * @returns the UTF-8 settings text
 */
function decodeSettingsText(bytes: Buffer): string {
    const text = decodeUtf8(bytes);
    if (text === undefined) throw new GspotError('settings', 'gspot.toml must contain valid UTF-8 text.');
    return text;
}

/**
 * Write settings bytes only while the captured file identity matches.
 * @param log the locked ownership log
 * @param text the settings text to write
 * @param original the captured file bytes and mode
 */
function writeSettings(log: Writer, text: string, original: FileCopy | undefined): void {
    const next = { bytes: Buffer.from(text), mode: original?.mode ?? OWNER_WRITABLE_FILE };
    if (isDeepStrictEqual(next, original)) return;
    writePlans(log, [
        {
            ...planReplacement(log, {
                path: SETTINGS_FILE,
                next,
                canReplace: true,
                expected: original,
            }),
            before: original,
        },
    ]);
}

export { sortedToml, mergeIgnore, emitSettings, parseTomlText, writeSettings, parseExpiryDate, readSettingsFile };
