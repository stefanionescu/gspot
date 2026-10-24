import { z } from 'zod';
import { selectForScope } from '#cli/settings/scopes.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { GspotError, formatZodIssue } from '#cli/system/errors.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { LimitLanguage } from '#cli/types/settings/values.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { unwrapSettingSchema } from '#cli/schemas/settings/fields.ts';
import { formatCodeList, formatSimilarNames } from '#cli/system/text.ts';
import type { WrittenConfiguration } from '#cli/types/configurations.ts';
import { listUnknownConfigurations } from '#cli/configurations/select.ts';
import { type AvailableSettings } from '#cli/types/settings/inheritance.ts';
import { validateSettingReasons } from '#cli/settings/validation/reasons.ts';
import { type Settings, type SettingsError } from '#cli/types/settings/file.ts';
import { SETTINGS_REFERENCE_URL } from '#cli/config/settings/validation/schema.ts';
import { listCheckIds, readConfigurations } from '#cli/configurations/manifests.ts';
import { scopeSchema, settingsSchema, listRecordFields } from '#cli/schemas/settings/file.ts';

import {
    validateScopePaths,
    validateRuleExcludes,
    validateSettingRules,
    validateRuleFilePaths,
} from '#cli/settings/validation/values.ts';

/**
 * Name the invalid setting, and keep the message of the validator.
 *
 * @param issue the schema validation message.
 * @returns the setting path and its validation failure, each line after the gspot.toml name.
 */
export function formatSettingsIssue(issue: z.core.$ZodIssue): string[] {
    const branches = issue.code === 'invalid_union' ? issue.errors : [];
    const reasonedValueErrors = branches.find((errors) =>
        errors.some((child) => child.path[0] === 'value' || child.path[0] === 'reason'),
    );
    if (reasonedValueErrors !== undefined)
        return reasonedValueErrors.flatMap((child) =>
            formatSettingsIssue({ ...child, path: [...issue.path, ...child.path] }),
        );
    if (issue.code === 'invalid_key')
        return issue.issues.flatMap((child) => formatSettingsIssue({ ...child, path: [...issue.path, ...child.path] }));
    const segments = issue.path.filter((segment): segment is KeyPath[number] => typeof segment !== 'symbol');
    if (issue.code !== 'unrecognized_keys') return formatZodIssue(issue).map((line) => `${SETTINGS_FILE}: ${line}`);
    return issue.keys.map((key) => `${SETTINGS_FILE}: ${formatUnknownKey(segments, key)}`);
}

function selectChildSchema(schema: z.ZodType | undefined, segment: KeyPath[number]): z.ZodType | undefined {
    const table = schema === undefined ? undefined : unwrapSettingSchema(schema);
    if (table instanceof z.ZodArray && typeof segment === 'number') return table.element as z.ZodType;
    return table instanceof z.ZodObject ? (table.shape[String(segment)] as z.ZodType | undefined) : undefined;
}

function formatSimilarKeys(segments: KeyPath, key: string): string {
    const [record, , ...scopeFields] = segments;
    let schema: z.ZodType | undefined = record === 'scope' ? scopeSchema : settingsSchema;
    for (const segment of record === 'scope' ? scopeFields : segments) schema = selectChildSchema(schema, segment);
    const table = schema === undefined ? undefined : unwrapSettingSchema(schema);
    return table instanceof z.ZodObject ? formatSimilarNames(key, Object.keys(table.shape)) : '';
}

function formatUnknownKey(segments: KeyPath, key: string): string {
    const [record, , ...scopeFields] = segments;
    const [table, language] = record === 'scope' ? scopeFields : segments;
    if (table === 'limits' && typeof language === 'string')
        return `\`limits.${language}.${key}\` is not a limit any check reads. The limits that ${language} reads are ${formatCodeList(Object.keys(limitsSchema.shape[language as LimitLanguage].unwrap().shape))}.`;
    const fields: Readonly<Record<string, readonly string[]>> = listRecordFields();
    const recordName = [...scopeFields, key].map(String).join('.');
    if (record === 'scope' && Object.hasOwn(fields, recordName))
        return `Write [[${recordName}]] at the root.${fields[recordName]?.includes('paths') === true ? ' Its paths say where it applies.' : ''}`;
    return `${formatKeyPlace(segments)}: \`${key}\` is not a gspot.toml setting.${formatSimilarKeys(segments, key)} See ${SETTINGS_REFERENCE_URL} for every key.`;
}

function formatKeyPlace(segments: KeyPath): string {
    const [record, scopeIndex, ...scopeFields] = segments;
    if (record !== 'scope') return segments.length === 0 ? 'the top level' : `[${segments.map(String).join('.')}]`;
    const section = scopeFields.length === 0 ? '' : ` [${scopeFields.map(String).join('.')}]`;
    return `[[scope]] record ${String(Number(scopeIndex) + 1)}${section}`;
}

function throwErrors(errors: SettingsError[]): never {
    const lines = errors.map((error) =>
        [SETTINGS_FILE, error.path.map(String).join('.'), error.message].filter((text) => text !== '').join(': '),
    );
    throw new GspotError('settings', lines.join('\n'));
}

/**
 * Validate the written configuration lists, tool options, ignores, and paths before a command uses them.
 *
 * @param settings the parsed gspot.toml.
 * @param repositoryRoot the optional folder for checking declared scope paths.
 */
export function validateSettings(settings: Settings, repositoryRoot: string | undefined): void {
    const configurations = readConfigurations();
    const written: WrittenConfiguration[] = [
        ...settings.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...Object.values(settings.scopes).flatMap((scope, scopeIndex) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', scopeIndex, 'configurations', index] })),
        ),
    ];
    const unknown = listUnknownConfigurations(written, configurations);
    if (unknown.length > 0) throwErrors(unknown);
    const bundledChecks = listCheckIds([]);
    const checks = listCheckIds(Object.values(settings.commandChecks));
    const availableBySelection = new Map<string, AvailableSettings>();
    const scopes = new Map(
        ['', ...Object.keys(settings.scopes)].map((scope) => {
            const selected = selectForScope(settings, scope, configurations);
            const key = JSON.stringify(selected.map((configuration) => configuration.name));
            let available = availableBySelection.get(key);
            if (available === undefined) {
                available = buildAvailableSettings(selected, settings.level);
                availableBySelection.set(key, available);
            }
            return [scope, available];
        }),
    );
    const rootKeys = scopes.get('') as AvailableSettings;
    scopes.delete('');
    const general = [...configurations.values()].filter((configuration) => configuration.group === 'general');
    const errors: SettingsError[] = [
        ...validateSettingReasons(settings),
        ...validateSettingRules(settings),
        ...Object.values(settings.commandChecks).flatMap((commandCheck, index) =>
            bundledChecks.includes(commandCheck.id)
                ? [
                      {
                          path: ['command_check', index, 'id'],
                          message: `The command check ${commandCheck.id} has the same ID as a configuration check. Give it another ID.`,
                      },
                  ]
                : [],
        ),
        ...settings.ignore.flatMap((ignore, index) =>
            ignore.check === undefined || checks.includes(ignore.check)
                ? []
                : [
                      {
                          path: ['ignore', index, 'check'],
                          message: `There is no check called ${ignore.check}.${formatSimilarNames(ignore.check, checks)}`,
                      },
                  ],
        ),
        ...validateRuleExcludes(settings.rules.exclude, configurations),
        ...(repositoryRoot === undefined ? [] : validateScopePaths(repositoryRoot, settings)),
        ...(repositoryRoot === undefined ? [] : validateRuleFilePaths(repositoryRoot, settings)),
        ...validateKeys(rootKeys, settings, scopes, buildAvailableSettings(general, settings.level)),
    ];
    if (errors.length > 0) throwErrors(errors);
}
