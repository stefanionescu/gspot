import { z } from 'zod';

import { NO_CHECK_PATHS_MESSAGE, RECORD_PATHS_MESSAGE } from '#cli/config/settings/validation.ts';
import { listCheckIds, readConfigurations } from '#cli/manifests/read.ts';
import { listUnknownConfigurations } from '#cli/manifests/select.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { findChildSchema, RECORD_FIELDS, unwrapSettingSchema } from '#cli/settings/lookup.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { formatUnknownSetting, validateKeys } from '#cli/settings/validation/keys.ts';
import { formatFileValueError } from '#cli/settings/validation/messages.ts';
import { validateSettingReasons } from '#cli/settings/validation/reasons.ts';
import {
    validateRuleExcludes,
    validateRuleFilePaths,
    validateScopePaths,
    validateSettingRules,
    validateSwiftTargets,
} from '#cli/settings/validation/references.ts';
import { findValueAt } from '#cli/system/tables.ts';
import { formatSimilarNames } from '#cli/system/text.ts';
import type { WrittenConfiguration } from '#cli/types/manifests.ts';
import type { KeyPath, TomlSyntax } from '#cli/types/parsers.ts';
import type { Settings, SettingsError } from '#cli/types/settings.ts';

function formatEmptyIgnorePaths(issue: z.core.$ZodIssue, path: KeyPath, syntax: TomlSyntax): SettingsError | undefined {
    const [record, index, field] = path;
    if (record !== 'ignore' || field !== 'paths' || index === undefined || issue.code !== 'too_small') return undefined;
    const check = findValueAt(syntax.value, [record, index, 'check']);
    const message =
        typeof check === 'string'
            ? `paths = [] matches no path. Leave out paths to ignore ${check} everywhere, or list the paths.`
            : NO_CHECK_PATHS_MESSAGE;
    return { path, message };
}

function listSchemaKeys(segments: KeyPath): string[] {
    let schema: z.ZodType | undefined = settingsSchema;
    for (const segment of segments) schema = findChildSchema(schema, segment);
    let table = schema === undefined ? undefined : unwrapSettingSchema(schema);
    while (table instanceof z.ZodPipe) table = unwrapSettingSchema(table.in as z.ZodType);
    const [record, , ...scopeFields] = segments;
    const fields = record === 'scope' ? scopeFields : segments;
    const prefix = fields.filter((segment) => typeof segment === 'string').join('.');
    return table instanceof z.ZodObject
        ? Object.keys(table.shape).map((key) => (prefix === '' ? key : `${prefix}.${key}`))
        : [];
}

function formatUnknownKey(segments: KeyPath, key: string): string {
    const [record, , ...scopeFields] = segments;
    const fields: Readonly<Record<string, readonly string[]>> = RECORD_FIELDS;
    const recordName = [...scopeFields, key].map(String).join('.');
    if (record === 'scope' && Object.hasOwn(fields, recordName))
        return `Write [[${recordName}]] at the root.${fields[recordName]?.includes('paths') === true ? RECORD_PATHS_MESSAGE : ''}`;
    const settingPath = record === 'scope' ? scopeFields : segments;
    const name = [...settingPath.filter((segment) => typeof segment === 'string'), key].join('.');
    const schemaKeys = listSchemaKeys(segments);
    return formatUnknownSetting(name, { available: schemaKeys, offered: new Set(schemaKeys) });
}

function listRemovedSelections(settings: Settings): SettingsError[] {
    const tables = listSettingsTables(settings);
    const errors: SettingsError[] = [];
    for (const { table, path } of tables)
        for (const name of table.configurations)
            if (table.removed_configurations.includes(name))
                errors.push({
                    path: [...path, 'configurations'],
                    message: `${name} is both selected and removed. Keep it in only one list.`,
                });
    return errors;
}

function validateCheckIds(settings: Settings): SettingsError[] {
    const bundledChecks = listCheckIds([]);
    const checks = listCheckIds(Object.values(settings.commandChecks));
    return [
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
    ];
}

/**
Name the invalid setting, and keep the message of the validator.

@param issue the schema validation message.
@param syntax the parsed source keys and their locations.
*/
export function formatSettingsIssue(issue: z.core.$ZodIssue, syntax: TomlSyntax): SettingsError[] {
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
    const emptyPaths = formatEmptyIgnorePaths(issue, segments, syntax);
    if (emptyPaths !== undefined) return [emptyPaths];
    if (issue.code === 'unrecognized_keys')
        return issue.keys.map((key) => ({ path: [...segments, key], message: formatUnknownKey(segments, key) }));
    let schema: z.ZodType | undefined = settingsSchema;
    for (const segment of segments) schema = findChildSchema(schema, segment);
    const message = formatFileValueError(schema, issue, findValueAt(syntax.value, segments));
    return [{ path: segments, message }];
}

/**
Return what makes the configuration lists, tool options, ignores, or paths invalid.

@param settings the parsed gspot.toml.
@param root the folder for checking declared scope paths.
*/
export function validateSettings(settings: Settings, root: string): SettingsError[] {
    const written: WrittenConfiguration[] = [
        ...settings.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...settings.scopes.values().flatMap((scope, scopeIndex) =>
            scope.configurations.map((name, index) => ({
                name,
                path: ['scope', scopeIndex, 'configurations', index],
            })),
        ),
    ];
    const unknown = listUnknownConfigurations(written);
    if (unknown.length > 0) return unknown;
    const scopes = new Map(
        settings.scopes
            .keys()
            .map((scopePath) => [
                scopePath,
                buildAvailableSettings(selectConfigurationsForScope(settings, scopePath), settings.level),
            ]),
    );
    const rootKeys = buildAvailableSettings(selectConfigurationsForScope(settings, ''), settings.level);
    const general = readConfigurations()
        .values()
        .filter((configuration) => configuration.group === 'general')
        .toArray();
    const errors: SettingsError[] = [
        ...listRemovedSelections(settings),
        ...validateSettingReasons(settingsSchema, settings.written, []),
        ...validateSettingRules(settings),
        ...validateSwiftTargets(settings, rootKeys),
        ...validateCheckIds(settings),
        ...validateRuleExcludes(settings.rule_files.exclude),
        ...validateScopePaths(root, settings),
        ...validateRuleFilePaths(root, settings),
        ...validateKeys(rootKeys, settings, scopes, buildAvailableSettings(general, settings.level)),
    ];
    return errors;
}
