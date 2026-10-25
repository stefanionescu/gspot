import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { type Level } from '#cli/types/configurations.ts';
import type { ScopeSelection } from '#tests/types/settings.ts';
import { SCHEMA_DIRECTIVE } from '#cli/config/settings/file.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import type { AvailableSettings } from '#cli/types/settings/inheritance.ts';
import { selectForScope, buildScopeSettings } from '#cli/settings/scopes.ts';
import { type Settings, type WrittenSettings } from '#cli/types/settings/file.ts';

/**
Build the gspot.toml text of a sandbox, with rules off unless the options turn them on.

@param configurations what the sandbox turns on.
@param options extra settings to write.
@param options.level `recommended` or `all`.
@param options.tables more TOML to append.
@param options.scopes child scopes and their extra configurations.
@param options.rules whether to write the agent instructions.
@param options.ignore checks to leave out.
@param options.ignore.checks their check IDs.
@param options.ignore.reason why to leave them out.
@returns the gspot.toml text.
*/
export function buildSandboxSettings(
    configurations: readonly string[],
    options: {
        level?: Level;
        tables?: string;
        scopes?: readonly { path: string; configurations?: readonly string[] }[];
        rules?: boolean;
        ignore?: { checks: readonly string[]; reason: string };
    } = {},
): string {
    const selected = configurations.map((configuration) => JSON.stringify(configuration)).join(', ');
    const levelLine = options.level === undefined ? '' : `level = "${options.level}"\n`;
    const ignore = options.ignore;
    const ignored =
        ignore === undefined
            ? ''
            : ignore.checks
                  .map(
                      (check) =>
                          `[[ignore]]\ncheck = ${JSON.stringify(check)}\nreason = ${JSON.stringify(ignore.reason)}\n`,
                  )
                  .join('');
    const scopes = (options.scopes ?? [])
        .map(({ path, configurations: scopeConfigurations }) => {
            const scopeLine =
                scopeConfigurations === undefined ? '' : `configurations = ${JSON.stringify(scopeConfigurations)}\n`;
            return `[[scope]]\npath = ${JSON.stringify(path)}\n${scopeLine}`;
        })
        .join('');
    const tables = options.tables ?? '';
    const rules = options.rules === true || tables.includes('[rules]') ? '' : '\n[rules]\nenabled = false\n';
    return `${SCHEMA_DIRECTIVE}\n${levelLine}configurations = [${selected}]\n${scopes}${tables}${ignored}${rules}`;
}

/**
Build the gspot.toml text of a site sandbox whose build runs this command.

@param command the command that site.build_command runs: a test program and its arguments.
@param options the level, `all` by default, and more TOML to append.
@param options.level `recommended` or `all`.
@param options.tables more TOML to append after the site table.
@returns the gspot.toml text.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 11 calls in 3 files share it.
export function buildSiteSettings(
    command: readonly string[],
    options: { level?: Level; tables?: string } = {},
): string {
    return buildSandboxSettings(['site'], {
        level: options.level ?? 'all',
        tables: `[site]\nbuild_command = ${JSON.stringify(command)}\n${options.tables ?? ''}`,
    });
}

/**
Build the recommended defaults of these shipped configurations.

@param configurations the configuration names to select.
@returns the settings and defaults they make available.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 17 calls in 6 files share it.
export function buildSelectedAvailableSettings(configurations: string[]): AvailableSettings {
    return buildAvailableSettings(selectConfigurations(configurations, readConfigurations()), 'recommended');
}

/**
Parse settings text and return its errors, or none when it parses.

@param text gspot.toml content to parse.
@param root folder the settings describe, for errors that depend on its files.
@returns the error messages.
*/
export function validateSettingsText(text: string, root?: string): string[] {
    using resources = new DisposableStack();
    try {
        parseSettings(text, root ?? resources.use(createTemporaryFolder()).path);
        return [];
    } catch (error) {
        if (error instanceof GspotError && error.code === 'settings') return error.message.split('\n');
        throw error;
    }
}

/**
Build a command check that prints each path it gets and fails.

@param options the ID of the check and which files and stage it covers.
@returns the command check record.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 6 calls in 4 files share it.
export function buildReportingCheck(
    options: Pick<NonNullable<WrittenSettings['command_check']>[number], 'id' | 'paths' | 'stage'>,
): NonNullable<WrittenSettings['command_check']>[number] {
    return {
        id: options.id,
        command: buildProgramCommand('fakes/tool', '--print-arguments', '--exit', '1', '--', '{files}'),
        paths: options.paths,
        stage: options.stage,
        output: { format: 'lines' },
    };
}

/**
Resolve the settings and configuration defaults that apply in one scope.

@param settings the parsed gspot.toml.
@param scopePath the scope folder, the root by default.
@returns the scope settings together with their source configurations and available settings.
*/
export function selectScopeSettings(settings: Settings, scopePath = ''): ScopeSelection {
    const configurations = selectForScope(settings, scopePath, readConfigurations());
    const availableSettings = buildAvailableSettings(configurations, 'recommended');
    const scopeSettings = buildScopeSettings(availableSettings, settings, configurations, scopePath);
    return { scopeSettings, configurations, availableSettings };
}

/**
Read the gspot.toml of a sandbox as gspot parses it.

@param root the folder that holds gspot.toml.
@returns the parsed settings.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function readSandboxSettings(root: string): Settings {
    return parseSettings(readFileSync(join(root, 'gspot.toml'), 'utf8'), root);
}
