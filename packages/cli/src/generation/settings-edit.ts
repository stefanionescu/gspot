import { openWriter } from '#cli/write.ts';
import { openSession } from '#cli/session.ts';
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { generate } from '#cli/generation/generate.ts';
import { findSetting } from '#cli/settings/inherit.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildArgumentPath } from '#cli/repository/scopes.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { ApplyReport } from '#cli/types/generation/files.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { Settings, TomlTable } from '#cli/types/settings/file.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { formatApplyReport, writeGeneratedFiles } from '#cli/generation/write.ts';
import { getScopeTable, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';
import type { Scope, SettingMatch, AvailableSettings } from '#cli/types/settings/inheritance.ts';
import { assertConfigurationsExist, assertConfigurationsEditable } from '#cli/configurations/select.ts';

import type {
    SaveSettingsOptions,
    SettingsEditContext,
    ConfigurationsOptions,
} from '#cli/types/generation/settings-edit.ts';

/**
Edit settings, check them, and write them and their generated files. Installs nothing.

@param root the folder where gspot writes settings and generated files.
@param options the settings edit, its summary, and the notes that the report adds after its own.
@returns the apply report and whether the written settings changed.
*/
export async function applySettingsEdit(
    root: string,
    options: SaveSettingsOptions,
): Promise<CommandResult<ApplyReport & { changed: boolean }>> {
    const { edit, summary } = options;
    using writer = openWriter(root);
    const result = buildEditedSettings(root, edit);
    const session = await openSession(root, {
        settingsFile: { settings: result.settings, text: result.text },
    });
    const generated = generate(session);
    writeSettings(writer, result.text, edit.previous);
    let report: ApplyReport;
    try {
        report = await writeGeneratedFiles(session, generated, writer);
    } catch (error) {
        if (!(error instanceof GspotError)) throw error;
        throw new GspotError(
            'writing',
            [
                summary,
                `gspot.toml keeps this change, and applying it stopped: ${error.message}`,
                'Fix that, then run gspot apply.',
            ].join('\n'),
            { cause: error },
        );
    }
    report.notes.push(...(options.notes ?? []));
    const shown = result.changed ? summary : 'No change: gspot.toml stays the same.';
    return {
        text: `${shown}\n${formatApplyReport(report)}`,
        json: { ...report, changed: result.changed },
        exitCode: 0,
    };
}

/**
Read and validate the settings once before a command edits them, and find the table of the scope that the command
writes into.

@param cwd the folder where the command starts.
@param scope the --scope path as typed, relative to cwd, or absent for the top level.
@returns the settings and the gspot.toml text before the edit, the scope as a repository path, and its table.
*/
export function prepareSettingsEdit(cwd: string, scope?: string): SettingsEditContext {
    const root = readRepositoryRoot(cwd);
    const input = readSettingsEdit(root);
    const reads = createReadCache(root);
    const settings = parseSettings(input.text, root);
    const path = scope === undefined ? undefined : buildArgumentPath(root, cwd, scope);
    const scopeTable = getScopeTable(input.table, path);
    return { root, input, settings, reads, scope: path, scopeTable };
}

/**
Validate the configuration names and the scope for add and remove before either command edits a list.

@param options where the command starts, the configurations, and the scope.
@returns the validated edit, the lists of that scope, and the shipped configurations.
*/
export function prepareConfigurationEdit(options: ConfigurationsOptions): {
    root: string;
    input: SettingsEdit;
    scope: string | undefined;
    scopeTable: TomlTable;
    scopeSettings: Pick<Settings, 'configurations' | 'removed_configurations'>;
    selected: string[];
    configurations: Map<string, Configuration>;
} {
    const { root, input, settings, scope, scopeTable } = prepareSettingsEdit(options.cwd, options.scope);
    const configurations = readConfigurations();
    assertConfigurationsExist(options.configurations, configurations);
    assertConfigurationsEditable(options.configurations, configurations);
    const scopeSettings = scope === undefined ? settings : (settings.scopes[scope] as Settings['scopes'][string]);
    const selected = selectForScope(settings, scope ?? '', configurations).map((configuration) => configuration.name);
    return { root, input, scope, scopeTable, scopeSettings, selected, configurations };
}

/**
Look up a setting in one scope with the configurations that the session selects, including the ones that the files of
the repository select.

@param context the settings from before the edit.
@param context.root the repository root.
@param context.input the settings text and table before the edit.
@param context.settings the parsed gspot.toml before the edit.
@param context.reads the file cache for the lookup.
@param context.scope the folder to look in, or the root when absent.
@param key the dotted setting name.
@returns the declaration and defaults for that scope.
*/
export async function readSetting(
    context: SettingsEditContext,
    key: string,
): Promise<{ availableSettings: AvailableSettings; match: SettingMatch; scope: Scope }> {
    if (['configurations', 'removed_configurations'].includes(key))
        throw new GspotError('arguments', 'Use gspot add or gspot remove to change configurations.');
    const { settings, reads } = context;
    const session = await openSession(context.root, { settingsFile: { settings, text: context.input.text }, reads });
    const selected = session.scopes.find((each) => each.path === (context.scope ?? '')) as Scope;
    const { availableSettings } = selected;
    const match = findSetting(availableSettings, key);
    if (match === undefined) {
        const selectedScope = session.scopes.find(
            (each) =>
                Object.hasOwn(settings.scopes, each.path) && findSetting(each.availableSettings, key) !== undefined,
        )?.path;
        if (selectedScope !== undefined)
            throw new GspotError(
                'arguments',
                `A configuration has the setting ${key} in the scope ${selectedScope}; add --scope ${quoteArgument(selectedScope)}.`,
            );
        throw new GspotError('arguments', formatUnknownSetting(availableSettings, key));
    }
    return { availableSettings, match, scope: selected };
}
