import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { stripDefaults } from '#cli/settings/text/defaults.ts';
import { tableValuesSchema } from '#cli/schemas/settings/tables.ts';
import { parseTomlSyntax } from '#cli/parsers/formats/toml/syntax.ts';
import { parseTomlText, isReasonedValue } from '#cli/settings/file.ts';
import { encodeSettings, listKeptComments } from '#cli/settings/text/layout.ts';
import { settingsSchema, listRecordFields } from '#cli/schemas/settings/file.ts';
import { ROOT_KEYS, LAST_TABLES, FIRST_TABLES } from '#cli/config/settings/text/build.ts';

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
    if (!isTable(value)) return value;
    const fields: Readonly<Record<string, readonly string[]>> = listRecordFields();
    const recordOrder: readonly string[] | undefined = isReasonedValue(value)
        ? ['value', 'reason']
        : fields[path.join('.')];
    const names = Object.keys(value);
    let order = names;
    if (recordOrder !== undefined)
        order = [
            ...recordOrder.filter((key) => Object.hasOwn(value, key)),
            ...names.filter((key) => !recordOrder.includes(key)),
        ];
    else if (path[0] === 'tools') {
        const sortsNames = path.at(-1) === 'rules';
        if (sortsNames) order = names.toSorted((left, right) => left.localeCompare(right));
    }
    return Object.fromEntries(order.map((key) => [key, sortValue(value[key], [...path, key])]));
}

function buildIgnoreSortKey(ignore: TomlTable): string[] {
    const paths: unknown = ignore['paths'];
    return [ignore['check'], ignore['rule'], Array.isArray(paths) ? paths[0] : undefined].map((value) =>
        typeof value === 'string' ? value : '',
    );
}

function compareIgnores(left: TomlTable, right: TomlTable): number {
    const rightParts = buildIgnoreSortKey(right);
    for (const [index, part] of buildIgnoreSortKey(left).entries()) {
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
 * Add an ignore to the list, or merge its paths into the record with the same check, rule, names, reason, and until.
 * When either record has no paths, the merged record has none. Changes ignores in place.
 *
 * @param ignores the written [[ignore]] records.
 * @param ignore the record to add.
 * @returns the saved record.
 */
export function mergeIgnore(ignores: TomlTable[], ignore: TomlTable): TomlTable {
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
 * Build the TOML text of the settings. Keep the written comments and the template source.
 *
 * @param previousText the gspot.toml contents before, or empty for init.
 * @param settings the written values, before defaults.
 * @returns the TOML 1.0 text.
 */
export function buildSettingsText(previousText: string, settings: TomlTable): string {
    const ordered = sortTable(settings);
    let target = stripDefaults(ordered);
    if (target['ignore'] !== undefined)
        target['ignore'] = mergeIgnores(settingsSchema.shape.ignore.unwrap().parse(target['ignore']));
    const format = tableValuesSchema.in.shape.format.parse(target['format']);
    const indent = format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width);
    const syntax = parseTomlSyntax(previousText, parseTomlText(previousText, SETTINGS_FILE));
    const comments = listKeptComments(syntax, target, settings);
    target = sortTable(target);
    return encodeSettings(target, indent, comments);
}
