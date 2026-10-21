import { GspotError } from '#cli/system/errors.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { limitsSchema } from '#cli/schemas/settings/limits.ts';
import { namingSchema } from '#cli/schemas/settings/naming.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { settingsSchema } from '#cli/schemas/settings/gspot-toml.ts';
import { COMMAND_CHECK_DEFAULTS } from '#cli/config/settings/values.ts';
import { parseTomlText, readSettingsFile } from '#cli/settings/file.ts';
import { type Settings, type SettingsFile } from '#cli/types/settings/values.ts';
import { type TomlTable, type ParsedSettings } from '#cli/types/settings/file.ts';
import { validateSettings, formatSettingsIssue } from '#cli/settings/validation/settings.ts';

/**
 * Parse and validate gspot.toml. Throw a GspotError with every settings error.
 *
 * @param text the gspot.toml contents.
 * @param repositoryRoot the optional folder for validating declared scope paths.
 * @returns the normalized settings.
 */
function parseSettings(text: string, repositoryRoot: string | undefined): Settings {
    const written = parseTomlText(text, SETTINGS_FILE);
    const result = settingsSchema.safeParse(written);
    if (!result.success)
        throw new GspotError('settings', result.error.issues.flatMap((issue) => formatSettingsIssue(issue)).join('\n'));
    const settings = buildSettings(result.data, written);
    validateSettings(settings, repositoryRoot);
    return settings;
}

/**
 * Read gspot.toml from a repository root.
 *
 * @param repositoryRoot the folder that contains gspot.toml.
 * @returns the settings and the file text.
 */
function readSettings(repositoryRoot: string): SettingsFile {
    const { text } = readSettingsFile(repositoryRoot);
    return { settings: parseSettings(text, repositoryRoot), text };
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
                    files: { ...structuredClone(COMMAND_CHECK_DEFAULTS.files), paths },
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
            stripUndefined({ ...scope, written: writtenScopes[index] as TomlTable }),
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
