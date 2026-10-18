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
import { formatCodeList, formatUnknownName } from '#cli/system/text.ts';
import { listUnknownConfigurations } from '#cli/configurations/select.ts';
import { validateSettingReasons } from '#cli/settings/validation/reasons.ts';
import type { ConfigurationDeclaration } from '#cli/types/configurations.ts';
import { listCheckIds, readManifests } from '#cli/configurations/manifests.ts';
import { LIMITS_DECLARATIONS } from '#cli/config/settings/limits-declarations.ts';
import { type Settings, type KnownSettings } from '#cli/types/settings/values.ts';
import { RECORD_FIELDS, SETTINGS_REFERENCE_URL } from '#cli/config/settings/file.ts';
import { validateScopePaths, validateExtraOptions, validateDisabledRules } from '#cli/settings/validation/values.ts';

// The limit fields that some code reads for one language.
function listLanguageLimits(language: string): string[] {
    return Object.entries(LIMITS_DECLARATIONS).flatMap(([key, declaration]) =>
        'languages' in declaration && (declaration.languages as readonly string[]).includes(language)
            ? [key.slice(key.indexOf('.') + 1)]
            : [],
    );
}

/**
 * Name the invalid setting, and keep the message of the validator.
 * @param issue the schema validation message.
 * @returns the setting path and its validation failure, each line after the gspot.toml name.
 */
function formatSettingsIssue(issue: z.core.$ZodIssue): string[] {
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
    const segments = issue.path.filter((part): part is KeyPath[number] => typeof part !== 'symbol');
    if (issue.code !== 'unrecognized_keys') return formatZodIssue(issue).map((line) => `${SETTINGS_FILE}: ${line}`);
    return issue.keys.map((key) => `${SETTINGS_FILE}: ${formatUnknownKey(segments, key)}`);
}

// Name one key that a table does not accept. Say where it belongs, or which keys the table has.
function formatUnknownKey(segments: KeyPath, key: string): string {
    const [record, , ...scopeFields] = segments;
    const [table, language] = record === 'scope' ? scopeFields : segments;
    if (table === 'limits' && typeof language === 'string')
        return `\`limits.${language}.${key}\` is not a limit any check reads. The limits that ${language} reads are ${formatCodeList(listLanguageLimits(language))}.`;
    const fields: Readonly<Record<string, readonly string[]>> = RECORD_FIELDS;
    const recordName = [...scopeFields, key].map(String).join('.');
    if (record === 'scope' && Object.hasOwn(fields, recordName))
        return `Write [[${recordName}]] at the root.${fields[recordName]?.includes('paths') === true ? ' Its paths say where it applies.' : ''}`;
    return `${describeKeyPlace(segments)}: \`${key}\` is not a gspot.toml setting. See ${SETTINGS_REFERENCE_URL} for every key.`;
}

function describeKeyPlace(segments: KeyPath): string {
    const [record, scopeIndex, ...scopeFields] = segments;
    if (record !== 'scope') return segments.length === 0 ? 'the top level' : `[${segments.map(String).join('.')}]`;
    const section = scopeFields.length === 0 ? '' : ` [${scopeFields.map(String).join('.')}]`;
    return `[[scope]] record ${String(Number(scopeIndex) + 1)}${section}`;
}

// Each error names gspot.toml, then its key path when it has one.
function throwErrors(errors: SettingsError[]): never {
    const lines = errors.map((error) =>
        [SETTINGS_FILE, error.path.map(String).join('.'), error.message].filter((part) => part !== '').join(': '),
    );
    throw new GspotError('settings', lines.join('\n'));
}

/**
 * Validate written selections, tool options, ignores, and paths before a command uses them.
 * @param settings the parsed gspot.toml.
 * @param repositoryRoot the optional folder for checking declared scope paths.
 * @param reads the run cache.
 */
function validateSettings(settings: Settings, repositoryRoot: string | undefined, reads: ReadCache): void {
    const manifests = readManifests(reads);
    const declarations: ConfigurationDeclaration[] = [
        ...settings.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...Object.values(settings.scopes).flatMap((scope, scopeIndex) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', scopeIndex, 'configurations', index] })),
        ),
    ];
    const unknown = listUnknownConfigurations(declarations, manifests);
    if (unknown.length > 0) throwErrors(unknown);
    const tools = listDistinctTools([...manifests.values()]);
    const bundledChecks = listCheckIds([], reads);
    const checks = listCheckIds(Object.values(settings.commandChecks), reads);
    const knownBySelection = new Map<string, KnownSettings>();
    const scopes = new Map(
        ['', ...Object.keys(settings.scopes)].map((scope) => {
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
        ...Object.values(settings.commandChecks).flatMap((entry, index) =>
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
                : [{ path: ['ignore', index, 'check'], message: formatUnknownName('check', entry.check, checks) }],
        ),
        ...validateDisabledRules(settings, manifests),
        ...(repositoryRoot === undefined ? [] : validateScopePaths(repositoryRoot, settings)),
        ...listSettingsTables(settings).flatMap(({ table, path }) =>
            validateExtraOptions(table, tools).map((error) => ({ ...error, path: [...path, ...error.path] })),
        ),
        ...validateKeys(known, settings, scopes, buildKnownSettings([...manifests.values()], settings.level, reads)),
    ];
    if (errors.length > 0) throwErrors(errors);
}

export { validateSettings, formatSettingsIssue };
