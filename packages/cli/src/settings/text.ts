import { isDeepStrictEqual } from 'node:util';
import { compareText } from '#cli/system/text.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { RECORD_FIELDS } from '#cli/settings/schema-lookup.ts';
import { isTable, normalizeTables } from '#cli/system/tables.ts';
import { TOML_FORMAT, SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { parseTomlFile, parseTomlSyntax, buildPatchedToml } from '#cli/parsers/formats/toml.ts';
import { ROOT_KEYS, LAST_TABLES, FIRST_TABLES, SCHEMA_DIRECTIVE } from '#cli/config/settings/text.ts';

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

function sortValue(value: unknown, keys: string[]): unknown {
    if (Array.isArray(value)) return value.map((element: unknown) => sortValue(element, keys));
    if (!isTable(value)) return value;
    const fields: Readonly<Record<string, readonly string[]>> = RECORD_FIELDS;
    const recordOrder: readonly string[] | undefined = isReasonedValue(value)
        ? ['value', 'reason']
        : fields[keys.join('.')];
    const names = Object.keys(value);
    let order = names;
    if (recordOrder !== undefined)
        order = [
            ...recordOrder.filter((key) => Object.hasOwn(value, key)),
            ...names.filter((key) => !recordOrder.includes(key)),
        ];
    else if (keys[0] === 'tools' && keys.at(-1) === 'rules')
        order = names.toSorted((left, right) => compareText(left, right));
    return Object.fromEntries(order.map((key) => [key, sortValue(value[key], [...keys, key])]));
}

/**
Add an ignore to the list, or merge its paths into the record with the same check, rule, names, reason, and until.
When either record has no paths, the merged record has none. Changes ignores in place.

@param ignores the written [[ignore]] records.
@param ignore the record to add.
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
Build the text of a new gspot.toml: the schema directive, the preface, and the settings written over the template, whose comments stay.

@param preface the comment lines under the directive.
@param template the gspot.toml text that init copies with --from, or an empty text.
@param written the values to write, before defaults.
@returns the TOML 1.0 text.
*/
export function buildSettingsText(preface: string, template: string, written: TomlTable): string {
    const syntax = parseTomlSyntax(template, parseTomlFile(SETTINGS_FILE, template));
    const opening = preface === '' ? '' : preface.trimEnd() + '\n';
    const body = isDeepStrictEqual(normalizeTables(written), normalizeTables(syntax.value))
        ? template
        : buildPatchedToml(syntax, sortTable(written), TOML_FORMAT);
    return `${SCHEMA_DIRECTIVE}\n${opening}${body}`;
}
