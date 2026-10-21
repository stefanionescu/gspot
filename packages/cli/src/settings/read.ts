import { GspotError } from '#cli/system/errors.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { limitsSchema } from '#cli/settings/schema/limits.ts';
import { namingSchema } from '#cli/settings/schema/naming.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { readVersionPin } from '#cli/repository/version-pin.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { isRecord, stripUndefined } from '#cli/system/values.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { parseTomlText, readSettingsFile } from '#cli/settings/file.ts';
import { type Settings, type SettingsFile } from '#cli/types/settings/values.ts';
import { type TomlTable, type ParsedSettings } from '#cli/types/settings/file.ts';
import { SCOPE_EMPTY_RECORDS, COMMAND_CHECK_DEFAULTS } from '#cli/config/settings/values.ts';
import { validateSettings, formatSettingsIssue } from '#cli/settings/validation/settings.ts';

/**
 * Parse and validate gspot.toml. Throw a GspotError with every settings error.
 *
 * @param text the gspot.toml contents.
 * @param repositoryRoot the optional folder for validating declared scope paths.
 * @param reads the run cache.
 * @returns the normalized settings.
 */
function parseSettings(text: string, repositoryRoot: string | undefined, reads: ReadCache): Settings {
    const written = parseTomlText(text, SETTINGS_FILE, 'settings');
    const words = written['allowed_words'];
    if (isRecord(words) && Array.isArray(words['value']))
        throw new GspotError(
            'settings',
            `${SETTINGS_FILE}: allowed_words: Write allowed_words as a table of word = reason, such as allowed_words = { Nebulix = "The product name." }.`,
        );
    const result = settingsSchema.safeParse(written);
    if (!result.success)
        throw new GspotError('settings', result.error.issues.flatMap((issue) => formatSettingsIssue(issue)).join('\n'));
    const settings = buildSettings(result.data, written);
    validateSettings(settings, repositoryRoot, reads);
    return settings;
}

/**
 * Read gspot.toml from a repository root. When the repository last ran another gspot version, a refusal names both
 * versions.
 *
 * @param repositoryRoot the folder that contains gspot.toml.
 * @param reads the run cache.
 * @returns the settings and the file text.
 */
function readSettings(repositoryRoot: string, reads: ReadCache): SettingsFile {
    const { text } = readSettingsFile(repositoryRoot);
    try {
        return { settings: parseSettings(text, repositoryRoot, reads), text };
    } catch (error) {
        const pinned = readVersionPin(repositoryRoot);
        const { version } = packageManifest;
        if (!(error instanceof GspotError) || error.code !== 'settings' || pinned === undefined || pinned === version)
            throw error;
        throw new GspotError(
            'settings',
            `${error.message}\nThis repository last ran gspot ${pinned}, and this run uses ${version}.`,
        );
    }
}

function normalizeScopeTables(
    parsed: NonNullable<ParsedSettings['scope']>[number],
    written: TomlTable,
): Settings['scopes'][string] {
    const { tools, naming, coverage, docs, licenses, site, ...table } = parsed;
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
        tools: normalizedTools,
    });
}

function normalizeCommandChecks(checks: ParsedSettings['command_check']): Settings['commandChecks'] {
    return Object.fromEntries(
        (checks ?? []).map((entry) => {
            const name = entry.name;
            const { paths, outputs, ...definition } = stripUndefined(entry);
            return [
                name,
                {
                    ...definition,
                    ...(outputs === undefined
                        ? {}
                        : { generator_outputs: outputs.map((path) => ({ kind: 'path' as const, path })) }),
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
 *
 * @param parsed the validated document.
 * @param written the raw authored table.
 * @returns normalized tables that keep the defaults and the authored scope values.
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
        removed_configurations: parsed.removed_configurations,
        limits: parsed.limits ?? limitsSchema.parse({}),
        naming: parsed.naming ?? namingSchema.parse({}),
        import_rule: parsed.import_rule,
        structure: settingsSchema.shape.structure.unwrap().prefault({}).parse(parsed.structure),
        format: stripUndefined({ ...parsed.format }),
        allowed_words: parsed.allowed_words,
        tools: stripUndefined({ ...parsed.tools }),
        test_files: parsed.test_files,
        ignore: (parsed.ignore ?? []).map((entry) => stripUndefined(entry)),
        commandChecks: normalizeCommandChecks(commandChecks),

        ...tables,
        scopes: scopeTables,
    };
}

export { readSettings, parseSettings, buildSettings };
