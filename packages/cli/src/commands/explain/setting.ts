import { quoteArgument } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { findSettingsSkip } from '#cli/planning/skips.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { RECORD_FIELDS } from '#cli/schemas/settings/file.ts';
import { LIMIT_READERS } from '#cli/config/commands/explain.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import type { Scope, Setting } from '#cli/types/settings/inheritance.ts';
import { findSetting, getSettingValue, findSettingDefault } from '#cli/settings/inherit.ts';
import type { Explanation, SettingScope, SettingReader } from '#cli/types/commands/explain.ts';

/**
List the selected checks that read a limit and whether its rules run at this level.

@param settings the repository level and ignores.
@param scope the selected configurations and settings of one folder.
@param key the setting whose consumers to find.
@returns the selected readers and their state.
*/
export function listSettingReaders(settings: Settings, scope: Scope, key: string): SettingReader[] {
    if (!key.startsWith('limits.')) return [];
    const names = key.slice('limits.'.length).split('.');
    const limit = names.at(-1) as string;
    const language = names.length === 1 ? undefined : names[0];
    const checks = scope.configurations.flatMap((configuration) => configuration.checks);
    return LIMIT_READERS.values()
        .filter(
            (reader) =>
                reader.limits.includes(limit) && (language === undefined || reader.languages.includes(language)),
        )
        .map((reader) => {
            const check = checks.find((check) => check.id === reader.check);
            if (check === undefined) return undefined;
            const skip = findSettingsSkip(settings, scope, check);
            const note = settings.level === 'all' ? skip?.note : `off at level ${settings.level}`;
            return { check: check.id, enabled: note === undefined, ...(note !== undefined && { note }) };
        })
        .filter((reader) => reader !== undefined)
        .toArray();
}

function formatSettingScope(key: string, setting: Setting, scopeSetting: SettingScope): string[] {
    const { scope, shipped, effective } = scopeSetting;
    const { value, source } = effective ?? { value: undefined, source: 'unset' };
    return [
        '',
        `Scope: ${scope === '' ? ROOT_SCOPE_LABEL : scope}`,
        `Shipped default: ${shipped === undefined ? 'none' : JSON.stringify(shipped)}`,
        `Current value: ${JSON.stringify(value)} (from ${source})`,
        ...(scopeSetting.readBy.length === 0 ? [] : [`Read by: ${scopeSetting.readBy.join(', ')}`]),
        ...formatChangeLines(key, setting, scopeSetting),
    ];
}

function formatChangeLines(key: string, setting: Setting, scopeSetting: SettingScope): string[] {
    if (Object.hasOwn(RECORD_FIELDS, key))
        return [`Change it: write [[${key}]] records by hand in gspot.toml, then run gspot apply.`];
    const { scope, shipped, effective } = scopeSetting;
    const target = scope === '' ? '' : ` --scope ${quoteArgument(scope)}`;
    const value = effective?.value;
    return [
        ...(value !== undefined && isLoosening(setting, value, shipped)
            ? [
                  'If you set this value, give a reason: write it as { value = ..., reason = "..." }, or run gspot set with --reason.',
              ]
            : []),
        ...(effective?.reason === undefined ? [] : [`Reason on record: ${effective.reason}`]),
        `Change it: gspot set ${quoteArgument(key)} <value>${target} [--reason "<why>"]`,
        `Back to the default: gspot unset ${quoteArgument(key)}${target}`,
    ];
}

/**
Describe a setting's defaults, effective values, and edit commands.

@param session the repository settings and selected scopes, when available.
@param key the setting name to resolve.
@returns the explanation, or undefined when no selected configuration declares the setting.
*/
export function explainSetting(session: Session | undefined, key: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const { settings } = session.settingsFile;
    const isRecordList = Object.hasOwn(RECORD_FIELDS, key);
    const scopes = session.scopes
        .values()
        .map((scope) => {
            const match = findSetting(scope.availableSettings, key);
            if (match === undefined || (isRecordList && scope.folder.path !== '')) return undefined;
            return {
                scope: scope.folder.path,
                setting: match.setting,
                readBy: listSettingReaders(settings, scope, key).map((reader) =>
                    reader.note === undefined ? reader.check : `${reader.check} (${reader.note})`,
                ),
                effective: getSettingValue(scope.availableSettings, settings, key, scope.folder.path),
                shipped: findSettingDefault(scope.availableSettings, settings, match, scope.folder.path)?.value,
            };
        })
        .filter((scope) => scope !== undefined)
        .toArray();
    const first = scopes[0];
    if (first === undefined) return undefined;
    const lines = [
        key,
        '',
        first.setting.description,
        ...(first.setting.reason_when === undefined ? [] : ['', `Reason: ${first.setting.reason_when} needs a reason`]),
        ...scopes.flatMap((each) => formatSettingScope(key, first.setting, each)),
    ];
    return {
        kind: 'setting',
        subject: key,
        text: `${lines.join('\n')}\n`,
        facts: {
            key,
            ...first.setting,
            scopes: scopes.map(({ scope, shipped, effective, readBy }) => ({
                scope,
                default: shipped,
                value: effective?.value,
                source: effective?.source,
                ...(readBy.length > 0 && { readBy }),
                reason: effective?.reason,
            })),
        },
    };
}
