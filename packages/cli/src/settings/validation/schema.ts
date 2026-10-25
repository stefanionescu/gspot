import { z } from 'zod';
import { GspotError } from '#cli/system/errors.ts';
import { getValueAt } from '#cli/system/tables.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { LimitLanguage } from '#cli/types/settings/values.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import type { TomlSyntax } from '#cli/types/parsers/formats/toml.ts';
import { formatCodeList, formatSimilarNames } from '#cli/system/text.ts';
import type { WrittenConfiguration } from '#cli/types/configurations.ts';
import { listUnknownConfigurations } from '#cli/configurations/select.ts';
import { scopeSchema, settingsSchema } from '#cli/schemas/settings/file.ts';
import { validateSettingReasons } from '#cli/settings/validation/reasons.ts';
import { RECORD_FIELDS, unwrapSettingSchema } from '#cli/settings/schemas.ts';
import { type Settings, type SettingsError } from '#cli/types/settings/file.ts';
import { SETTINGS_REFERENCE_URL } from '#cli/config/settings/validation/schema.ts';
import { listCheckIds, readConfigurations } from '#cli/configurations/manifests.ts';
import { formatSettingsError, formatFileValueError } from '#cli/settings/validation/messages.ts';

import {
    validateScopePaths,
    validateRuleExcludes,
    validateSettingRules,
    validateSwiftTargets,
    validateRuleFilePaths,
} from '#cli/settings/validation/values.ts';

/**
Name the invalid setting, and keep the message of the validator.

@param issue the schema validation message.
@param syntax the parsed source keys and their locations.
@returns the source line, setting path, and validation failure.
*/
export function formatSettingsIssue(issue: z.core.$ZodIssue, syntax: TomlSyntax): string[] {
    const branches = issue.code === 'invalid_union' ? issue.errors : [];
    const reasonedValueErrors = branches.find((errors) =>
        errors.some((child) => child.path[0] === 'value' || child.path[0] === 'reason'),
    );
    if (reasonedValueErrors !== undefined)
        return reasonedValueErrors.flatMap((child) =>
            formatSettingsIssue({ ...child, path: [...issue.path, ...child.path] }, syntax),
        );
    if (issue.code === 'invalid_key')
        return issue.issues.flatMap((child) =>
            formatSettingsIssue({ ...child, path: [...issue.path, ...child.path] }, syntax),
        );
    const segments = issue.path.filter((segment): segment is KeyPath[number] => typeof segment !== 'symbol');
    if (issue.code === 'unrecognized_keys')
        return issue.keys.map((key) =>
            formatSettingsError({ path: [...segments, key], message: formatUnknownKey(segments, key) }, syntax),
        );
    let schema: z.ZodType | undefined = settingsSchema;
    for (const segment of segments) schema = selectChildSchema(schema, segment);
    const message = formatFileValueError(schema, issue, getValueAt(syntax.value, segments));
    return [formatSettingsError({ path: segments, message }, syntax)];
}

function selectChildSchema(schema: z.ZodType | undefined, segment: KeyPath[number]): z.ZodType | undefined {
    let table = schema === undefined ? undefined : unwrapSettingSchema(schema);
    while (table instanceof z.ZodPipe) table = unwrapSettingSchema(table.in as z.ZodType);
    if (table instanceof z.ZodUnion)
        return table.options
            .map((option) => selectChildSchema(option as z.ZodType, segment))
            .find((child) => child !== undefined);
    if (table instanceof z.ZodRecord) return table.valueType as z.ZodType;
    if (typeof segment === 'number' && table instanceof z.ZodArray) return table.element as z.ZodType;
    return table instanceof z.ZodObject ? (table.shape[String(segment)] as z.ZodType | undefined) : undefined;
}

function formatSimilarKeys(segments: KeyPath, key: string): string {
    const [record, , ...scopeFields] = segments;
    let schema: z.ZodType | undefined = record === 'scope' ? scopeSchema : settingsSchema;
    const fields = record === 'scope' ? scopeFields : segments;
    for (const segment of fields) schema = selectChildSchema(schema, segment);
    const table = schema === undefined ? undefined : unwrapSettingSchema(schema);
    return table instanceof z.ZodObject ? formatSimilarNames(key, Object.keys(table.shape)) : '';
}

function formatUnknownKey(segments: KeyPath, key: string): string {
    const [record, , ...scopeFields] = segments;
    const [table, language] = record === 'scope' ? scopeFields : segments;
    if (table === 'limits' && typeof language === 'string')
        return `\`limits.${language}.${key}\` is not a limit any check reads. The limits that ${language} reads are ${formatCodeList(Object.keys(limitsSchema.shape[language as LimitLanguage].unwrap().shape))}.`;
    const fields: Readonly<Record<string, readonly string[]>> = RECORD_FIELDS;
    const recordName = [...scopeFields, key].map(String).join('.');
    if (record === 'scope' && Object.hasOwn(fields, recordName))
        return `Write [[${recordName}]] at the root.${fields[recordName]?.includes('paths') === true ? ' Its paths say where it applies.' : ''}`;
    return `\`${key}\` is not a gspot.toml setting.${formatSimilarKeys(segments, key)} See ${SETTINGS_REFERENCE_URL} for every key.`;
}

/**
Validate the written configuration lists, tool options, ignores, and paths before a command uses them.

@param settings the parsed gspot.toml.
@param root the folder for checking declared scope paths.
@param syntax the written keys and source locations.
*/
export function validateSettings(settings: Settings, root: string, syntax: TomlSyntax): void {
    const configurations = readConfigurations();
    const written: WrittenConfiguration[] = [
        ...settings.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...Object.values(settings.scopes).flatMap((scope, scopeIndex) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', scopeIndex, 'configurations', index] })),
        ),
    ];
    const unknown = listUnknownConfigurations(written, configurations);
    if (unknown.length > 0)
        throw new GspotError('settings', unknown.map((error) => formatSettingsError(error, syntax)).join('\n'));
    const bundledChecks = listCheckIds([]);
    const checks = listCheckIds(Object.values(settings.commandChecks));
    const scopes = new Map(
        Object.keys(settings.scopes).map((scope) => [
            scope,
            buildAvailableSettings(selectForScope(settings, scope, configurations), settings.level),
        ]),
    );
    const rootKeys = buildAvailableSettings(selectForScope(settings, '', configurations), settings.level);
    const general = configurations
        .values()
        .filter((configuration) => configuration.group === 'general')
        .toArray();
    const errors: SettingsError[] = [
        ...validateSettingReasons(settings),
        ...validateSettingRules(settings),
        ...validateSwiftTargets(settings, rootKeys),
        ...Object.values(settings.commandChecks).flatMap((commandCheck, index) =>
            bundledChecks.includes(commandCheck.id)
                ? {
                      path: ['command_check', index, 'id'],
                      message: `The command check ${commandCheck.id} has the same ID as a configuration check. Give it another ID.`,
                  }
                : [],
        ),
        ...settings.ignore.flatMap((ignore, index) =>
            ignore.check === undefined || checks.includes(ignore.check)
                ? []
                : {
                      path: ['ignore', index, 'check'],
                      message: `There is no check called ${ignore.check}.${formatSimilarNames(ignore.check, checks)}`,
                  },
        ),
        ...validateRuleExcludes(settings.rules.exclude, configurations),
        ...validateScopePaths(root, settings),
        ...validateRuleFilePaths(root, settings),
        ...validateKeys(rootKeys, settings, scopes, buildAvailableSettings(general, settings.level)),
    ];
    if (errors.length > 0)
        throw new GspotError('settings', errors.map((error) => formatSettingsError(error, syntax)).join('\n'));
}
