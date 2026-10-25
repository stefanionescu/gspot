import { isDeepStrictEqual } from 'node:util';
import { isTable } from '#cli/system/tables.ts';
import { compareText } from '#cli/system/text.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { RECORD_FIELDS } from '#cli/schemas/settings/file.ts';
import { parseTomlSyntax } from '#cli/parsers/formats/toml.ts';
import type { ParsedFormat } from '#cli/types/settings/values.ts';
import { parseTomlText, isReasonedValue } from '#cli/settings/file.ts';
import { encodeSettings, listKeptComments } from '#cli/settings/text/layout.ts';
import { ROOT_KEYS, LAST_TABLES, FIRST_TABLES } from '#cli/config/settings/text/build.ts';
import { SETTINGS_FILE, SCHEMA_DIRECTIVE, SCHEMA_DIRECTIVE_LINE } from '#cli/config/settings/file.ts';

function sortTable(table: TomlTable): TomlTable {
    const order = [
        ...ROOT_KEYS,
        ...FIRST_TABLES,
        ...Object.keys(table)
            .filter((key) => !([...ROOT_KEYS, ...FIRST_TABLES, ...LAST_TABLES] as readonly string[]).includes(key))
            .toSorted((left, right) => compareText(left, right)),
        ...LAST_TABLES,
    ];
    return Object.fromEntries(
        order.filter((key) => Object.hasOwn(table, key)).map((key) => [key, sortValue(table[key], [key])]),
    );
}

function sortValue(value: unknown, path: string[]): unknown {
    if (Array.isArray(value)) return value.map((element: unknown) => sortValue(element, path));
    if (!isTable(value)) return value;
    const fields: Readonly<Record<string, readonly string[]>> = RECORD_FIELDS;
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
        const isSortsNames = path.at(-1) === 'rules';
        if (isSortsNames) order = names.toSorted((left, right) => compareText(left, right));
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
    const rightKey = buildIgnoreSortKey(right);
    for (const [index, leftKey] of buildIgnoreSortKey(left).entries()) {
        const other = rightKey[index];
        const order = compareText(leftKey, other ?? '');
        if (order !== 0) return order;
    }
    return 0;
}

/**
Merge matching ignore records and sort them.

@param ignores the authored ignore records.
@returns the merged records in settings order.
*/
export function mergeIgnores(ignores: TomlTable[]): TomlTable[] {
    const merged: TomlTable[] = [];
    for (const ignore of ignores) mergeIgnore(merged, ignore);
    return merged.toSorted(compareIgnores);
}

/**
Add an ignore to the list, or merge its paths into the record with the same check, rule, names, reason, and until.
When either record has no paths, the merged record has none. Changes ignores in place.

@param ignores the written [[ignore]] records.
@param ignore the record to add.
@returns the saved record.
*/
export function mergeIgnore(ignores: TomlTable[], ignore: TomlTable): TomlTable {
    const { paths: writtenPaths, ...identity } = ignore;
    const matching = ignores.find(({ paths: _previousPaths, ...previous }) => isDeepStrictEqual(previous, identity));
    if (matching === undefined) {
        const saved = { ...ignore };
        ignores.push(saved);
        return saved;
    }
    const previous: unknown = matching['paths'];
    if (Array.isArray(writtenPaths) && Array.isArray(previous)) {
        const paths: readonly unknown[] = writtenPaths;
        const previousPaths: readonly unknown[] = previous;
        matching['paths'] = [...new Set([...previousPaths, ...paths])];
    } else Reflect.deleteProperty(matching, 'paths');
    return matching;
}

/**
Build the TOML text of the settings. Keep the written comments and the template source, and start with the schema
directive, which replaces any directive on the first line before.

@param previousText the gspot.toml contents before, or empty for init.
@param settings the written values, before defaults.
@param format the parsed indentation settings.
@returns the TOML 1.0 text.
*/
export function buildSettingsText(
    previousText: string,
    settings: TomlTable,
    format: Pick<ParsedFormat, 'indent_style' | 'indent_width'>,
): string {
    const authored = previousText.replace(SCHEMA_DIRECTIVE_LINE, '');
    let target = sortTable(settings);
    if (target['ignore'] !== undefined) target['ignore'] = mergeIgnores(target['ignore'] as TomlTable[]);
    const indent = format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width);
    const syntax = parseTomlSyntax(authored, parseTomlText(authored, SETTINGS_FILE));
    const comments = listKeptComments(syntax, target);
    target = sortTable(target);
    return `${SCHEMA_DIRECTIVE}\n${encodeSettings(target, indent, comments)}`;
}
