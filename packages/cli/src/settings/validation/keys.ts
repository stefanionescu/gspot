import { RECORD_FIELDS } from '#cli/settings/schema-lookup.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { TABLE_KEY_SEGMENTS } from '#cli/config/settings/inheritance.ts';
import { UNDER_TABLE, AT_TOP_LEVEL } from '#cli/config/settings/validation/keys.ts';
import { quoteArgument, formatCodeList, selectSimilarNames } from '#cli/system/text.ts';
import type { Settings, SettingsError, SettingsTable } from '#cli/types/settings/file.ts';
import type { Setting, WrittenSetting, AvailableSettings } from '#cli/types/settings/inheritance.ts';

import {
    findSetting,
    listWrittenKeys,
    findWrittenSetting,
    listSettingsTables,
    findSettingDefault,
    listApplicableTables,
} from '#cli/settings/inherit.ts';

function formatLooseningError(key: string, written: WrittenSetting, shipped: unknown, scopePath: string): string {
    const shown = shipped === undefined ? 'default' : `default ${JSON.stringify(shipped)}`;
    const scopeFlag = scopePath === '' ? '' : ` --scope ${quoteArgument(scopePath)}`;
    const value = JSON.stringify(written.value);
    const argument = typeof written.value === 'string' ? written.value : value;
    return `${value} is looser than the shipped ${shown}, so it needs a reason. Run gspot set ${quoteArgument(key)} ${quoteArgument(argument)}${scopeFlag} --reason "<why>"`;
}

function validateWrittenReason(
    key: string,
    written: WrittenSetting,
    setting: Setting,
    scopePath: string,
    shipped: unknown,
): SettingsError[] {
    const isLoose = isLoosening(setting, written.value, shipped);
    if (written.reason !== undefined)
        return isLoose
            ? []
            : [
                  {
                      path: key.split('.'),
                      message: `${key} does not loosen the default. Write it as a plain value, without a reason.`,
                  },
              ];
    if (!isLoose) return [];
    if (setting.type !== 'list')
        return [{ path: key.split('.'), message: formatLooseningError(key, written, shipped, scopePath) }];
    return Array.isArray(written.value)
        ? [
              {
                  path: [...key.split('.'), 'reason'],
                  message: `${key} needs a reason. Write it as ${key} = { value = [...], reason = "..." }, or run gspot set ${key} ... --reason "<why>".`,
              },
          ]
        : [];
}

function validateWrittenKey(
    availableSettings: AvailableSettings,
    settings: Settings,
    table: SettingsTable,
    scopePath: string,
    key: string,
): SettingsError[] {
    const match = findSetting(availableSettings, key);
    if (!match) return [{ path: key.split('.'), message: formatUnknownSetting(availableSettings, key) }];
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
        { selected: availableSettings, scope: '', path: ['configurations'] as KeyPath },
        ...[...scopeAvailable].map(([scope, selected], index) => ({
            selected,
            scope,
            path: ['scope', index, 'configurations'] as KeyPath,
        })),
    ];
    for (const { selected, scope, path } of availableByScope) {
        const tables = listApplicableTables(settings, scope);
        for (const { key, message: text } of selected.errors)
            if (tables.every(({ table }) => findWrittenSetting(table, key) === undefined))
                errors.push({ path, message: text });
    }
    return errors;
}

function formatUnknownLimitSetting(key: string, settings: string[]): string {
    const limits = settings.filter((name) => name.startsWith('limits.'));
    const near = selectSimilarNames(key, limits);
    return near.length === 0
        ? `There is no setting called ${key}. The limits that exist are ${formatCodeList(limits.map((name) => name.slice('limits.'.length)))}.`
        : `There is no setting called ${key}. Did you mean ${formatCodeList(near)}?`;
}

/**
Name an unknown setting, and list the closest keys in the same table.

@param availableSettings the settings of the configurations.
@param key the written dotted name.
@returns the error, with a command that lists the settings.
*/
export function formatUnknownSetting(availableSettings: AvailableSettings, key: string): string {
    const all = availableSettings.settings.keys().toArray();
    if (key.startsWith('limits.')) return formatUnknownLimitSetting(key, all);
    const depth = key.startsWith('tools.') ? TABLE_KEY_SEGMENTS : 1;
    const prefix = key.includes('.') ? key.split('.').slice(0, depth).join('.') : '';
    const keys =
        prefix === ''
            ? [...new Set(all.map((name) => name.split('.', 1)[0] as string))].filter(
                  (name) => !Object.hasOwn(RECORD_FIELDS, name),
              )
            : all.filter((name) => name.startsWith(`${prefix}.`)).map((name) => name.slice(prefix.length + 1));
    const near = selectSimilarNames(prefix === '' ? key : key.slice(prefix.length + 1), keys);
    const rest = keys.filter((each) => !near.includes(each));
    const suggestions = [...near, ...rest];
    const place = prefix === '' ? AT_TOP_LEVEL : UNDER_TABLE;
    return `There is no setting called ${key} in the selected configurations. ${
        suggestions.length === 0
            ? `No setting exists ${place}.`
            : `The settings that exist ${place} are ${formatCodeList(suggestions)}.`
    } Run gspot list settings to see every one.`;
}

/**
Validate every written key against the known settings and the loosening rule.

@param availableSettings the settings and defaults of the selected configurations.
@param settings the parsed gspot.toml.
@param scopeAvailable the settings of each scope by path, which its own table uses.
@param general the settings of general configurations that repository evidence can select.
@returns empty when the settings pass validation.
*/
export function validateKeys(
    availableSettings: AvailableSettings,
    settings: Settings,
    scopeAvailable: Map<string, AvailableSettings>,
    general: AvailableSettings,
): SettingsError[] {
    const errors = listUnsettledConflicts(availableSettings, settings, scopeAvailable);
    const later = [availableSettings, ...scopeAvailable.values(), general].toReversed();
    const everywhere: AvailableSettings = {
        settings: new Map(later.flatMap((scopeSettings) => scopeSettings.settings.entries().toArray())),
        defaults: new Map(later.flatMap((scopeSettings) => scopeSettings.defaults.entries().toArray())),
        errors: availableSettings.errors,
    };
    for (const { table, scope, path } of listSettingsTables(settings)) {
        const active = scope === '' ? everywhere : (scopeAvailable.get(scope) as AvailableSettings);
        const selectedAvailable: AvailableSettings = {
            settings: new Map([...general.settings, ...active.settings]),
            defaults: new Map([...general.defaults, ...active.defaults]),
            errors: active.errors,
        };
        const found = listWrittenKeys(table, selectedAvailable).flatMap((key) =>
            validateWrittenKey(selectedAvailable, settings, table, scope, key),
        );
        errors.push(...found.map((error) => ({ ...error, path: [...path, ...error.path] })));
    }
    return errors;
}
