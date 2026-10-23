import { z } from 'zod';
import { isReasonedValue } from '#cli/settings/file.ts';
import { joinDefaultPaths } from '#cli/settings/paths.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { findSettingSchema } from '#cli/schemas/settings/file.ts';
import { commandSchema } from '#cli/schemas/configurations/fields.ts';
import { unwrapSettingSchema } from '#cli/schemas/settings/fields.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import type { Settings, SettingsTable } from '#cli/types/settings/file.ts';
import { NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/naming.ts';
import { isTable, getValueAt, stripUndefined } from '#cli/system/tables.ts';
import { CATEGORY_PARENTS } from '#cli/config/checks/general/naming/settings.ts';
import { CATEGORY_KEY_SEGMENTS, LANGUAGE_GROUP_TABLES } from '#cli/config/settings/inherit.ts';

import {
    type Setting,
    type SettingMatch,
    type EffectiveValue,
    type SettingDefault,
    type WrittenSetting,
    type EffectiveSetting,
    type AvailableSettings,
    type WrittenScopeTable,
} from '#cli/types/settings/inheritance.ts';

function findLanguageSetting(
    availableSettings: AvailableSettings,
    table: string,
    language: string,
    name: string,
): SettingMatch | undefined {
    const base = availableSettings.settings.get(`${table}.${name}`);
    const languages = base?.languages ?? [];
    if (base && languages.includes(language)) return { setting: base, language };
    return undefined;
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
    if (table !== 'naming' || rest.length !== CATEGORY_KEY_SEGMENTS) return undefined;
    return findCategorySetting(availableSettings, language, first, second);
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
    effective: EffectiveValue,
    table: WrittenScopeTable,
    possibleKeys: string[],
): EffectiveValue {
    let result = effective;
    const written = possibleKeys
        .map((writtenKey) => ({ writtenKey, found: getWrittenSetting(table.table, writtenKey) }))
        .filter((row): row is typeof row & { found: NonNullable<typeof row.found> } => row.found !== undefined);
    for (const { writtenKey, found } of written) {
        const owner = table.scope === undefined ? SETTINGS_FILE : `[scope ${JSON.stringify(table.scope)}]`;
        result = {
            value: mergeValue(setting, result.value, getValueAt(table.table, writtenKey.split('.'))),
            source: writtenKey === key ? owner : `${owner} (${writtenKey})`,
            origin: table.scope === undefined ? 'root' : 'scope',
            ...stripUndefined({ originScope: table.scope }),
            reason: found.reason,
        };
    }
    return result;
}

/**
 * Merge two values: lists of plain values append without repeats, tables merge their keys, and command arguments, lists
 * of tables, and single values replace.
 *
 * @param setting the setting whose schema selects the merge rule.
 * @param inherited the value so far.
 * @param found the value the next table writes.
 * @returns the merged value.
 */
export function mergeValue(setting: Setting, inherited: unknown, found: unknown): unknown {
    let schema = findSettingSchema(setting.name);
    if (schema !== undefined) schema = unwrapSettingSchema(schema);
    if (schema instanceof z.ZodUnion)
        schema = schema.options.find((option) => option instanceof z.ZodArray || option === commandSchema) as
            | z.ZodType
            | undefined;
    if (
        schema instanceof z.ZodArray &&
        schema !== commandSchema &&
        !(schema.element instanceof z.ZodObject) &&
        [inherited, found].every((value) => Array.isArray(value))
    )
        return [...new Set([inherited, found].flat())];
    if (setting.type === 'table')
        return Object.fromEntries([inherited, found].filter(isTable).flatMap((table) => Object.entries(table)));
    return found;
}

/**
 * List the root settings and every scope table, with their locations in the document.
 *
 * @param settings the parsed gspot.toml.
 * @returns the tables in written order, root first.
 */
export function listSettingsTables(settings: Settings): WrittenScopeTable[] {
    return [
        { table: settings, path: [] },
        ...Object.entries(settings.scopes).map(
            ([scope, table], index) => ({ table, scope, path: ['scope', index] }) satisfies WrittenScopeTable,
        ),
    ];
}

/**
 * List the root settings and the scope tables that apply, from outermost to innermost.
 *
 * @param settings the parsed gspot.toml.
 * @param scope the folder, '' or undefined for the root alone.
 * @returns the tables with their scope paths and reported names.
 */
export function listApplicableTables(settings: Settings, scope: string | undefined): WrittenScopeTable[] {
    return listSettingsTables(settings)
        .filter((settingsTable) => settingsTable.scope === undefined || isInScope(scope ?? '', settingsTable.scope))
        .toSorted((left, right) => compareScopeDepth(left.scope ?? '', right.scope ?? ''));
}

/**
 * Match a written key to its setting. Per-language and per-category keys map back to their base setting.
 *
 * @param availableSettings the settings and defaults of the selected configurations.
 * @param key the dotted name as written.
 * @returns the match with its language and category, or undefined.
 */
export function findSetting(availableSettings: AvailableSettings, key: string): SettingMatch | undefined {
    const direct = availableSettings.settings.get(key);
    if (direct) return { setting: direct };
    const [table, language, ...rest] = key.split('.');
    if (table === undefined || language === undefined || !LANGUAGE_GROUP_TABLES.has(table)) return undefined;
    return findVariantSetting(availableSettings, table, language, rest);
}

/**
 * Get the written value of a dotted key.
 *
 * @param settings the root table or one scope.
 * @param key the dotted setting name.
 * @returns the value with its reason, or undefined when the key has no value.
 */
export function getWrittenSetting(settings: Pick<Settings, 'written'>, key: string): WrittenSetting | undefined {
    const value: unknown = getValueAt(settings.written, key.split('.'));
    if (value === undefined) return undefined;
    return isReasonedValue(value)
        ? stripUndefined({
              value: value.value,
              reason: typeof value.reason === 'string' ? value.reason : undefined,
          })
        : { value };
}

function listPossibleKeys(match: SettingMatch, key: string): string[] {
    const parents: Readonly<Record<string, string>> = CATEGORY_PARENTS;
    const parent = match.category === undefined ? undefined : parents[match.category];
    return match.language === undefined
        ? [key]
        : [
              match.setting.name,
              ...(match.category === undefined
                  ? []
                  : [`naming.${match.language}.${key.slice(key.lastIndexOf('.') + 1)}`]),
              ...(parent === undefined
                  ? []
                  : [`naming.${match.language}.${parent}.${key.slice(key.lastIndexOf('.') + 1)}`]),
              key,
          ];
}

/**
 * Resolve one default against its language, scope, and site build folder.
 *
 * @param availableSettings the settings and defaults of the configurations in use.
 * @param settings reads a value from the settings tables of the caller.
 * @param match the setting and its language, if any.
 * @param scope the project whose shipped paths apply.
 * @returns the default with repository-relative paths, or undefined.
 */
export function findSettingDefault(
    availableSettings: AvailableSettings,
    settings: Settings,
    match: SettingMatch,
    scope: string | undefined,
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
            ? (getSettingValue(availableSettings, settings, 'site.build_folder', scope)?.value as string)
            : (scope ?? '');
    return { ...shipped, value: joinDefaultPaths(setting.name, shipped.value, folder) };
}

/**
 * Resolve one key: the configuration default, then the root table, then each scope table; mergeValue merges them.
 *
 * @param availableSettings the settings and defaults of the selected configurations.
 * @param settings the parsed gspot.toml.
 * @param key the dotted setting name.
 * @param scope the folder whose table applies last, if any.
 * @returns the value with where it came from, or undefined when nothing exposes the key.
 */
export function getSettingValue(
    availableSettings: AvailableSettings,
    settings: Settings,
    key: string,
    scope?: string,
): EffectiveSetting | undefined {
    const match = findSetting(availableSettings, key);
    if (!match) return undefined;
    const { setting } = match;
    const shipped = findSettingDefault(availableSettings, settings, match, scope);
    const tables = listApplicableTables(settings, scope);
    let initialSource = 'unset';
    if (shipped !== undefined)
        initialSource =
            shipped.configuration === 'gspot default' ? 'gspot default' : `configuration ${shipped.configuration}`;
    const start: EffectiveValue = {
        value: shipped?.value,
        source: initialSource,
        origin: shipped ? 'configuration' : 'unset',
        reason: undefined,
    };
    const keys = listPossibleKeys(match, key);
    let walked = start;
    for (const table of tables) walked = mergeTable(setting, key, walked, table, keys);
    const { value, source, reason, origin, originScope } = walked;
    return {
        key,
        setting,
        value,
        source,
        origin,
        ...stripUndefined({ reason, scope, originScope }),
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
 * List every setting key that a settings table writes, in dotted form.
 *
 * @param settings the root table or one scope.
 * @param availableSettings the known settings, with nested tool keys.
 * @returns all known written keys, plus unknown keys from open settings tables.
 */
export function listWrittenKeys(settings: SettingsTable, availableSettings: AvailableSettings): string[] {
    const keys: string[] = [];
    const pending = (settings.tools === undefined ? [] : Object.entries(settings.tools)).flatMap(([tool, table]) =>
        table === undefined
            ? []
            : Object.entries(table).map(([field, value]) => ({ key: `tools.${tool}.${field}`, value })),
    );
    pending.push(
        ...Object.entries(settings.written).flatMap(([name, table]) => {
            if (availableSettings.settings.has(name)) return [{ key: name, value: table }];
            if (isTable(table) && name !== 'tools' && name !== 'removed_configurations')
                return Object.entries(table).map(([field, value]) => ({ key: `${name}.${field}`, value }));
            return [];
        }),
    );
    for (const { key, value } of pending) {
        if (isKeyGroup(availableSettings, key, value))
            pending.push(...Object.entries(value).map(([field, child]) => ({ key: `${key}.${field}`, value: child })));
        else keys.push(key);
    }
    const format = (settings.format === undefined ? [] : Object.keys(settings.format)).map((key) => `format.${key}`);
    const settingKeys = [...availableSettings.settings.keys()].filter(
        (key) => getWrittenSetting(settings, key) !== undefined,
    );
    return [...new Set([...settingKeys, ...keys, ...format])];
}

/**
 * List the settings that apply, with language defaults and written variants, in key order.
 *
 * @param availableSettings the settings and defaults of the selected configurations.
 * @param settings the parsed gspot.toml.
 * @param scope the folder whose table applies last, if any.
 * @returns the resolved settings in key order.
 */
export function listEffectiveSettings(
    availableSettings: AvailableSettings,
    settings: Settings,
    scope?: string,
): EffectiveSetting[] {
    const keys = [
        ...new Set([
            ...availableSettings.settings.keys(),
            ...availableSettings.defaults.keys(),
            ...listApplicableTables(settings, scope).flatMap(({ table }) =>
                listWrittenKeys(table, availableSettings).filter(
                    (key) => findSetting(availableSettings, key) !== undefined,
                ),
            ),
        ]),
    ].toSorted((a, b) => a.localeCompare(b));
    return keys
        .map((key) => getSettingValue(availableSettings, settings, key, scope))
        .filter((row) => row !== undefined);
}

/**
 * Get the table name of a setting: tools.<tool> for a tool setting, else the first part of the key.
 *
 * @param key the full setting name.
 * @returns its table name.
 */
export function getSettingTable(key: string): string {
    const [table, tool] = key.split('.');
    if (table === 'tools' && tool !== undefined) return `${table}.${tool}`;
    return table as string;
}
