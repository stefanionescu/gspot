import { GspotError } from '#cli/system/errors.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { limitsSchema } from '#cli/settings/schema/limits.ts';
import { namingSchema } from '#cli/settings/schema/naming.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { parseTomlText, readSettingsFile } from '#cli/settings/file.ts';
import { architectureSchema } from '#cli/settings/schema/architecture.ts';
import { type Settings, type SettingsFile } from '#cli/types/settings/values.ts';
import { type TomlTable, type ParsedSettings } from '#cli/types/settings/file.ts';
import { SCOPE_EMPTY_RECORDS, COMMAND_CHECK_DEFAULTS } from '#cli/config/settings/values.ts';

import {
    throwErrors,
    collectErrors,
    formatSettingsIssue,
    unknownConfigurationErrors,
} from '#cli/settings/validation/settings.ts';

/**
 * Parse and validate gspot.toml. Throw a GspotError with every settings error.
 *
 * @param text the file's text.
 * @param root the repository root, to check scopes against the file system.
 * @param reads the read cache for this run.
 * @returns the normalized settings.
 */
function parseSettings(text: string, root?: string, reads = createReadCache(root ?? process.cwd())): Settings {
    const written = parseTomlText(text, SETTINGS_FILE, 'settings');
    const result = settingsSchema.safeParse(written);
    if (!result.success)
        throw new GspotError(
            'settings',
            result.error.issues.flatMap((issue) => formatSettingsIssue(SETTINGS_FILE, issue)).join('\n'),
        );
    const settings = buildSettings(result.data, written);
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
function readSettings(root: string, reads = createReadCache(root)): SettingsFile {
    const { text } = readSettingsFile(root);
    const settings = parseSettings(text, root, reads);
    return { settings, text };
}

function normalizeScopeTables(
    parsed: NonNullable<ParsedSettings['scope']>[number],
    written: TomlTable,
): Settings['scopeTables'][string] {
    const { architecture, tools, naming, coverage, docs, licenses, site, ...table } = parsed;
    const normalized = Object.fromEntries(
        SCOPE_EMPTY_RECORDS.flatMap(([name, field]) => {
            const value = { naming, coverage, docs, licenses, site }[name];
            return value === undefined ? [] : [[name, { ...value, [field]: [] }]];
        }),
    );
    const normalizedTools =
        tools === undefined
            ? undefined
            : stripUndefined({
                  ...tools,
                  eslint: tools.eslint === undefined ? undefined : { ...tools.eslint, override: [] },
              });
    return stripUndefined({
        ...table,
        ...normalized,
        written,
        architecture: architecture === undefined ? undefined : normalizeArchitecture({ ...architecture, module: [] }),
        tools: normalizedTools,
    });
}

/**
 * Fills the architecture table's lists and keeps its optional keys only when written.
 * @param written the table as written, if any
 * @returns the architecture configuration
 */
function normalizeArchitecture(written: ParsedSettings['architecture']): Settings['architecture'] {
    return {
        module: written?.module ?? [],
        roles: written?.roles ?? architectureSchema.shape.roles.parse(undefined),
    };
}

function normalizeCommandChecks(checks: ParsedSettings['command_check']): Settings['check'] {
    return Object.fromEntries(
        (checks ?? []).map((entry) => {
            const name = entry.name;
            const { paths, ...definition } = stripUndefined(entry);
            return [
                name,
                {
                    ...definition,
                    name,
                    ...COMMAND_CHECK_DEFAULTS,
                    summary: entry.summary ?? `Runs the repository's own check ${name}.`,
                    why: 'The repository declared this command in gspot.toml as part of its gate.',
                    help: entry.help ?? 'Read the command output; this repository declares the check.',
                    files: {
                        ...COMMAND_CHECK_DEFAULTS.files,
                        extensions: [...COMMAND_CHECK_DEFAULTS.files.extensions],
                        filenames: [...COMMAND_CHECK_DEFAULTS.files.filenames],
                        tags: [...COMMAND_CHECK_DEFAULTS.files.tags],
                        paths,
                        kinds: [...COMMAND_CHECK_DEFAULTS.files.kinds],
                    },
                },
            ];
        }),
    );
}

/**
 * Build the settings values from the parsed document.
 * @param parsed the validated document
 * @param written the raw authored table
 * @returns the settings
 */
function buildSettings(parsed: ParsedSettings, written: TomlTable): Settings {
    const { command_check: commandChecks, ...document } = parsed;
    const tables = stripUndefined({
        rules: parsed.rules,
        hooks: parsed.hooks,
        ci: parsed.ci,
    });
    const writtenScopes = (written['scope'] ?? []) as TomlTable[];
    const scopes = (parsed.scope ?? []).map((scope) => [scope.path, scope] as const);
    const scopeTables = Object.fromEntries(
        scopes.map(([path, scope], index) => [
            trimTrailingSlashes(path),
            normalizeScopeTables(scope, writtenScopes[index] as TomlTable),
        ]),
    );
    return {
        ...stripUndefined(document),
        written,
        level: parsed.level,
        configurations: parsed.configurations,
        scope: Object.fromEntries(
            scopes.map(([path, scope]) => [
                trimTrailingSlashes(path),
                {
                    configurations: scope.configurations,
                    removed_configurations: scope.removed_configurations,
                },
            ]),
        ),
        removed_configurations: parsed.removed_configurations,
        limits: parsed.limits ?? limitsSchema.parse({}),
        naming: parsed.naming ?? namingSchema.parse({}),
        architecture: normalizeArchitecture(parsed.architecture),
        structure: {
            reexports: settingsSchema.shape.structure.unwrap().shape.reexports.parse(parsed.structure?.reexports),
        },
        format: stripUndefined({ ...parsed.format }),
        allowed_words: parsed.allowed_words,
        tools: stripUndefined({ ...parsed.tools }),
        test_files: parsed.test_files,
        ignore: (parsed.ignore ?? []).map((entry) => stripUndefined(entry)),
        check: normalizeCommandChecks(commandChecks),

        ...tables,
        scopeTables,
    };
}

export { readSettings, parseSettings };
