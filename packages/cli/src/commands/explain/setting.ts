import { NOT_SET, REASON_HELP, REASON_OPTION_TEXT } from '#cli/config/commands/reports.ts';
import { listSettingReaders } from '#cli/engine/skips.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { findSetting, findSettingDefault, getSettingValue } from '#cli/settings/inherit.ts';
import { findSettingSchema, RECORD_FIELDS } from '#cli/settings/lookup.ts';
import { buildSettings } from '#cli/settings/read.ts';
import { isWeakening } from '#cli/settings/validation/reasons.ts';
import { formatNameList, formatScope, quoteArgument } from '#cli/system/text.ts';
import type { ExplainedSetting, Explanation, SettingScope } from '#cli/types/commands/reports.ts';
import type { Setting } from '#cli/types/manifests.ts';
import type { Session } from '#cli/types/tools.ts';

function formatSettingScope(key: string, setting: Setting, scopeSetting: SettingScope): string[] {
    const { scopePath, shipped, inherited } = scopeSetting;
    const shown =
        inherited?.value === undefined ? NOT_SET : `${JSON.stringify(inherited.value)} (from ${inherited.source})`;
    return [
        '',
        `Scope: ${formatScope(scopePath)}`,
        `Shipped default: ${shipped === undefined ? NOT_SET : JSON.stringify(shipped)}`,
        `Current value: ${shown}`,
        ...(scopeSetting.readBy.length === 0 ? [] : [`Read by: ${scopeSetting.readBy.join(', ')}`]),
        ...formatChangeLines(key, setting, scopeSetting),
    ];
}

function formatReasonLines(setting: Setting, { shipped, inherited }: SettingScope): string[] {
    const value = inherited?.value;
    const isLoose = value !== undefined && isWeakening(setting, value, shipped);
    return [
        ...(isLoose ? [REASON_HELP] : []),
        ...(inherited?.reason === undefined ? [] : [`Reason on record: ${inherited.reason}`]),
    ];
}

function formatReasonOption(setting: Setting): string {
    if (setting.reason_values === true) return ' --reason "<why>"';
    return setting.reason_for === undefined ? '' : REASON_OPTION_TEXT;
}

function formatChangeLines(key: string, setting: Setting, scopeSetting: SettingScope): string[] {
    if (Object.hasOwn(RECORD_FIELDS, key))
        return [`Change it: write [[${key}]] records by hand in gspot.toml, then run gspot install.`];
    const { scopePath } = scopeSetting;
    const target = scopePath === '' ? '' : ` --scope ${quoteArgument(scopePath)}`;
    return [
        ...formatReasonLines(setting, scopeSetting),
        `Change it: gspot set ${quoteArgument(key)} <value>${target}${formatReasonOption(setting)}`,
        `Back to the default: gspot unset ${quoteArgument(key)}${target}`,
    ];
}

function readShippedSetting(key: string): ExplainedSetting | undefined {
    const settings = buildSettings(settingsSchema.parse({}), {});
    const available = buildAvailableSettings(readConfigurations().values().toArray(), settings.level);
    const match = findSetting(available, key);
    if (match === undefined) return undefined;
    const shipped = findSettingDefault(available, settings, match, '')?.value;
    const scopeSetting = { scopePath: '', shipped, inherited: undefined, readBy: [] };
    const owners = findSettingSchema(key)?.meta()?.['configurations'] as string[] | undefined;
    const ownership = owners === undefined ? [] : [`Configurations: ${formatNameList(owners)}`];
    return {
        setting: match.setting,
        scopes: [{ scope: '', default: shipped }],
        text: [
            key,
            '',
            match.setting.description.replaceAll('`', ''),
            ...ownership,
            'No gspot.toml here: these are the shipped values',
            ...formatSettingScope(key, match.setting, scopeSetting),
            '',
        ].join('\n'),
    };
}

function findSessionSetting(session: Session, key: string): ExplainedSetting | undefined {
    const { settings } = session;
    const isScopeKey = findSettingSchema(key, scopeSchema) !== undefined;
    const scopes = session.scopes.flatMap((scope) => {
        const match = findSetting(scope.availableSettings, key);
        if (match === undefined || (!isScopeKey && scope.path !== '')) return [];
        return [
            {
                scopePath: scope.path,
                setting: match.setting,
                readBy: listSettingReaders(settings, scope, key).map((reader) =>
                    reader.note === undefined ? reader.check : `${reader.check} (${reader.note})`,
                ),
                inherited: getSettingValue(scope.availableSettings, settings, key, scope.path),
                shipped: findSettingDefault(scope.availableSettings, settings, match, scope.path)?.value,
            },
        ];
    });
    const first = scopes[0];
    if (first === undefined) return undefined;
    const lines = [
        key,
        '',
        first.setting.description.replaceAll('`', ''),
        ...(first.setting.reason_for === undefined ? [] : ['', `Reason: needed for ${first.setting.reason_for}`]),
        ...scopes.flatMap((each) => formatSettingScope(key, first.setting, each)),
    ];
    return {
        setting: first.setting,
        text: `${lines.join('\n')}\n`,
        scopes: scopes.map(({ scopePath, shipped, inherited, readBy }) => ({
            scope: scopePath,
            default: shipped,
            value: inherited?.value,
            source: inherited?.origin,
            ...(readBy.length > 0 && { readBy }),
            reason: inherited?.reason,
        })),
    };
}

/**
Describe a setting's defaults, effective values, and edit commands.

@param session the repository settings and selected scopes, when available.
@param key the setting name to resolve.
@returns undefined when no selected configuration declares the setting.
*/
export function explainSetting(session: Session | undefined, key: string): Explanation | undefined {
    const explained = session === undefined ? readShippedSetting(key) : findSessionSetting(session, key);
    if (explained === undefined) return undefined;
    const { setting, text: explanation, scopes } = explained;
    return {
        kind: 'setting',
        subject: key,
        text: explanation,
        facts: {
            setting: key,
            type: setting.type,
            description: setting.description,
            default: setting.default,
            defaultAll: setting.default_all,
            languageDefaults: setting.language_defaults,
            reasonFor: setting.reason_for,
            scopes,
        },
    };
}
