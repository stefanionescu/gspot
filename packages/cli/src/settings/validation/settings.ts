import type { z } from 'zod';
import { buildKnownSettings } from '#cli/settings/known.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { listSettingsTables } from '#cli/settings/inherit.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import { type SettingsError } from '#cli/types/settings/file.ts';
import { GspotError, formatZodIssue } from '#cli/system/errors.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { listUnknownConfigurations } from '#cli/configurations/select.ts';
import { validateSettingReasons } from '#cli/settings/validation/reasons.ts';
import type { ConfigurationDeclaration } from '#cli/types/configurations.ts';
import { type Settings, type KnownSettings } from '#cli/types/settings/values.ts';
import { RECORD_FIELDS, SETTINGS_REFERENCE_URL } from '#cli/config/settings/file.ts';
import { listCheckIds, readManifests, formatUnknownCheck } from '#cli/configurations/manifests.ts';
import { validateScopePaths, validateExtraOptions, validateDisabledRules } from '#cli/settings/validation/values.ts';

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
    if (reasonedValueErrors !== undefined)
        return reasonedValueErrors.flatMap((child) =>
            formatSettingsIssue(path, { ...child, path: [...issue.path, ...child.path] }),
        );
    if (issue.code === 'invalid_key')
        return issue.issues.flatMap((child) =>
            formatSettingsIssue(path, { ...child, path: [...issue.path, ...child.path] }),
        );
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
function validateSettings(settings: Settings, root: string | undefined, reads: ReadCache): void {
    const manifests = readManifests(reads);
    const declarations: ConfigurationDeclaration[] = [
        ...settings.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...Object.values(settings.scope).flatMap((scope, scopeIndex) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', scopeIndex, 'configurations', index] })),
        ),
    ];
    const unknown = listUnknownConfigurations(declarations, manifests);
    if (unknown.length > 0) throwErrors(unknown);
    const tools = listDistinctTools([...manifests.values()]);
    const bundledChecks = listCheckIds([], reads);
    const checks = listCheckIds(Object.values(settings.check), reads);
    const knownBySelection = new Map<string, KnownSettings>();
    const scopes = new Map(
        ['', ...Object.keys(settings.scope)].map((scope) => {
            const selected = selectForScope(settings, scope, manifests);
            const key = JSON.stringify(selected.map((manifest) => manifest.configuration.name));
            let known = knownBySelection.get(key);
            if (known === undefined) {
                known = buildKnownSettings(selected, settings.level, reads);
                knownBySelection.set(key, known);
            }
            return [scope, known];
        }),
    );
    const known = scopes.get('') as KnownSettings;
    scopes.delete('');
    const errors: SettingsError[] = [
        ...validateSettingReasons(settings),
        ...Object.values(settings.check).flatMap((entry, index) =>
            bundledChecks.includes(entry.name)
                ? [
                      {
                          path: ['command_check', index, 'name'],
                          message: `The command check ${entry.name} has the same name as a configuration check. Give it another name.`,
                      },
                  ]
                : [],
        ),
        ...settings.ignore.flatMap((entry, index) =>
            checks.includes(entry.check)
                ? []
                : [{ path: ['ignore', index, 'check'], message: formatUnknownCheck(entry.check, checks) }],
        ),
        ...validateDisabledRules(settings, manifests),
        ...(root === undefined ? [] : validateScopePaths(root, settings)),
        ...listSettingsTables(settings).flatMap(({ table, path }) =>
            validateExtraOptions(table, tools).map((error) => ({ ...error, path: [...path, ...error.path] })),
        ),
        ...validateKeys(known, settings, scopes, buildKnownSettings([...manifests.values()], settings.level, reads)),
    ];
    if (errors.length > 0) throwErrors(errors);
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

export { validateSettings, formatSettingsIssue };
