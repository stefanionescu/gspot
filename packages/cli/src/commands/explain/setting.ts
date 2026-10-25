import { quoteArgument } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import { listSettingReaders } from '#cli/planning/readers.ts';
import { RECORD_FIELDS } from '#cli/schemas/settings/file.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { Explanation, SettingScope } from '#cli/types/commands/explain.ts';
import { findSetting, getSettingValue, findSettingDefault } from '#cli/settings/inherit.ts';

function formatSettingScope(key: string, setting: Setting, scopeSetting: SettingScope): string[] {
    const { scope, shipped, inherited } = scopeSetting;
    const { value, source } = inherited ?? { value: undefined, source: 'unset' };
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
    const { scope, shipped, inherited } = scopeSetting;
    const target = scope === '' ? '' : ` --scope ${quoteArgument(scope)}`;
    const value = inherited?.value;
    return [
        ...(value !== undefined && isLoosening(setting, value, shipped)
            ? [
                  'If you set this value, give a reason: write it as { value = ..., reason = "..." }, or run gspot set with --reason.',
              ]
            : []),
        ...(inherited?.reason === undefined ? [] : [`Reason on record: ${inherited.reason}`]),
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
    const scopes = session.scopes.flatMap((scope) => {
        const match = findSetting(scope.availableSettings, key);
        if (match === undefined || (isRecordList && scope.folder.path !== '')) return [];
        return [
            {
                scope: scope.folder.path,
                setting: match.setting,
                readBy: listSettingReaders(settings, scope, key).map((reader) =>
                    reader.note === undefined ? reader.check : `${reader.check} (${reader.note})`,
                ),
                inherited: getSettingValue(scope.availableSettings, settings, key, scope.folder.path),
                shipped: findSettingDefault(scope.availableSettings, settings, match, scope.folder.path)?.value,
            },
        ];
    });
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
            scopes: scopes.map(({ scope, shipped, inherited, readBy }) => ({
                scope,
                default: shipped,
                value: inherited?.value,
                source: inherited?.source,
                ...(readBy.length > 0 && { readBy }),
                reason: inherited?.reason,
            })),
        },
    };
}
