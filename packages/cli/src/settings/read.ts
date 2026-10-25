import { GspotError } from '#cli/system/errors.ts';
import { parseTomlText } from '#cli/settings/file.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { parseTomlSyntax } from '#cli/parsers/formats/toml.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { COMMAND_CHECK_DEFAULTS } from '#cli/config/settings/read.ts';
import { validateSettings, formatSettingsIssue } from '#cli/settings/validation/schema.ts';
import { type Settings, type TomlTable, type ParsedSettings } from '#cli/types/settings/file.ts';

/**
Parse and validate gspot.toml. Throw a GspotError with every settings error.

@param text the gspot.toml contents.
@param root the folder for validating declared scope paths.
@returns the normalized settings.
*/
export function parseSettings(text: string, root: string): Settings {
    const written = parseTomlText(text, SETTINGS_FILE);
    const syntax = parseTomlSyntax(text, written);
    const result = settingsSchema.safeParse(written);
    if (!result.success)
        throw new GspotError(
            'settings',
            result.error.issues.flatMap((issue) => formatSettingsIssue(issue, syntax)).join('\n'),
        );
    const settings = buildSettings(result.data, written);
    validateSettings(settings, root, syntax);
    return settings;
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
                    why: 'This repository runs this command as one of its checks.',
                    help: commandCheck.help ?? 'Read the command output; this repository declares the check.',
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
        scopes: Object.fromEntries(
            scopes.map((scope, index) => [
                trimTrailingSlashes(scope.path),
                stripUndefined({ ...scope, written: writtenScopes[index] as TomlTable }),
            ]),
        ),
    };
}
