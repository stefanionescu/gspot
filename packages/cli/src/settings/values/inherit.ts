import { z } from 'zod';
import { compareText } from '#cli/system/text/order.ts';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { commandSchema } from '#cli/schemas/manifests/checks.ts';
import { joinSettingPaths } from '#cli/settings/values/paths.ts';
import { NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/tables.ts';
import { extractKeyName, findSettingSchema, unwrapSettingSchema } from '#cli/settings/lookup.ts';
import { listWrittenKeys, findWrittenSetting, listApplicableTables } from '#cli/settings/values/written.ts';

import {
    CATEGORY_PARENTS,
    CATEGORY_KEY_SEGMENTS,
    LANGUAGE_GROUP_TABLES,
    SHIPPED_DEFAULT_OWNER,
    SHIPPED_DEFAULT_ORIGIN,
} from '#cli/config/settings/values.ts';
import type {
    Setting,
    Settings,
    SettingMatch,
    SettingOrigin,
    InheritedValue,
    SettingDefault,
    InheritedSetting,
    AvailableSettings,
    WrittenScopeTable,
} from '#cli/types/settings.ts';

function findLanguageSetting(
    availableSettings: AvailableSettings,
    table: string,
    language: string,
    name: string,
): SettingMatch | undefined {
    const base = availableSettings.settings.get(`${table}.${name}`);
    const languages = base?.languages ?? [];
    return base && languages.includes(language) ? { setting: base, language } : undefined;
}

function findVariantSetting(
    availableSettings: AvailableSettings,
    table: string,
    language: string,
    rest: string[],
): SettingMatch | undefined {
    const [first, second] = rest;
    if (first === undefined) return undefined;
    if (second === undefined) return findLanguageSetting(availableSettings, table, language, first);
    return table === 'naming' && rest.length === CATEGORY_KEY_SEGMENTS
        ? findCategorySetting(availableSettings, language, first, second)
        : undefined;
}

function findCategorySetting(
    availableSettings: AvailableSettings,
    language: string,
    category: string,
    name: string,
): SettingMatch | undefined {
    const base = availableSettings.settings.get(`naming.${name}`);
    if (!base) return undefined;
    const categories: Readonly<Record<string, readonly string[]>> = NAMING_LANGUAGE_CATEGORIES;
    const isCovered =
        (base.languages ?? []).includes(language) &&
        (categories[language]?.includes(category) === true ||
            (name === 'cases' && availableSettings.defaults.has(`naming.${language}.${category}.cases`)));
    return isCovered ? { setting: base, language, category } : undefined;
}

function mergeTable(
    inherited: InheritedValue,
    table: WrittenScopeTable,
    { setting, key, possibleKeys }: { setting: Setting; key: string; possibleKeys: string[] },
): InheritedValue {
    let result = inherited;
    const written = possibleKeys
        .map((writtenKey) => ({ writtenKey, found: findWrittenSetting(table.table, writtenKey) }))
        .filter((row): row is typeof row & { found: NonNullable<typeof row.found> } => row.found !== undefined);
    const origin: SettingOrigin =
        table.scopePath === '' ? { kind: 'root', name: SETTINGS_FILE } : { kind: 'scope', name: table.scopePath };
    for (const { writtenKey, found } of written) {
        const value = findValueAt(table.table, writtenKey.split('.'));
        result = {
            value: mergeValue(
                setting,
                ['default', 'configuration'].includes(result.origin.kind) ? undefined : result.value,
                joinSettingPaths(writtenKey, value, table.scopePath),
            ),
            origin,
            reason: found.reason,
            ...(writtenKey !== key && { writtenAs: writtenKey }),
        };
    }
    return result;
}

/**
List the written keys that set a value, from the most general to the key itself. A shipped default of the language
outranks the general key that a user writes, so a stricter general value never loosens a stricter language default.
*/
function listPossibleKeys(availableSettings: AvailableSettings, match: SettingMatch, key: string): string[] {
    const { language, category } = match;
    if (language === undefined) return [key];
    const field = extractKeyName(key);
    const table = match.setting.name.slice(0, match.setting.name.indexOf('.'));
    const hasLanguageDefault = availableSettings.defaults.has(`${table}.${language}.${field}`);
    const keys = hasLanguageDefault ? [] : [match.setting.name];
    if (category !== undefined) {
        const parent = CATEGORY_PARENTS[category] ?? category;
        keys.push(`naming.${language}.${field}`, `naming.${language}.${parent}.${field}`);
    }
    keys.push(key);
    return keys;
}

/**
Merge two values: lists of plain values append without repeats, tables merge their keys, and command arguments, lists
of tables, and single values replace.
*/
export function mergeValue(setting: Setting, inherited: unknown, found: unknown): unknown {
    let schema = findSettingSchema(setting.name);
    if (schema !== undefined) schema = unwrapSettingSchema(schema);
    if (schema instanceof z.ZodUnion)
        schema = schema.options.find((option) => option instanceof z.ZodArray || option === commandSchema) as
            z.ZodType | undefined;
    if (
        schema !== commandSchema &&
        schema instanceof z.ZodArray &&
        !(schema.element instanceof z.ZodObject) &&
        [inherited, found].every((value) => Array.isArray(value))
    )
        return [...new Set([inherited, found].flat())];
    return setting.type === 'table'
        ? Object.fromEntries([inherited, found].filter(isTable).flatMap((table) => Object.entries(table)))
        : found;
}

export function findSetting(availableSettings: AvailableSettings, key: string): SettingMatch | undefined {
    const direct = availableSettings.settings.get(key);
    if (direct) return { setting: direct };
    const [table, language, ...rest] = key.split('.');
    return table === undefined || language === undefined || !LANGUAGE_GROUP_TABLES.has(table)
        ? undefined
        : findVariantSetting(availableSettings, table, language, rest);
}

export function findSettingDefault(
    availableSettings: AvailableSettings,
    settings: Settings,
    match: SettingMatch,
    scopePath: string,
): SettingDefault | undefined {
    const { setting } = match;
    const table = setting.name.slice(0, setting.name.indexOf('.'));
    const field = extractKeyName(setting.name);
    const keys = [setting.name];
    if (match.language !== undefined) {
        keys.unshift(`${table}.${match.language}.${field}`);
        if (match.category !== undefined) keys.unshift(`${table}.${match.language}.${match.category}.${field}`);
    }
    const shipped = keys.map((key) => availableSettings.defaults.get(key)).find((value) => value !== undefined);
    if (shipped === undefined) return undefined;
    const buildFolder =
        setting.path_role === 'build'
            ? (getSettingValue(availableSettings, settings, 'site.build_folder', scopePath)?.value as string)
            : '';
    return { ...shipped, value: joinSettingPaths(setting.name, shipped.value, scopePath, buildFolder) };
}

export function getSettingValue(
    availableSettings: AvailableSettings,
    settings: Settings,
    key: string,
    scopePath: string,
): InheritedSetting | undefined {
    const match = findSetting(availableSettings, key);
    if (!match) return undefined;
    const { setting } = match;
    const shipped = findSettingDefault(availableSettings, settings, match, scopePath);
    const tables = listApplicableTables(settings, scopePath);
    const keys = listPossibleKeys(availableSettings, match, key);
    let inherited: InheritedValue = {
        value: undefined,
        origin: { kind: 'unset', name: '' },
        reason: undefined,
    };
    if (shipped !== undefined)
        inherited = {
            value: shipped.value,
            origin:
                shipped.configuration === SHIPPED_DEFAULT_ORIGIN
                    ? { kind: 'default', name: SHIPPED_DEFAULT_OWNER }
                    : { kind: 'configuration', name: shipped.configuration },
            reason: undefined,
        };
    for (const table of tables) inherited = mergeTable(inherited, table, { setting, key, possibleKeys: keys });
    return { key, setting, ...inherited };
}

export function formatSettingSource({ kind, name }: SettingOrigin, writtenAs?: string): string {
    const written = writtenAs === undefined ? '' : ` (${writtenAs})`;
    if (kind === 'default') return `${SHIPPED_DEFAULT_ORIGIN}${written}`;
    if (kind === 'scope' || kind === 'configuration') return `${kind} ${name}${written}`;
    return `${kind === 'root' ? name : kind}${written}`;
}

export function listInheritedSettings(
    availableSettings: AvailableSettings,
    settings: Settings,
    scopePath: string,
): InheritedSetting[] {
    const keys = [
        ...new Set([
            ...availableSettings.settings.keys(),
            ...availableSettings.defaults.keys(),
            ...listApplicableTables(settings, scopePath).flatMap(({ table }) =>
                listWrittenKeys(table, availableSettings).filter(
                    (key) => findSetting(availableSettings, key) !== undefined,
                ),
            ),
        ]),
    ].toSorted((a, b) => compareText(a, b));
    return keys
        .map((key) => getSettingValue(availableSettings, settings, key, scopePath))
        .filter((row) => row !== undefined);
}
