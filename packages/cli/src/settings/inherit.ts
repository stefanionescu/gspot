import { z } from 'zod';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import {
    LANGUAGE_GROUP_TABLES,
    NAMING_LANGUAGE_CATEGORIES,
    SHIPPED_DEFAULT_ORIGIN,
    SHIPPED_DEFAULT_OWNER,
} from '#cli/config/settings/schema.ts';
import { CATEGORY_KEY_SEGMENTS, CATEGORY_PARENTS } from '#cli/config/settings/validation.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { commandSchema } from '#cli/schemas/manifests/checks.ts';
import { findSettingSchema, isReasonedValue, unwrapSettingSchema } from '#cli/settings/lookup.ts';
import { joinSettingPaths } from '#cli/settings/paths.ts';
import { isInScope } from '#cli/system/paths.ts';
import { findValueAt, isTable } from '#cli/system/tables.ts';
import { compareText } from '#cli/system/text.ts';
import type { Setting } from '#cli/types/manifests.ts';
import type {
    AvailableSettings,
    InheritedSetting,
    InheritedValue,
    SettingDefault,
    SettingMatch,
    SettingOrigin,
    Settings,
    SettingsTable,
    WrittenScopeTable,
    WrittenSetting,
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
    setting: Setting,
    key: string,
    inherited: InheritedValue,
    table: WrittenScopeTable,
    possibleKeys: string[],
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
    const field = key.slice(key.lastIndexOf('.') + 1);
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

function isKeyGroup(
    availableSettings: AvailableSettings,
    key: string,
    value: unknown,
): value is Record<string, unknown> {
    if (availableSettings.settings.has(key) || !isTable(value)) return false;
    let schema = findSettingSchema(key);
    if (schema !== undefined) schema = unwrapSettingSchema(schema);
    return schema instanceof z.ZodObject;
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

export function listSettingsTables(settings: Settings): WrittenScopeTable[] {
    return [
        { table: settings, scopePath: '', path: [] },
        ...[...settings.scopes].map(
            ([scopePath, table], index) => ({ table, scopePath, path: ['scope', index] }) satisfies WrittenScopeTable,
        ),
    ];
}

export function listApplicableTables(settings: Settings, scopePath: string): WrittenScopeTable[] {
    return listSettingsTables(settings)
        .filter((settingsTable) => settingsTable.scopePath === '' || isInScope(scopePath, settingsTable.scopePath))
        .toSorted((left, right) => compareScopeDepth(left.scopePath, right.scopePath));
}

export function findSetting(availableSettings: AvailableSettings, key: string): SettingMatch | undefined {
    const direct = availableSettings.settings.get(key);
    if (direct) return { setting: direct };
    const [table, language, ...rest] = key.split('.');
    return table === undefined || language === undefined || !LANGUAGE_GROUP_TABLES.has(table)
        ? undefined
        : findVariantSetting(availableSettings, table, language, rest);
}

export function findWrittenSetting(settings: Pick<Settings, 'written'>, key: string): WrittenSetting | undefined {
    const value: unknown = findValueAt(settings.written, key.split('.'));
    if (value === undefined) return undefined;
    return isReasonedValue(value)
        ? {
              value: value.value,
              reason: value.reason,
          }
        : { value };
}

export function findSettingDefault(
    availableSettings: AvailableSettings,
    settings: Settings,
    match: SettingMatch,
    scopePath: string,
): SettingDefault | undefined {
    const { setting } = match;
    const table = setting.name.slice(0, setting.name.indexOf('.'));
    const field = setting.name.slice(setting.name.lastIndexOf('.') + 1);
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
    for (const table of tables) inherited = mergeTable(setting, key, inherited, table, keys);
    return { key, setting, ...inherited };
}

export function formatSettingSource({ kind, name }: SettingOrigin, writtenAs?: string): string {
    const written = writtenAs === undefined ? '' : ` (${writtenAs})`;
    if (kind === 'default') return `${SHIPPED_DEFAULT_ORIGIN}${written}`;
    if (kind === 'scope' || kind === 'configuration') return `${kind} ${name}${written}`;
    return `${kind === 'root' ? name : kind}${written}`;
}

export function listWrittenKeys(settings: SettingsTable, availableSettings: AvailableSettings): string[] {
    const keys: string[] = [];
    const pending = Object.entries(settings.written).flatMap(([name, table]) => {
        const fields = name !== 'removed_configurations' && isTable(table) ? Object.entries(table) : [];
        return availableSettings.settings.has(name)
            ? { key: name, value: table }
            : fields.map(([field, value]) => ({ key: `${name}.${field}`, value }));
    });
    let offset = 0;
    while (offset < pending.length) {
        const { key, value } = pending[offset] as (typeof pending)[number];
        offset++;
        if (isKeyGroup(availableSettings, key, value))
            pending.push(...Object.entries(value).map(([field, child]) => ({ key: `${key}.${field}`, value: child })));
        else keys.push(key);
    }
    const settingKeys = availableSettings.settings
        .keys()
        .filter((key) => findWrittenSetting(settings, key) !== undefined)
        .toArray();
    return [...new Set([...settingKeys, ...keys])];
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
