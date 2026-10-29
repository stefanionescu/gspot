import { GspotError } from '#cli/system/errors.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { formatSettingsError } from '#cli/settings/validation/messages.ts';
import { parseTomlFile, parseTomlSyntax } from '#cli/parsers/formats/toml.ts';
import { assertSettings, formatSettingsIssue } from '#cli/settings/validation/schema.ts';
import type { Settings, TomlTable, SettingsError, ParsedSettings } from '#cli/types/settings/file.ts';
import { COMMAND_CHECK_WHY, COMMAND_CHECK_HELP, COMMAND_CHECK_DEFAULTS } from '#cli/config/settings/read.ts';

/**
Parse gspot.toml and return its validated settings or field errors.

@param text the gspot.toml contents.
@param root the folder for validating declared scope paths.
*/
export function parseSettings(text: string, root: string): Settings | SettingsError[] {
    const written = parseTomlFile(SETTINGS_FILE, text);
    const syntax = parseTomlSyntax(text, written);
    const result = settingsSchema.safeParse(written);
    let parsed: Settings | SettingsError[];
    if (result.success) {
        const settings = buildSettings(result.data, written);
        const errors = assertSettings(settings, root);
        parsed = errors.length === 0 ? settings : errors;
    } else parsed = result.error.issues.flatMap((issue) => formatSettingsIssue(issue, syntax));
    return parsed;
}

/**
Read settings and report every invalid field at its source line.

@param text the settings file contents.
@param root the repository root.
@returns validated settings.
*/
export function readSettings(text: string, root: string): Settings {
    const result = parseSettings(text, root);
    if (!Array.isArray(result)) return result;
    const syntax = parseTomlSyntax(text, parseTomlFile(SETTINGS_FILE, text));
    throw new GspotError(
        'settings',
        result.map((error) => formatSettingsError(error, syntax, SETTINGS_FILE)).join('\n'),
    );
}

function normalizeCommandChecks(checks: ParsedSettings['command_check']): Settings['commandChecks'] {
    return Object.fromEntries(
        (checks ?? []).map((commandCheck) => {
            const id = commandCheck.id;
            const { paths, outputs, ...definition } = stripUndefined(commandCheck);
            return [
                id,
                {
                    ...definition,
                    ...(outputs !== undefined && {
                        generator_outputs: outputs.map((path) => ({ kind: 'path' as const, path })),
                    }),
                    id,
                    ...COMMAND_CHECK_DEFAULTS,
                    summary: commandCheck.summary ?? `Runs the repository's own check ${id}.`,
                    why: COMMAND_CHECK_WHY,
                    help: commandCheck.help ?? COMMAND_CHECK_HELP,
                    files: { ...structuredClone(COMMAND_CHECK_DEFAULTS.files), paths },
                },
            ];
        }),
    );
}

/**
Normalize the validated document: fill the table defaults, key the scopes by path, and turn each [[command_check]]
into a check.

@param parsed the validated document.
@param written the table as written in gspot.toml.
@returns normalized tables that keep the defaults and the scope values as written.
*/
export function buildSettings(parsed: ParsedSettings, written: TomlTable): Settings {
    const { command_check: commandChecks, scope: scopes = [], ...document } = parsed;
    const writtenScopes = (written['scope'] ?? []) as TomlTable[];
    return {
        ...stripUndefined(document),
        written,
        format: stripUndefined({ ...parsed.format }),
        tools: stripUndefined({ ...parsed.tools }),
        ignore: (parsed.ignore ?? []).map((ignore) => stripUndefined(ignore)),
        commandChecks: normalizeCommandChecks(commandChecks),
        scopes: new Map(
            scopes.map((scope, index) => [
                stripTrailingSlashes(scope.path),
                stripUndefined({ ...scope, written: writtenScopes[index] as TomlTable }),
            ]),
        ),
    };
}
