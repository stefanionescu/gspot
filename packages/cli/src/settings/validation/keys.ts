import { TABLE_KEY_SEGMENTS } from '#cli/config/settings/schema.ts';
import { AT_TOP_LEVEL, UNDER_TABLE } from '#cli/config/settings/validation.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import {
    findSetting,
    findSettingDefault,
    findWrittenSetting,
    listApplicableTables,
    listSettingsTables,
    listWrittenKeys,
} from '#cli/settings/inherit.ts';
import { RECORD_FIELDS } from '#cli/settings/lookup.ts';
import { joinSettingPaths } from '#cli/settings/paths.ts';
import { isWeakening } from '#cli/settings/validation/reasons.ts';
import { getRequired } from '#cli/system/tables.ts';
import { formatCodeList, formatNameList, selectSimilarNames } from '#cli/system/text.ts';
import type { Setting } from '#cli/types/manifests.ts';
import type { AvailableSettings, Settings, SettingsError, SettingsTable, WrittenSetting } from '#cli/types/settings.ts';

function formatWeakeningError(key: string, written: WrittenSetting, shipped: unknown): string {
    const shown = shipped === undefined ? 'default' : `default ${JSON.stringify(shipped)}`;
    const value = JSON.stringify(written.value);
    return `${value} is weaker than the shipped ${shown}, so it needs a reason. Write ${key} = { value = ${value}, reason = "<why>" }.`;
}

function validateWrittenReason(
    key: string,
    written: WrittenSetting,
    setting: Setting,
    scopePath: string,
    shipped: unknown,
): SettingsError[] {
    const joined = joinSettingPaths(key, written.value, scopePath);
    if (written.reason !== undefined || !isWeakening(setting, joined, shipped)) return [];
    if (setting.type !== 'list')
        return [{ path: key.split('.'), message: formatWeakeningError(key, written, shipped) }];
    return Array.isArray(written.value)
        ? [
              {
                  path: [...key.split('.'), 'reason'],
                  message: `${key} needs a reason. Write ${key} = { value = [...], reason = "<why>" }.`,
              },
          ]
        : [];
}

function validateWrittenKey(
    availableSettings: AvailableSettings,
    settings: Settings,
    table: SettingsTable,
    location: { scopePath: string; offered: ReadonlySet<string> },
    key: string,
): SettingsError[] {
    const { scopePath, offered } = location;
    const match = findSetting(availableSettings, key);
    if (!match)
        return [
            {
                path: key.split('.'),
                message: formatUnknownSetting(key, { available: availableSettings.settings.keys().toArray(), offered }),
            },
        ];
    const written = findWrittenSetting(table, key);
    if (!written) return [];
    const shipped = findSettingDefault(availableSettings, settings, match, scopePath)?.value;
    return validateWrittenReason(key, written, match.setting, scopePath, shipped);
}

function listUnsettledConflicts(
    availableSettings: AvailableSettings,
    settings: Settings,
    scopeAvailable: Map<string, AvailableSettings>,
): SettingsError[] {
    const errors: SettingsError[] = [];
    const availableByScope = [
        { selected: availableSettings, scopePath: '', path: ['configurations'] },
        ...[...scopeAvailable].map(([scopePath, selected], index) => ({
            selected,
            scopePath,
            path: ['scope', index, 'configurations'],
        })),
    ];
    for (const { selected, scopePath, path } of availableByScope) {
        const tables = listApplicableTables(settings, scopePath);
        for (const { key, message: text } of selected.errors)
            if (tables.every(({ table }) => findWrittenSetting(table, key) === undefined))
                errors.push({ path, message: text });
    }
    return errors;
}

function formatUnknownLimitSetting(key: string, settings: string[]): string {
    if (key.endsWith('.min_function_statements'))
        return `${key} is now ${key.replace('min_function_statements', 'trivial_function_statements')}, with the same value.`;
    const limits = settings.filter((name) => name.startsWith('limits.'));
    const near = selectSimilarNames(key, limits);
    return near.length === 0
        ? `There is no setting called ${key}. The limits that exist are ${formatCodeList(limits.map((name) => name.slice('limits.'.length)))}.`
        : `There is no setting called ${key}. Did you mean ${formatCodeList(near)}?`;
}

function formatUnknownTable(key: string, availableKeys: string[]): string | undefined {
    if (!key.startsWith('tools.')) return undefined;
    const [parent, table] = key.split('.') as [string, string];
    const tables = new Set(
        availableKeys
            .filter((name) => name.startsWith(`${parent}.`))
            .map((name) => name.split('.', TABLE_KEY_SEGMENTS)[1] as string),
    );
    if (tables.size === 0 || tables.has(table)) return undefined;
    const near = selectSimilarNames(table, [...tables]);
    const correction = near.length === 0 ? '' : ` Did you mean ${formatCodeList(near)}?`;
    return `There is no ${parent}.${table} table.${correction} The ${parent} tables are ${formatCodeList([...tables])}.`;
}

function formatTableKeys(prefix: string, names: string[]): string {
    return formatCodeList(prefix === '' ? names : names.map((name) => `${prefix}.${name}`));
}

function formatUnknownField(key: string, availableKeys: string[]): string {
    const segments = key.split('.');
    const depth = Math.min(key.startsWith('tools.') ? TABLE_KEY_SEGMENTS : 1, segments.length - 1);
    const unknownTable = formatUnknownTable(key, availableKeys);
    if (unknownTable !== undefined) return unknownTable;
    const prefix = segments.slice(0, depth).join('.');
    const keys =
        prefix === ''
            ? [...new Set(availableKeys.map((name) => name.split('.', 1)[0] as string))].filter(
                  (name) => !Object.hasOwn(RECORD_FIELDS, name),
              )
            : availableKeys
                  .filter((name) => name.startsWith(`${prefix}.`))
                  .map((name) => name.slice(prefix.length + 1));
    const near = selectSimilarNames(prefix === '' ? key : key.slice(prefix.length + 1), keys);
    const correction = near.length === 0 ? '' : ` Did you mean ${formatTableKeys(prefix, near)}?`;
    const rest = keys.filter((each) => !near.includes(each));
    const suggestions = [...near, ...rest];
    const place = prefix === '' ? AT_TOP_LEVEL : UNDER_TABLE;
    return `There is no setting called ${key}.${correction} ${
        suggestions.length === 0
            ? `No setting exists ${place}.`
            : `The settings that exist ${place} are ${formatTableKeys(prefix, suggestions)}.`
    }`;
}

/**
Name an unknown setting, and list the closest keys in the same table. A setting of a table that no scope offers names
the configurations that offer it and the command that adds one.

@param key the written dotted name.
@param keys the settings available at this location, and the settings that any scope offers.
@param keys.available the settings available at this location.
@param keys.offered the settings that any scope offers. When one of them shares the table of the key, a scope selects
a configuration of that table.
@returns the error, with a command that lists the settings or adds the configuration.
*/
export function formatUnknownSetting(
    key: string,
    { available: availableKeys, offered }: { available: string[]; offered: ReadonlySet<string> },
): string {
    const descendants = availableKeys.filter((name) => name.startsWith(`${key}.`));
    if (descendants.length > 0)
        return `${key} is a table. Name one of its settings, such as ${descendants[0] as string}. The settings are ${formatCodeList(descendants)}.`;
    const table = `${key.split('.', 1)[0] as string}.`;
    const owners = offered.values().some((name) => name.startsWith(table))
        ? []
        : SETTINGS_BY_CONFIGURATION.entries()
              .filter(([, settings]) => settings.some((setting) => setting.name === key))
              .map(([name]) => name)
              .toArray();
    if (owners.length === 1)
        return `${key} belongs to ${String(owners[0])}, which no scope selects. Run gspot add ${String(owners[0])}.`;
    if (owners.length > 1)
        return `${key} belongs to ${formatNameList(owners)}, and no scope selects any of them. Run gspot add with the one that this repository uses.`;
    return key.startsWith('limits.')
        ? formatUnknownLimitSetting(key, availableKeys)
        : formatUnknownField(key, availableKeys);
}

/**
Validate every written key against the known settings and the weakening rule.

@param availableSettings the settings and defaults of the selected configurations.
@param settings the parsed gspot.toml.
@param scopeAvailable the settings of each scope by path, which its own table uses.
@param automatic the settings of the configurations that gspot selects in every repository or is about to select.
@returns empty when the settings pass validation.
*/
export function validateKeys(
    availableSettings: AvailableSettings,
    settings: Settings,
    scopeAvailable: Map<string, AvailableSettings>,
    automatic: AvailableSettings,
): SettingsError[] {
    const errors = listUnsettledConflicts(availableSettings, settings, scopeAvailable);
    const later = [availableSettings, ...scopeAvailable.values(), automatic].toReversed();
    const everywhere: AvailableSettings = {
        settings: new Map(later.flatMap((scopeSettings) => scopeSettings.settings.entries().toArray())),
        defaults: new Map(later.flatMap((scopeSettings) => scopeSettings.defaults.entries().toArray())),
        errors: availableSettings.errors,
    };
    const offered = new Set(everywhere.settings.keys());
    for (const { table, scopePath, path } of listSettingsTables(settings)) {
        const active = scopePath === '' ? everywhere : getRequired(scopeAvailable, scopePath, 'scope settings');
        const selectedAvailable: AvailableSettings = {
            settings: new Map([...automatic.settings, ...active.settings]),
            defaults: new Map([...automatic.defaults, ...active.defaults]),
            errors: active.errors,
        };
        const found = listWrittenKeys(table, selectedAvailable).flatMap((key) =>
            validateWrittenKey(selectedAvailable, settings, table, { scopePath, offered }, key),
        );
        errors.push(...found.map((error) => ({ ...error, path: [...path, ...error.path] })));
    }
    return errors;
}
