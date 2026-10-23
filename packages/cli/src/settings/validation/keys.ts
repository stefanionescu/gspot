import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { quoteArgument, formatCodeList, selectSimilarNames } from '#cli/system/text.ts';
import { isLoosening, validateReason, isReasonAccepted } from '#cli/settings/validation/reasons.ts';
import { type Settings, type SettingsError, type SettingsTable } from '#cli/types/settings/file.ts';
import type { SettingMatch, WrittenSetting, AvailableSettings } from '#cli/types/settings/inheritance.ts';

import {
    findSetting,
    getSettingTable,
    getSettingValue,
    listWrittenKeys,
    getWrittenSetting,
    listSettingsTables,
    findSettingDefault,
    listApplicableTables,
} from '#cli/settings/inherit.ts';

function formatLooseningError(
    key: string,
    written: WrittenSetting,
    shipped: unknown,
    scope: string | undefined,
): string {
    const shown = shipped === undefined ? 'default' : `default ${JSON.stringify(shipped)}`;
    const scopeFlag = scope === undefined ? '' : ` --scope ${quoteArgument(scope)}`;
    const value = JSON.stringify(written.value);
    const argument = typeof written.value === 'string' ? written.value : value;
    return `\`${key} = ${value}\` is looser than the shipped ${shown}, so it needs a reason. Run: gspot set ${quoteArgument(key)} ${quoteArgument(argument)}${scopeFlag} --reason "<why>"`;
}

function validateWrittenList(
    key: string,
    written: WrittenSetting,
    match: SettingMatch,
    shipped: unknown,
): SettingsError[] {
    if (!Array.isArray(written.value)) return [];
    const message =
        written.reason !== undefined || isLoosening(match.setting, written.value, shipped)
            ? validateReason(key, written.reason)
            : undefined;
    return message === undefined ? [] : [{ path: [...key.split('.'), 'reason'], message }];
}

function validateWrittenScalar(
    key: string,
    written: WrittenSetting,
    match: SettingMatch,
    scope: string | undefined,
    shipped: unknown,
): SettingsError[] {
    if (written.reason !== undefined) {
        const message = validateReason(key, written.reason);
        if (message !== undefined) return [{ path: [...key.split('.'), 'reason'], message }];
    }
    if (!isLoosening(match.setting, written.value, shipped) || isReasonAccepted(written.reason)) return [];
    const error = formatLooseningError(key, written, shipped, scope);
    return [{ path: key.split('.'), message: error }];
}

function validateWrittenKey(
    availableSettings: AvailableSettings,
    settings: Settings,
    table: SettingsTable,
    scope: string | undefined,
    key: string,
): SettingsError[] {
    const match = findSetting(availableSettings, key);
    if (!match) return [{ path: key.split('.'), message: formatUnknownSetting(availableSettings, key) }];
    const written = getWrittenSetting(table, key);
    if (!written) return [];
    const shipped = findSettingDefault(availableSettings, settings, match, scope)?.value;
    if (written.reason !== undefined && !isLoosening(match.setting, written.value, shipped))
        return [
            {
                path: key.split('.'),
                message: `\`${key}\` does not loosen the default. Write it as a plain value, without a reason.`,
            },
        ];
    if (match.setting.type === 'list') return validateWrittenList(key, written, match, shipped);
    return validateWrittenScalar(key, written, match, scope, shipped);
}

function listUnsettledConflicts(
    availableSettings: AvailableSettings,
    settings: Settings,
    scopeAvailable: Map<string, AvailableSettings>,
): SettingsError[] {
    const errors: SettingsError[] = [];
    const availableByScope = [
        { selected: availableSettings, scope: undefined, path: ['configurations'] as KeyPath },
        ...[...scopeAvailable].map(([scope, selected], index) => ({
            selected,
            scope,
            path: ['scope', index, 'configurations'] as KeyPath,
        })),
    ];
    for (const { selected, scope, path } of availableByScope) {
        const tables = listApplicableTables(settings, scope);
        for (const { key, message: text } of selected.errors)
            if (!tables.some(({ table }) => getWrittenSetting(table, key) !== undefined))
                errors.push({ path, message: text });
    }
    return errors;
}

/**
 * Name an unknown setting, and list the closest keys in the same table.
 *
 * @param availableSettings the settings of the configurations.
 * @param key the written dotted name.
 * @returns the error, with a command that lists the settings.
 */
export function formatUnknownSetting(availableSettings: AvailableSettings, key: string): string {
    const all = availableSettings.settings.keys().toArray();
    if (key.startsWith('limits.')) {
        const limits = all.filter((name) => name.startsWith('limits.'));
        return `\`${key}\` is not a limit any check reads. The limits that exist are ${formatCodeList(limits.map((name) => name.slice('limits.'.length)))}.`;
    }
    const prefix = key.includes('.') ? getSettingTable(key) : '';
    const keys = all
        .filter((name) => (prefix === '' ? !name.includes('.') : name.startsWith(`${prefix}.`)))
        .map((name) => (prefix === '' ? name : name.slice(prefix.length + 1)));
    const near = selectSimilarNames(prefix === '' ? key : key.slice(prefix.length + 1), keys);
    const rest = keys.filter((each) => !near.includes(each));
    const suggestions = [...near, ...rest];
    const place = prefix === '' ? 'at the top level' : 'under that table';
    return `No selected configuration has the setting ${key}. ${
        suggestions.length === 0
            ? `No setting exists ${place}.`
            : `The settings that exist ${place} are ${formatCodeList(suggestions)}.`
    } Run \`gspot list settings\` to see every one.`;
}

/**
 * Validate every written key against the known settings and the loosening rule.
 *
 * @param availableSettings the settings and defaults of the selected configurations.
 * @param settings the parsed gspot.toml.
 * @param scopeAvailable the settings of each scope by path, which its own table uses.
 * @param everyConfiguration the settings saved for configurations whose repository evidence disappeared.
 * @returns the errors in plain English, empty when the settings pass validation.
 */
export function validateKeys(
    availableSettings: AvailableSettings,
    settings: Settings,
    scopeAvailable: Map<string, AvailableSettings>,
    everyConfiguration: AvailableSettings,
): SettingsError[] {
    const errors = listUnsettledConflicts(availableSettings, settings, scopeAvailable);
    const later = [availableSettings, ...scopeAvailable.values(), everyConfiguration].toReversed();
    const everywhere: AvailableSettings = {
        settings: new Map(later.flatMap((scopeSettings) => scopeSettings.settings.entries().toArray())),
        defaults: new Map(later.flatMap((scopeSettings) => scopeSettings.defaults.entries().toArray())),
        errors: availableSettings.errors,
    };
    const coverageLines = getSettingValue(everywhere, settings, 'coverage.lines')?.value;
    const targetErrors = (settings.coverage?.swift_target ?? [])
        .map((target, index) => ({ target, index }))
        .filter(
            ({ target }) =>
                typeof coverageLines === 'number' && target.lines < coverageLines && target.reason === undefined,
        )
        .map(({ index }) => ({
            path: ['coverage', 'swift_target', index, 'reason'],
            message: 'A Swift target with a lower line minimum than coverage.lines needs a reason.',
        }));
    errors.push(...targetErrors);
    for (const { table, scope, path } of listSettingsTables(settings)) {
        const active = scope === undefined ? everywhere : (scopeAvailable.get(scope) as AvailableSettings);
        const selectedAvailable: AvailableSettings = {
            settings: new Map([...everywhere.settings, ...active.settings]),
            defaults: new Map([...everywhere.defaults, ...active.defaults]),
            errors: active.errors,
        };
        const found = [
            ...listWrittenKeys(table, selectedAvailable).flatMap((key) =>
                validateWrittenKey(selectedAvailable, settings, table, scope, key),
            ),
        ];
        errors.push(...found.map((error) => ({ ...error, path: [...path, ...error.path] })));
    }
    return errors;
}
