import type { z } from 'zod';
import { isRecord } from '#cli/system/values.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { type Settings } from '#cli/types/settings/values.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { type SettingsError } from '#cli/types/settings/file.ts';
import { GspotError, formatZodIssue } from '#cli/system/errors.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { listUnknownConfigurations } from '#cli/configurations/select.ts';
import { validateSettingReasons } from '#cli/settings/validation/reasons.ts';
import type { ConfigurationDeclaration } from '#cli/types/configurations.ts';
import { RECORD_FIELDS, SETTINGS_REFERENCE_URL } from '#cli/config/settings/file.ts';
import { listCheckIds, readManifests, formatUnknownCheck } from '#cli/configurations/manifests.ts';
import { validateScopePaths, validateExtraOptions, validateDisabledRules } from '#cli/settings/validation/values.ts';

function formatNestedSettingsIssues(
    path: string,
    prefix: z.core.$ZodIssue['path'],
    issues: z.core.$ZodIssue[],
): string[] {
    return issues.flatMap((issue) => formatSettingsIssue(path, { ...issue, path: [...prefix, ...issue.path] }));
}

/**
 * Format a validation issue with the settings file and its declaration path.
 * @param path the settings file path.
 * @param issue the schema issue with its setting path.
 * @returns one diagnostic for each invalid setting.
 */
function formatSettingsIssue(path: string, issue: z.core.$ZodIssue): string[] {
    const branches = issue.code === 'invalid_union' ? issue.errors : [];
    const reasonedValueErrors = branches.find((errors) =>
        errors.some((child) => child.path[0] === 'value' || child.path[0] === 'reason'),
    );
    if (reasonedValueErrors !== undefined) return formatNestedSettingsIssues(path, issue.path, reasonedValueErrors);
    if (issue.code === 'invalid_key') return formatNestedSettingsIssues(path, issue.path, issue.issues);
    const segments = issue.path.filter((part): part is KeyPath[number] => typeof part !== 'symbol');
    if (issue.code !== 'unrecognized_keys') return formatZodIssue(issue).map((line) => `${path}: ${line}`);
    const [record, scopeIndex, ...scopeFields] = segments;
    let where = segments.length === 0 ? 'the top level' : `[${segments.map(String).join('.')}]`;
    if (record === 'scope') {
        const section = scopeFields.length === 0 ? '' : ` [${scopeFields.map(String).join('.')}]`;
        where = `[[scope]] record ${String(Number(scopeIndex) + 1)}${section}`;
    }
    return issue.keys.map((key) => {
        const record = [...scopeFields, key].map(String).join('.');
        const fields: Readonly<Record<string, readonly string[]>> = RECORD_FIELDS;
        if (segments[0] === 'scope' && Object.hasOwn(fields, record))
            return `${path}: Write [[${record}]] at the root.${fields[record]?.includes('paths') === true ? ' Its paths say where it applies.' : ''}`;
        return `${path}: ${where}: \`${key}\` is not a gspot.toml setting. See ${SETTINGS_REFERENCE_URL} for every key.`;
    });
}

/**
 * Reject invalid settings with their file and key paths.
 * @param errors the settings errors to print.
 */
function throwErrors(errors: SettingsError[]): never {
    throw new GspotError('settings', errors.map((error) => formatSettingsError(error, SETTINGS_FILE)).join('\n'));
}

// Commands and check execution validate the same settings.
/**
 * Collect selection, scope, and tool-setting errors through the shared validation path.
 * @param settings the parsed settings.
 * @param root the repository root when this run checks file paths.
 * @param reads the file reads for this validation run.
 * @returns the errors with their setting paths.
 */
function collectErrors(settings: Settings, root: string | undefined, reads: ReadCache): SettingsError[] {
    return [
        ...validateSettingReasons(settings),
        ...(Array.isArray(settings.written['command_check']) ? settings.written['command_check'] : []).flatMap(
            (entry, index) =>
                isRecord(entry) && typeof entry['name'] === 'string' && listCheckIds([], reads).includes(entry['name'])
                    ? [
                          {
                              path: ['command_check', index, 'name'],
                              message: `The command check ${entry['name']} has the same name as a configuration check. Give it another name.`,
                          },
                      ]
                    : [],
        ),
        ...settings.ignore.flatMap((entry, index) => {
            const checks = listCheckIds(Object.values(settings.check), reads);
            return checks.includes(entry.check)
                ? []
                : [
                      {
                          path: ['ignore', index, 'check'],
                          message: formatUnknownCheck(entry.check, checks),
                      },
                  ];
        }),
        ...validateDisabledRules(settings, reads),
        ...(root === undefined ? [] : validateScopePaths(root, settings)),
        ...settingErrors(settings, reads),
    ];
}

/**
 * The configuration names the settings select that no manifest defines, each at its declaration.
 * @param settings the parsed settings.
 * @param reads the read cache for this run.
 * @returns one error per unknown name.
 */
function unknownConfigurationErrors(settings: Settings, reads: ReadCache): SettingsError[] {
    const manifests = readManifests(reads);
    const declarations: ConfigurationDeclaration[] = [
        ...settings.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...Object.entries(settings.scope).flatMap(([, scope], scopeIndex) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', scopeIndex, 'configurations', index] })),
        ),
    ];
    return listUnknownConfigurations(declarations, manifests).map(({ path, message }) => ({
        path,
        message,
    }));
}

/**
 * Every error the selection and the known settings find in a settings whose configuration names all exist.
 * @param settings the parsed settings.
 * @param reads the read cache for this run.
 * @returns the errors, each at the value that raised it.
 */
function settingErrors(settings: Settings, reads: ReadCache): SettingsError[] {
    const manifests = readManifests(reads);
    const errors: SettingsError[] = [];
    const tools = listDistinctTools([...manifests.values()]);
    for (const { table, path } of listSettingsTables(settings))
        errors.push(
            ...validateExtraOptions(table, tools).map((error) => ({ ...error, path: [...path, ...error.path] })),
        );
    const rootSelected = selectForScope(settings, '', manifests);
    // Each scope table uses the settings of its selected configurations, including the root configurations.
    const scopeKnown = new Map(
        Object.keys(settings.scope).map((scope) => [
            scope,
            buildKnownSettings(selectForScope(settings, scope, manifests), settings.level, reads),
        ]),
    );
    errors.push(
        ...validateKeys(
            buildKnownSettings(rootSelected, settings.level, reads),
            settings,
            scopeKnown,
            buildKnownSettings([...manifests.values()], settings.level, reads),
        ),
    );
    return errors;
}

/**
 * A settings error as text that leads with its file, when given, and the key path it names.
 * @param error the error.
 * @param file the settings file, for a line that names it.
 * @returns the text.
 */
function formatSettingsError(error: SettingsError, file?: string): string {
    const where = error.path.map(String).join('.');
    const place = [file, where].filter((part) => part !== undefined && part !== '');
    return [...place, error.message].join(': ');
}

export { throwErrors, collectErrors, formatSettingsIssue, unknownConfigurationErrors };
