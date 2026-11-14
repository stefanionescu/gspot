import { parse } from '@decimalturn/toml-patch';
import type { z } from 'zod';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { COMMAND_CHECK_DEFAULTS, COMMAND_CHECK_HELP, COMMAND_CHECK_WHY } from '#cli/config/settings/file.ts';
import { BOOLEAN_WORDS, NUMBER_TEXT, TOML_COMPOUND_START, TOML_QUOTES } from '#cli/config/settings/values.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { parseTomlSyntax } from '#cli/parsers/formats/toml/syntax.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { findSettingSchema } from '#cli/settings/lookup.ts';
import {
    formatSettingsErrors,
    formatSettingsIssue,
    formatSettingValueError,
} from '#cli/settings/validation/messages.ts';
import { validateSettings } from '#cli/settings/validation/settings.ts';
import { GspotError } from '#cli/system/errors.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { findValueAt, isTable } from '#cli/system/tables.ts';
import type {
    ParsedSettings,
    ParsedSettingValue,
    Setting,
    Settings,
    SettingsFailure,
    TomlTable,
} from '#cli/types/settings.ts';

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

function parseInlineValue(text: string): unknown {
    try {
        return (parse(`value = ${text}`) as TomlTable)['value'];
    } catch (error) {
        throw new GspotError(
            'arguments',
            `The value ${text} is not a TOML inline value. Write a list as ["a", "b"] and a table as {key = "value"}, inside single quotes for the shell.`,
            { cause: error },
        );
    }
}

function parseScalarWord(word: string, setting: Setting): unknown {
    if (setting.type === 'boolean' && BOOLEAN_WORDS.has(word)) return word === 'true';
    return setting.type === 'number' && NUMBER_TEXT.test(word) ? Number(word) : word;
}

function parseWords(values: string[], setting: Setting): ParsedSettingValue {
    const [first, ...rest] = values as [string, ...string[]];
    const isCompound = rest.length === 0 && TOML_COMPOUND_START.test(first);
    if (setting.type === 'list') {
        const value = isCompound ? parseInlineValue(first) : values.map((word) => word.replace(TOML_QUOTES, '$2'));
        return { type: 'list', value: value as unknown[] };
    }
    if (rest.length > 0)
        throw new GspotError('arguments', `${setting.name} takes one value. Quote a value with spaces.`);
    return {
        type: 'scalar',
        value: isCompound && setting.type === 'table' ? parseInlineValue(first) : parseScalarWord(first, setting),
    };
}

/**
Reads a settings file that the schema refuses without the paths that the schema issues name, so one unknown or
renamed key costs that key and the rest still parses. Issues of one list arrive in index order, so the removal runs
from the last issue to the first and no index moves before its turn.
*/
function parseWithoutRefusedPaths(written: TomlTable, issues: readonly z.core.$ZodIssue[]) {
    const refused = issues.flatMap((issue) =>
        issue.code === 'unrecognized_keys' ? issue.keys.map((key) => [...issue.path, key]) : [issue.path],
    );
    for (const path of refused.toReversed()) {
        const parent = findValueAt(
            written,
            path.slice(0, -1).filter((segment) => typeof segment !== 'symbol'),
        );
        const key = path.at(-1);
        if (Array.isArray(parent) && typeof key === 'number') parent.splice(key, 1);
        else if (isTable(parent) && typeof key === 'string') Reflect.deleteProperty(parent, key);
    }
    return settingsSchema.safeParse(written);
}

function buildSettings(parsed: ParsedSettings, written: TomlTable): Settings {
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

export function safeParseSettings(
    text: string,
    root: string,
    selecting?: readonly string[],
): Settings | SettingsFailure {
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

/**
Parse the text of gspot.toml and throw on an error. Validation checks that the paths the settings name exist under
`root`.
*/
export function parseSettings(text: string, root: string, selecting?: readonly string[]): Settings {
    const result = safeParseSettings(text, root, selecting);
    if (!('errors' in result)) return result;
    throw new GspotError('settings', formatSettingsErrors(result.errors, result.syntax, SETTINGS_FILE));
}

export function buildSettingsFromTable(table: TomlTable): Settings {
    return buildSettings(settingsSchema.parse(table), table);
}

export function parseSettingValue(values: string[], setting: Setting): ParsedSettingValue {
    const parsed = parseWords(values, setting);
    const schema = findSettingSchema(setting.name);
    const validation = schema?.safeParse(parsed.value);
    if (schema === undefined || validation?.success !== false) return parsed;
    throw new GspotError(
        'arguments',
        formatSettingValueError(values.join(' '), setting, { schema, error: validation.error }),
    );
}

/**
Parse the text of gspot.toml without the keys that the schema refuses. A text that the schema still refuses gives the
shipped defaults.
*/
export function parseAcceptedSettings(text: string): Settings {
    const written = parseTomlFile(SETTINGS_FILE, text);
    const strict = settingsSchema.safeParse(written);
    const parsed = strict.success ? strict : parseWithoutRefusedPaths(written, strict.error.issues);
    return parsed.success ? buildSettings(parsed.data, written) : buildSettingsFromTable({});
}
