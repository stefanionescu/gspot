import { expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { GspotError } from '#cli/system/errors.ts';
import { readSettings } from '#cli/settings/read.ts';
import { type Level } from '#cli/types/configurations.ts';
import { spawnGspot } from '#tests/setup/cli/commands.ts';
import { type ScopeSelection } from '#tests/types/settings.ts';
import { SCHEMA_DIRECTIVE } from '#cli/config/settings/text.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { type AvailableSettings } from '#cli/types/settings/inheritance.ts';
import { selectForScope, buildScopeSettings } from '#cli/settings/scopes.ts';
import { type Settings, type WrittenSettings } from '#cli/types/settings/file.ts';

/**
Build the gspot.toml text of a sandbox, with rules off unless the options turn them on.
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
Build the defaults of level basic for these shipped configurations.

@param configurations the configuration names to select.
@returns the settings and defaults they make available.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 17 calls in 6 files share it.
export function buildSelectedAvailableSettings(configurations: string[]): AvailableSettings {
    return buildAvailableSettings(selectConfigurations(configurations, readConfigurations()), 'basic');
}

/**
Parse settings text and return its errors, or none when it parses.

@param text gspot.toml content to parse.
@param root folder the settings describe, for errors that depend on its files.
*/
export function validateSettingsText(text: string, root?: string): string[] {
    using resources = new DisposableStack();
    try {
        readSettings(text, root ?? resources.use(createTemporaryFolder()).path);
        return [];
    } catch (error) {
        if (error instanceof GspotError && error.code === 'settings') return error.message.split('\n');
        throw error;
    }
}

/**
Build a command check that prints each path it gets and fails.
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
*/
export function selectScopeSettings(settings: Settings, scopePath = ''): ScopeSelection {
    const configurations = selectForScope(settings, scopePath, readConfigurations());
    const availableSettings = buildAvailableSettings(configurations, 'basic');
    const scopeSettings = buildScopeSettings(availableSettings, settings, configurations, scopePath);
    return { scopeSettings, configurations, availableSettings };
}

/**
Write a project with the selected function parameter limit and apply its settings.

@param root the sandbox folder.
@param scenario the language and source file to check.
@param scenario.language the language configuration.
@param scenario.file the source path.
@param scenario.source the source text.
@param supplied the requested maximum or the default.
@returns the requested and default parameter limits.
*/
export async function prepareParameterProject(
    root: string,
    scenario: { language: string; file: string; source: string },
    supplied: 'default' | number,
): Promise<{ maximum: unknown; defaultMaximum: unknown }> {
    const { value: defaultMaximum } = buildAvailableSettings(
        [readConfigurations().get('structure')!],
        'all',
    ).defaults.get('limits.function_parameters')!;
    const maximum = supplied === 'default' ? defaultMaximum : supplied;
    const limits =
        maximum === defaultMaximum
            ? ''
            : `[limits.${scenario.language}]\nfunction_parameters = { value = ${String(maximum)}, reason = "The project API declares eight required parameters." }\n`;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings([scenario.language], { tables: limits, level: 'all' }),
        [scenario.file]: scenario.source,
    });
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    return { maximum, defaultMaximum };
}
