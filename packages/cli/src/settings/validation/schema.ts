import { z } from 'zod';
import { findValueAt } from '#cli/system/tables.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { formatSimilarNames } from '#cli/system/text.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import type { TomlSyntax } from '#cli/types/parsers/formats.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import type { WrittenConfiguration } from '#cli/types/manifests.ts';
import { listUnknownConfigurations } from '#cli/manifests/select.ts';
import { NO_CHECK_PATHS_MESSAGE } from '#cli/config/settings/settings.ts';
import { RECORD_PATHS_MESSAGE } from '#cli/config/settings/validation.ts';
import { listCheckIds, readConfigurations } from '#cli/manifests/read.ts';
import { formatFileValueError } from '#cli/settings/validation/messages.ts';
import { validateSettingReasons } from '#cli/settings/validation/reasons.ts';
import type { Settings, SettingsError } from '#cli/types/settings/settings.ts';
import { validateKeys, formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { RECORD_FIELDS, findChildSchema, unwrapSettingSchema } from '#cli/settings/lookup.ts';

import {
    validateScopePaths,
    validateRuleExcludes,
    validateSettingRules,
    validateSwiftTargets,
    validateRuleFilePaths,
} from '#cli/settings/validation/references.ts';

function formatEmptyIgnorePaths(issue: z.core.$ZodIssue, path: KeyPath, syntax: TomlSyntax): SettingsError | undefined {
    const [record, index, field] = path;
    if (issue.code !== 'too_small' || record !== 'ignore' || field !== 'paths' || index === undefined) return undefined;
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
    const table = schema === undefined ? undefined : unwrapSettingSchema(schema);
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
    return formatUnknownSetting(name, listSchemaKeys(segments));
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
Refuse invalid configuration lists, tool options, ignores, and paths.

@param settings the parsed gspot.toml.
@param root the folder for checking declared scope paths.
*/
export function assertSettings(settings: Settings, root: string): SettingsError[] {
    const configurationsByName = readConfigurations();
    const written: WrittenConfiguration[] = [
        ...settings.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...[...settings.scopes.values()].flatMap((scope, scopeIndex) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', scopeIndex, 'configurations', index] })),
        ),
    ];
    const unknown = listUnknownConfigurations(written, configurationsByName);
    if (unknown.length > 0) return unknown;
    const bundledChecks = listCheckIds([]);
    const checks = listCheckIds(Object.values(settings.commandChecks));
    const scopes = new Map(
        [...settings.scopes.keys()].map((scope) => [
            scope,
            buildAvailableSettings(selectForScope(settings, scope, configurationsByName), settings.level),
        ]),
    );
    const rootKeys = buildAvailableSettings(selectForScope(settings, '', configurationsByName), settings.level);
    const general = configurationsByName
        .values()
        .filter((configuration) => configuration.group === 'general')
        .toArray();
    const errors: SettingsError[] = [
        ...listRemovedSelections(settings),
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
        ...validateRuleExcludes(settings.rules.exclude, configurationsByName),
        ...validateScopePaths(root, settings),
        ...validateRuleFilePaths(root, settings),
        ...validateKeys(rootKeys, settings, scopes, buildAvailableSettings(general, settings.level)),
    ];
    return errors;
}
