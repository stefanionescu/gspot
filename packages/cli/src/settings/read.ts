import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { COMMAND_CHECK_DEFAULTS, COMMAND_CHECK_HELP, COMMAND_CHECK_WHY } from '#cli/config/settings/validation.ts';
import { parseTomlFile, parseTomlSyntax } from '#cli/parsers/formats/toml.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { formatSettingsErrors } from '#cli/settings/validation/messages.ts';
import { formatSettingsIssue, validateSettings } from '#cli/settings/validation/schema.ts';
import { GspotError } from '#cli/system/errors.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import type { ParsedSettings, Settings, SettingsFailure, TomlTable } from '#cli/types/settings.ts';

function normalizeCommandChecks(checks: ParsedSettings['command_check']): Settings['commandChecks'] {
    return Object.fromEntries(
        (checks ?? []).map((commandCheck) => {
            const id = commandCheck.id;
            const { paths, outputs, ...definition } = commandCheck;
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

export function parseSettings(text: string, root: string, selecting?: readonly string[]): Settings | SettingsFailure {
    const written = parseTomlFile(SETTINGS_FILE, text);
    const result = settingsSchema.safeParse(written);
    if (!result.success) {
        const syntax = parseTomlSyntax(text, written);
        return { errors: result.error.issues.flatMap((issue) => formatSettingsIssue(issue, syntax)), syntax };
    }
    const settings = buildSettings(result.data, written);
    const errors = validateSettings(settings, root, selecting);
    return errors.length === 0 ? settings : { errors, syntax: parseTomlSyntax(text, written) };
}

export function readSettings(text: string, root: string, selecting?: readonly string[]): Settings {
    const result = parseSettings(text, root, selecting);
    if (!('errors' in result)) return result;
    throw new GspotError('settings', formatSettingsErrors(result.errors, result.syntax, SETTINGS_FILE));
}

export function buildSettings(parsed: ParsedSettings, written: TomlTable): Settings {
    const { command_check: commandChecks, scope: scopes = [], ...document } = parsed;
    const writtenScopes = (written['scope'] ?? []) as TomlTable[];
    return {
        ...document,
        written,
        format: { ...parsed.format },
        tools: { ...parsed.tools },
        ignore: parsed.ignore ?? [],
        commandChecks: normalizeCommandChecks(commandChecks),
        scopes: new Map(
            scopes.map((scope, index) => [
                stripTrailingSlashes(scope.path),
                { ...scope, written: writtenScopes[index] as TomlTable },
            ]),
        ),
    };
}

export function buildSettingsFromTable(table: TomlTable): Settings {
    return buildSettings(settingsSchema.parse(table), table);
}
