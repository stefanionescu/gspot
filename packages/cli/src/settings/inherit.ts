import { z } from 'zod';
import { compareText } from '#cli/system/text.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { joinDefaultPaths } from '#cli/settings/paths.ts';
import { isTable, getValueAt } from '#cli/system/tables.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { commandSchema } from '#cli/schemas/configurations/fields.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import type { Settings, SettingsTable } from '#cli/types/settings/file.ts';
import { SHIPPED_DEFAULT_ORIGIN } from '#cli/config/settings/inheritance.ts';
import { findSettingSchema, unwrapSettingSchema } from '#cli/settings/schema-lookup.ts';
import { CATEGORY_PARENTS, NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/naming.ts';
import { CATEGORY_KEY_SEGMENTS, LANGUAGE_GROUP_TABLES } from '#cli/config/settings/inherit.ts';

import type {
    Setting,
    SettingMatch,
    InheritedValue,
    SettingDefault,
    WrittenSetting,
    InheritedSetting,
    AvailableSettings,
    WrittenScopeTable,
} from '#cli/types/settings/inheritance.ts';

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
        .map((writtenKey) => ({ writtenKey, found: getWrittenSetting(table.table, writtenKey) }))
        .filter((row): row is typeof row & { found: NonNullable<typeof row.found> } => row.found !== undefined);
    const owner = table.scope === '' ? SETTINGS_FILE : `[scope ${JSON.stringify(table.scope)}]`;
    const origin = table.scope === '' ? 'root' : 'scope';
    const originScope = table.scope === '' ? {} : { originScope: table.scope };
    for (const { writtenKey, found } of written) {
        result = {
            value: mergeValue(
                setting,
                result.origin === 'configuration' ? undefined : result.value,
                getValueAt(table.table, writtenKey.split('.')),
            ),
            source: writtenKey === key ? owner : `${owner} (${writtenKey})`,
            origin,
            ...originScope,
            reason: found.reason,
        };
    }
    return result;
}

/**
Merge two values: lists of plain values append without repeats, tables merge their keys, and command arguments, lists
of tables, and single values replace.

@param setting the setting whose schema selects the merge rule.
@param inherited the value so far.
@param found the value the next table writes.
*/
export function mergeValue(setting: Setting, inherited: unknown, found: unknown): unknown {
    let schema = findSettingSchema(setting.name);
    if (schema !== undefined) schema = unwrapSettingSchema(schema);
    if (schema instanceof z.ZodUnion)
        schema = schema.options.find((option) => option instanceof z.ZodArray || option === commandSchema) as
            | z.ZodType
            | undefined;
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

/**
List the root settings and every scope table, with their locations in the document.

@param settings the parsed gspot.toml.
@returns the tables in written order, root first.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, its rule repeats in the code of several layers.
export function listSettingsTables(settings: Settings): WrittenScopeTable[] {
    return [
        { table: settings, scope: '', path: [] },
        ...[...settings.scopes].map(
            ([scope, table], index) => ({ table, scope, path: ['scope', index] }) satisfies WrittenScopeTable,
        ),
    ];
}

/**
List the root settings and the scope tables that apply, from outermost to innermost.

@param settings the parsed gspot.toml.
@param scopePath the folder, '' for the root alone.
*/
export function listApplicableTables(settings: Settings, scopePath: string): WrittenScopeTable[] {
    return listSettingsTables(settings)
        .filter((settingsTable) => settingsTable.scope === '' || isInScope(scopePath, settingsTable.scope))
        .toSorted((left, right) => compareScopeDepth(left.scope, right.scope));
}

/**
Match a written key to its setting. Per-language and per-category keys map back to their base setting.

@param availableSettings the settings and defaults of the selected configurations.
@param key the dotted name as written.
*/
export function findSetting(availableSettings: AvailableSettings, key: string): SettingMatch | undefined {
    const direct = availableSettings.settings.get(key);
    if (direct) return { setting: direct };
    const [table, language, ...rest] = key.split('.');
    return table === undefined || language === undefined || !LANGUAGE_GROUP_TABLES.has(table)
        ? undefined
        : findVariantSetting(availableSettings, table, language, rest);
}

/**
Get the written value of a dotted key.

@param settings the root table or one scope.
@param key the dotted setting name.
@returns undefined when the key has no value.
*/
export function getWrittenSetting(settings: Pick<Settings, 'written'>, key: string): WrittenSetting | undefined {
    const value: unknown = getValueAt(settings.written, key.split('.'));
    if (value === undefined) return undefined;
    return isReasonedValue(value)
        ? {
              value: value.value,
              reason: value.reason,
          }
        : { value };
}

function listPossibleKeys(match: SettingMatch, key: string): string[] {
    const { language, category } = match;
    if (language === undefined) return [key];
    const field = key.slice(key.lastIndexOf('.') + 1);
    const keys = [match.setting.name];
    if (category !== undefined) {
        const parent = CATEGORY_PARENTS[category] ?? category;
        keys.push(`naming.${language}.${field}`, `naming.${language}.${parent}.${field}`);
    }
    keys.push(key);
    return keys;
}

/**
Resolve one default against its language, scope, and site build folder.

@param availableSettings the settings and defaults of the configurations in use.
@param settings reads a value from the settings tables of the caller.
@param match the setting and its language, if any.
@param scopePath the project whose shipped paths apply.
@returns the default, with repository-relative paths.
*/
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
    const folder =
        setting.path_role === 'build'
            ? (getSettingValue(availableSettings, settings, 'site.build_folder', scopePath)?.value as string)
            : scopePath;
    return { ...shipped, value: joinDefaultPaths(setting.name, shipped.value, folder) };
}

/**
Resolve one key: the configuration default, then the root table, then each scope table; mergeValue merges them.

@param availableSettings the settings and defaults of the selected configurations.
@param settings the parsed gspot.toml.
@param key the dotted setting name.
@param scopePath the folder whose table applies last, if any.
@returns undefined when nothing exposes the key.
*/
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
    const keys = listPossibleKeys(match, key);
    let inherited: InheritedValue = { value: undefined, source: 'unset', origin: 'unset', reason: undefined };
    if (shipped !== undefined)
        inherited = {
            value: shipped.value,
            source:
                shipped.configuration === SHIPPED_DEFAULT_ORIGIN
                    ? SHIPPED_DEFAULT_ORIGIN
                    : `configuration ${shipped.configuration}`,
            origin: 'configuration',
            reason: undefined,
        };
    for (const table of tables) inherited = mergeTable(setting, key, inherited, table, keys);
    const { value, source, reason, origin, originScope } = inherited;
    return {
        key,
        setting,
        value,
        source,
        origin,
        reason,
        scope: scopePath,
        originScope,
    };
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
List every setting key that a settings table writes, in dotted form.

@param settings the root table or one scope.
@param availableSettings the known settings, with nested tool keys.
@returns all known written keys, plus unknown keys from open settings tables.
*/
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
        .filter((key) => getWrittenSetting(settings, key) !== undefined)
        .toArray();
    return [...new Set([...settingKeys, ...keys])];
}

/**
List the settings that apply, with language defaults and written variants, in key order.

@param availableSettings the settings and defaults of the selected configurations.
@param settings the parsed gspot.toml.
@param scopePath the folder whose table applies last, if any.
@returns the resolved settings in key order.
*/
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
