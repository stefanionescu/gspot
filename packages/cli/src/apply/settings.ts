import { openWriter } from '#cli/write.ts';
import { openSession } from '#cli/session.ts';
import { findRoot } from '#cli/repository/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { generate } from '#cli/generation/generate.ts';
import { findSetting } from '#cli/settings/inherit.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildRepositoryPath } from '#cli/repository/scopes.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/apply/generated.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { formatApplyReport, writeGeneratedFiles } from '#cli/apply/generated.ts';
import { getScopeTable, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';
import type { Scope, SettingMatch, AvailableSettings } from '#cli/types/settings/inheritance.ts';
import { assertConfigurationsExist, assertConfigurationsEditable } from '#cli/configurations/select.ts';
import type { ApplyReport, SaveSettingsOptions, SettingsEditContext, ConfigurationsOptions } from '#cli/types/apply.ts';

/**
Edit settings, check them, and write them and their generated files. Installs nothing.

@param repositoryRoot the folder where gspot writes settings and generated files.
@param options the settings edit and its summary.
@returns the apply report and whether the written settings changed.
*/
export async function applySettingsEdit(
    repositoryRoot: string,
    options: SaveSettingsOptions,
): Promise<CommandResult<ApplyReport & { changed: boolean }>> {
    const { edit: input, summary } = options;
    using writer = openWriter(repositoryRoot);
    const result = buildEditedSettings(repositoryRoot, input);
    const previous = generate(await openSession(repositoryRoot));
    const session = await openSession(repositoryRoot, {
        settingsFile: { settings: result.settings, text: result.text },
    });
    const generated = generate(session);
    writeSettings(writer, result.text, input.original);
    let report: ApplyReport;
    try {
        report = await writeGeneratedFiles(session, generated, writer);
    } catch (error) {
        if (!(error instanceof GspotError)) throw error;
        const message = error.message;
        throw new GspotError(
            'writing',
            [
                summary,
                `gspot.toml keeps this change, and applying it stopped: ${message}`,
                'Fix that, then run gspot apply.',
            ].join('\n'),
            { cause: error },
        );
    }
    const keys = new Set(
        generated.managedKeys.flatMap((file) => file.keys.map(({ key }) => JSON.stringify([file.path, key]))),
    );
    if (previous.managedKeys.some((file) => file.keys.some(({ key }) => !keys.has(JSON.stringify([file.path, key])))))
        report.notes.push(MANAGED_KEYS_NOTE);
    const shown = result.changed ? summary : 'No change: gspot.toml stays the same.';
    return {
        text: `${shown}\n${formatApplyReport(report)}`,
        json: { ...report, changed: result.changed },
        exitCode: 0,
    };
}

/**
Read and validate the settings once before a command edits them.

@param cwd the folder where the command starts.
@returns the settings and the gspot.toml text before the edit.
*/
export function prepareSettingsEdit(cwd: string): SettingsEditContext {
    const root = findRoot(cwd);
    const input = readSettingsEdit(root);
    const reads = createReadCache(root);
    const settings = parseSettings(input.text, root);
    return { root, input, settings, reads };
}

/**
Validate the configuration names and the scope for add and remove before either command edits a list.

@param options where the command starts, the configurations, and the scope.
@returns the validated edit, the lists of that scope, and the shipped configurations.
*/
export function prepareConfigurationEdit(options: ConfigurationsOptions): {
    root: string;
    input: SettingsEdit;
    scopeSettings: Pick<Settings, 'configurations' | 'removed_configurations'>;
    selected: string[];
    configurations: Map<string, Configuration>;
} {
    const edit = prepareSettingsEdit(options.cwd);
    if (options.scope !== undefined) options.scope = buildRepositoryPath(edit.root, options.cwd, options.scope);
    const configurations = readConfigurations();
    assertConfigurationsExist(options.configurations, configurations);
    assertConfigurationsEditable(options.configurations, configurations);
    getScopeTable(edit.input.table, options.scope);
    const scopeSettings =
        options.scope === undefined
            ? edit.settings
            : (edit.settings.scopes[options.scope] as Settings['scopes'][string]);
    const selected = selectForScope(edit.settings, options.scope ?? '', configurations).map(
        (configuration) => configuration.name,
    );
    const { root, input } = edit;
    return { root, input, scopeSettings, selected, configurations };
}

/**
Look up a setting in one scope with the configurations that the session selects, including the ones that the files of
the repository select.

@param context the settings from before the edit.
@param context.root the repository root.
@param context.input the settings text and table before the edit.
@param context.settings the parsed gspot.toml before the edit.
@param context.reads the file cache for the lookup.
@param key the dotted setting name.
@param scope the folder to look in, or the root when absent.
@returns the declaration and defaults for that scope.
*/
export async function readSetting(
    context: SettingsEditContext,
    key: string,
    scope: string | undefined,
): Promise<{ available: AvailableSettings; match: SettingMatch; scope: Scope }> {
    if (['configurations', 'removed_configurations'].includes(key))
        throw new GspotError('arguments', 'Use gspot add or gspot remove to change configurations.');
    getScopeTable(context.input.table, scope);
    const { settings, reads } = context;
    const session = await openSession(context.root, { settingsFile: { settings, text: context.input.text }, reads });
    const selected = session.scopes.find((each) => each.folder.path === (scope ?? '')) as Scope;
    const availableSettings = selected.availableSettings;
    const match = findSetting(availableSettings, key);
    if (match === undefined) {
        const selectedScope = session.scopes.find(
            (each) =>
                Object.hasOwn(settings.scopes, each.folder.path) &&
                findSetting(each.availableSettings, key) !== undefined,
        )?.folder.path;
        if (selectedScope !== undefined)
            throw new GspotError(
                'arguments',
                `A configuration has the setting ${key} in the scope ${selectedScope}; add --scope ${quoteArgument(selectedScope)}.`,
            );
        throw new GspotError('arguments', formatUnknownSetting(availableSettings, key));
    }
    return { available: availableSettings, match, scope: selected };
}
