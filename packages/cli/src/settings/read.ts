import type { z } from 'zod';
import { isRecord } from '#cli/system/values.ts';
import { GspotError } from '#cli/system/errors.ts';
import { everyTable } from '#cli/settings/inherit.ts';
import { knownSettings } from '#cli/settings/view.ts';
import { buildSettings } from '#cli/settings/normalize.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { reasonErrors } from '#cli/settings/errors/reasons.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { parseTomlText, readSettingsFile } from '#cli/settings/file.ts';
import { listUnknownConfigurations } from '#cli/configurations/select.ts';
import { validateAgainstKnownSettings } from '#cli/settings/errors/keys.ts';
import type { Settings, SettingsFile } from '#cli/types/settings/values.ts';
import type { ConfigurationDeclaration } from '#cli/types/configurations.ts';
import type { WrittenScope, SettingsError } from '#cli/types/settings/file.ts';
import { RECORD_FIELDS, SETTINGS_REFERENCE_URL } from '#cli/config/settings/file.ts';
import { listCheckIds, readManifests, formatUnknownCheck } from '#cli/configurations/manifests.ts';
import { pathErrors, extraOptionErrors, disabledRuleErrors } from '#cli/settings/errors/values.ts';

function nestedIssueLines(path: string, prefix: z.core.$ZodIssue['path'], issues: z.core.$ZodIssue[]): string[] {
    return issues.flatMap((issue) => issueLines(path, { ...issue, path: [...prefix, ...issue.path] }));
}

function issueLines(path: string, issue: z.core.$ZodIssue): string[] {
    const branches = issue.code === 'invalid_union' ? issue.errors : [];
    const envelope = branches.find((errors) =>
        errors.some((child) => child.path[0] === 'value' || child.path[0] === 'reason'),
    );
    if (envelope !== undefined) return nestedIssueLines(path, issue.path, envelope);
    if (issue.code === 'invalid_key') return nestedIssueLines(path, issue.path, issue.issues);
    const segments = issue.path.filter((part): part is KeyPath[number] => typeof part !== 'symbol');
    if (issue.code !== 'unrecognized_keys') return [errorText({ path: segments, message: issue.message }, path)];
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

function throwErrors(errors: SettingsError[]): never {
    throw new GspotError('settings', errors.map((error) => errorText(error, SETTINGS_FILE)).join('\n'));
}

// Commands and check execution validate the same settings.
function collectErrors(settings: Settings, root: string | undefined, reads?: ReadCache): SettingsError[] {
    return [
        ...reasonErrors(settings),
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
        ...disabledRuleErrors(settings),
        ...(root === undefined ? [] : pathErrors(root, settings)),
        ...settingErrors(settings, reads),
    ];
}

/**
 * The configuration names the settings select that no manifest defines, each at its declaration.
 * @param settings the parsed settings.
 * @param reads the read cache for this run.
 * @returns one error per unknown name.
 */
function unknownConfigurationErrors(settings: Settings, reads?: ReadCache): SettingsError[] {
    const manifests = readManifests(reads);
    const declarations: ConfigurationDeclaration[] = [
        ...settings.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...Object.entries(settings.scope).flatMap(([, scope], scopeIndex) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', scopeIndex, 'configurations', index] })),
        ),
    ];
    return listUnknownConfigurations(declarations, manifests).map(({ path, message: diagnostic }) => ({
        path,
        message: diagnostic,
    }));
}

/**
 * Every error the selection and the known settings find in a settings whose configuration names all exist.
 * @param settings the parsed settings.
 * @param reads the read cache for this run.
 * @returns the errors, each at the value that raised it.
 */
function settingErrors(settings: Settings, reads?: ReadCache): SettingsError[] {
    const manifests = readManifests(reads);
    const errors: SettingsError[] = [];
    const tools = listDistinctTools([...manifests.values()]);
    for (const { table, path } of everyTable(settings))
        errors.push(...extraOptionErrors(table, tools).map((error) => ({ ...error, path: [...path, ...error.path] })));
    const rootSelected = selectForScope(settings, '', manifests);
    // Each scope table uses the settings of its selected configurations, including the root configurations.
    const scopeKnown = new Map(
        Object.keys(settings.scope).map((scope) => [
            scope,
            knownSettings(selectForScope(settings, scope, manifests), settings.level, reads),
        ]),
    );
    errors.push(
        ...validateAgainstKnownSettings(
            knownSettings(rootSelected, settings.level, reads),
            settings,
            scopeKnown,
            knownSettings([...manifests.values()], settings.level, reads),
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
function errorText(error: SettingsError, file?: string): string {
    const where = error.path.map(String).join('.');
    const place = [file, where].filter((part) => part !== undefined && part !== '');
    return [...place, error.message].join(': ');
}

/**
 * Parse and validate gspot.toml. Throw a GspotError with every settings error.
 *
 * @param text the file's text.
 * @param root the repository root, to check scopes against the file system.
 * @param reads the read cache for this run.
 * @returns the normalized settings.
 */
export function parseSettings(text: string, root?: string, reads?: ReadCache): Settings {
    const written = parseTomlText(text, SETTINGS_FILE, 'settings');
    const result = settingsSchema.safeParse(written);
    if (!result.success)
        throw new GspotError(
            'settings',
            result.error.issues.flatMap((issue) => issueLines(SETTINGS_FILE, issue)).join('\n'),
        );
    const settings = buildSettings(result.data);
    settings.written = written;
    const scopes = written['scope'] as WrittenScope[] | undefined;
    for (const entry of scopes ?? []) {
        const scope = settings.scopeTables[trimTrailingSlashes(entry.path)] as Settings['scopeTables'][string];
        scope.written = entry;
    }
    const unknown = unknownConfigurationErrors(settings, reads);
    if (unknown.length > 0) throwErrors(unknown);
    const errors = collectErrors(settings, root, reads);
    if (errors.length > 0) throwErrors(errors);
    return settings;
}

/**
 * Reads gspot.toml from a repository root.
 * @param root the repository root.
 * @param reads the read cache for this run.
 * @returns the settings and the file's text.
 */
export function readSettings(root: string, reads?: ReadCache): SettingsFile {
    const { text } = readSettingsFile(root);
    const settings = parseSettings(text, root, reads);
    return { settings, text };
}
