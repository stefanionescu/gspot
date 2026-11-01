import type { Session } from '#cli/types/tools.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { buildSettings } from '#cli/settings/read.ts';
import type { Setting } from '#cli/types/manifests.ts';
import { listSettingReaders } from '#cli/engine/skips.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { isLoosening } from '#cli/settings/validation/reasons.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { NOT_SET, REASON_HELP } from '#cli/config/commands/reports.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/configurations/general.ts';
import { RECORD_FIELDS, findSettingSchema } from '#cli/settings/lookup.ts';
import { scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import { findSetting, getSettingValue, findSettingDefault } from '#cli/settings/inherit.ts';
import type { Explanation, SettingScope, ExplainedSetting } from '#cli/types/commands/reports.ts';

function formatSettingScope(key: string, setting: Setting, scopeSetting: SettingScope): string[] {
    const { scope, shipped, inherited } = scopeSetting;
    const shown =
        inherited?.value === undefined ? NOT_SET : `${JSON.stringify(inherited.value)} (from ${inherited.source})`;
    return [
        '',
        `Scope: ${scope === '' ? ROOT_SCOPE_LABEL : scope}`,
        `Shipped default: ${shipped === undefined ? NOT_SET : JSON.stringify(shipped)}`,
        `Current value: ${shown}`,
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
        ...(value !== undefined && isLoosening(setting, value, shipped) ? [REASON_HELP] : []),
        ...(inherited?.reason === undefined ? [] : [`Reason on record: ${inherited.reason}`]),
        `Change it: gspot set ${quoteArgument(key)} <value>${target} [--reason "<why>"]`,
        `Back to the default: gspot unset ${quoteArgument(key)}${target}`,
    ];
}

function readShippedSetting(key: string): ExplainedSetting | undefined {
    const settings = buildSettings(settingsSchema.parse({}), {});
    const available = buildAvailableSettings([...readConfigurations().values()], settings.level);
    const match = findSetting(available, key);
    if (match === undefined) return undefined;
    const shipped = findSettingDefault(available, settings, match, '')?.value;
    const scope = { scope: '', shipped, inherited: undefined, readBy: [] };
    const owners = findSettingSchema(key)?.meta()?.['configurations'] as string[] | undefined;
    const ownership =
        owners === undefined
            ? []
            : [`Configurations: ${new Intl.ListFormat('en', { type: 'conjunction' }).format(owners)}`];
    return {
        setting: match.setting,
        scopes: [{ scope: '', default: shipped }],
        text: [
            key,
            '',
            match.setting.description.replaceAll('`', ''),
            ...ownership,
            'No gspot.toml here: these are the shipped values',
            ...formatSettingScope(key, match.setting, scope),
            '',
        ].join('\n'),
    };
}

function readSessionSetting(session: Session, key: string): ExplainedSetting | undefined {
    const { settings } = session;
    const isScopeKey = findSettingSchema(key, scopeSchema) !== undefined;
    const scopes = session.scopes.flatMap((scope) => {
        const match = findSetting(scope.availableSettings, key);
        if (match === undefined || (!isScopeKey && scope.path !== '')) return [];
        return [
            {
                scope: scope.path,
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
        ...(first.setting.reason_when === undefined ? [] : ['', `Reason: ${first.setting.reason_when} needs a reason`]),
        ...scopes.flatMap((each) => formatSettingScope(key, first.setting, each)),
    ];
    return {
        setting: first.setting,
        text: `${lines.join('\n')}\n`,
        scopes: scopes.map(({ scope, shipped, inherited, readBy }) => ({
            scope,
            default: shipped,
            value: inherited?.value,
            source: inherited?.source,
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
    const explained = session === undefined ? readShippedSetting(key) : readSessionSetting(session, key);
    if (explained === undefined) return undefined;
    const { setting, text: explanation, scopes } = explained;
    return {
        kind: 'setting',
        subject: key,
        text: explanation,
        facts: {
            key,
            type: setting.type,
            description: setting.description,
            default: setting.default,
            defaultAll: setting.default_all,
            languageDefaults: setting.language_defaults,
            reasonRequirement: setting.reason_when,
            scopes,
        },
    };
}
