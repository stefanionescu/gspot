import { quoteArgument } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import { listRecordFields } from '#cli/schemas/settings/file.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import type { Setting } from '#cli/types/settings/inheritance.ts';
import type { Explanation, SettingScope } from '#cli/types/commands/explain.ts';
import { findSetting, getSettingValue, findSettingDefault } from '#cli/settings/inherit.ts';

// Describe one scope: the default, the value and where it comes from, and how to change it.
function formatSettingScope(key: string, setting: Setting, entry: SettingScope): string[] {
    const { scope, shipped, effective } = entry;
    const { value, source } = effective ?? { value: undefined, source: 'unset' };
    return [
        '',
        `Scope: ${scope === '' ? ROOT_SCOPE_LABEL : scope}`,
        `Shipped default: ${shipped === undefined ? 'none' : JSON.stringify(shipped)}`,
        `Current value: ${JSON.stringify(value)} (from ${source})`,
        ...formatChangeLines(key, setting, entry),
    ];
}

// How to change the value of one scope: records by hand for a record list, or gspot set and unset.
function formatChangeLines(key: string, setting: Setting, entry: SettingScope): string[] {
    if (Object.hasOwn(listRecordFields(), key))
        return [`Change it: write [[${key}]] records by hand in gspot.toml, then run gspot apply.`];
    const { scope, shipped, effective } = entry;
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
 * Describe a setting's defaults, effective values, and edit commands.
 *
 * @param session the repository settings and selected scopes, when available.
 * @param key the setting name to resolve.
 * @returns the explanation, or undefined when no selected configuration declares the setting.
 */
export function explainSetting(session: Session | undefined, key: string): Explanation | undefined {
    if (session === undefined) return undefined;
    const { settings } = session.settingsFile;
    // A record list lives in the root table only, so only the root scope can change it.
    const recordList = Object.hasOwn(listRecordFields(), key);
    const scopes = session.scopes.flatMap((scope) => {
        const match = findSetting(scope.knownSettings, key);
        if (match === undefined || (recordList && scope.folder.path !== '')) return [];
        return [
            {
                scope: scope.folder.path,
                setting: match.setting,
                effective: getSettingValue(scope.knownSettings, settings, key, scope.folder.path),
                shipped: findSettingDefault(scope.knownSettings, settings, match, scope.folder.path)?.value,
            },
        ];
    });
    const first = scopes[0];
    if (first === undefined) return undefined;
    const lines = [
        key,
        '',
        first.setting.description,
        ...(first.setting.reason_needed === undefined
            ? []
            : ['', `Reason: ${first.setting.reason_needed} needs a reason`]),
        ...scopes.flatMap((entry) => formatSettingScope(key, first.setting, entry)),
    ];
    return {
        kind: 'setting',
        subject: key,
        text: `${lines.join('\n')}\n`,
        data: {
            key,
            ...first.setting,
            scopes: scopes.map(({ scope, shipped, effective }) => ({
                scope,
                default: shipped,
                current: effective?.value,
                source: effective?.source,
                reason: effective?.reason,
            })),
        },
    };
}
