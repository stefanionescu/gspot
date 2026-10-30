import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { readSettings } from '#cli/settings/read.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import { findSetting } from '#cli/settings/inherit.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { buildArgumentPath } from '#cli/repository/scopes.ts';
import { RECORD_FIELDS } from '#cli/settings/schema-lookup.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import type { ApplyReport } from '#cli/types/generation/files.ts';
import type { Settings, TomlTable } from '#cli/types/settings/file.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { formatApplyReport, writeGeneratedFiles } from '#cli/generation/write.ts';
import { readRepositoryRoot, listRepositoryFiles } from '#cli/repository/read.ts';
import { getScopeTable, readSettingsEdit, buildEditedSettings } from '#cli/settings/edit.ts';
import { FIX_APPLY_MESSAGE, ADD_REMOVE_MESSAGE } from '#cli/config/generation/settings-edit.ts';
import type { Scope, SettingMatch, AvailableSettings } from '#cli/types/settings/inheritance.ts';
import { assertConfigurationsExist, assertConfigurationsEditable } from '#cli/manifests/select.ts';

import type {
    SettingsEditOptions,
    ConfigurationChange,
    SettingsEditContext,
    ConfigurationsOptions,
} from '#cli/types/generation/settings-edit.ts';

/**
Edit settings, check them, and write them and their generated files. Installs nothing.

@param root the folder where gspot writes settings and generated files.
@param options the edit and the text the report adds.
*/
export async function applySettingsEdit(
    root: string,
    options: SettingsEditOptions,
): Promise<CommandResult<ApplyReport & { changed: boolean; summary: string }>> {
    const { edit, summary } = options;
    const writer = openFiles(root);
    const result = buildEditedSettings(root, edit);
    options.cache?.sources.set(SETTINGS_FILE, Buffer.from(result.text));
    const session = await openSession(root, {
        cache: options.cache,
        listing: options.listing,
        settingsFile: { settings: result.settings, text: result.text },
    });
    const generated = generateFiles(session);
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
                FIX_APPLY_MESSAGE,
            ].join('\n'),
            { cause: error },
        );
    }
    report.notes.push(...(options.notes ?? []));
    const written = report.written.length + report.updated.length + report.removed.length;
    const unchanged = written === 0 ? 'No change: gspot.toml already says this.' : 'gspot.toml already says this.';
    const shown = result.changed ? summary : unchanged;
    return {
        text: `${shown}\n${formatApplyReport(report)}`,
        json: { ...report, summary: shown, changed: result.changed },
        exitCode: 0,
    };
}

/**
Read and validate the settings once before a command edits them, and find the table of the scope that the command
writes into.

@param cwd the folder where the command starts.
@param scopePath the --scope path as typed, relative to cwd, or absent for the top level.
*/
export async function prepareSettingsEdit(cwd: string, scopePath?: string): Promise<SettingsEditContext> {
    const root = await readRepositoryRoot(cwd);
    const input = readSettingsEdit(root);
    const cache = createRunCache(root);
    cache.sources.set(SETTINGS_FILE, Buffer.from(input.text));
    const settings = readSettings(input.text, root);
    const listing = await listRepositoryFiles(cache);
    const session = await openSession(root, { settingsFile: { settings, text: input.text }, cache, listing });
    const path = scopePath === undefined ? '' : buildArgumentPath(root, cwd, scopePath);
    if (!session.scopes.some((scope) => scope.path === path))
        throw new GspotError(
            'arguments',
            `There is no scope called ${path}. Name a project folder or a written scope.`,
        );
    const scopeTable = getScopeTable(input.table, path);
    return { root, edit: input, settings, cache, listing, session, scope: path, scopeTable };
}

/**
Validate the configuration names and the scope for add and remove before either command edits a list.

@param options where the command starts, the configurations, and the scope.
*/
export async function prepareConfigurationEdit(options: ConfigurationsOptions): Promise<{
    root: string;
    input: SettingsEdit;
    scope: string;
    scopeTable: TomlTable;
    scopeSettings: Pick<Settings, 'configurations' | 'removed_configurations'>;
    selected: string[];
    configurationsByName: Map<string, Configuration>;
    context: SettingsEditContext;
}> {
    const context = await prepareSettingsEdit(options.cwd, options.scope);
    const { root, edit: input, settings, scope, scopeTable } = context;
    const configurationsByName = readConfigurations();
    assertConfigurationsExist(options.configurations, configurationsByName);
    assertConfigurationsEditable(options.configurations, configurationsByName);
    const scopeSettings =
        scope === '' ? settings : (settings.scopes.get(scope) ?? { configurations: [], removed_configurations: [] });
    const selected = (context.session.scopes.find((each) => each.path === scope) as Scope).configurations.map(
        (configuration) => configuration.name,
    );
    return { root, input, scope, scopeTable, scopeSettings, selected, configurationsByName, context };
}

/**
Summarize an add or remove edit: the configurations it changed, and the ones it left alone.

@param change what the edit did.
@param change.action the verb of the edit, such as Added.
@param change.changed the configurations that the edit changed.
@param change.where the scope phrase, or empty text for the root scope.
@param change.unchanged the configurations that the edit left alone.
@param change.state the state of those configurations, such as already selected.
*/
export function formatConfigurationChange({ action, changed, where, unchanged, state }: ConfigurationChange): string {
    const list = new Intl.ListFormat('en', { type: 'conjunction' });
    const summary = `${action} ${list.format(changed)}${where}.`;
    if (unchanged.length === 0) return summary;
    return `${summary} ${list.format(unchanged)} ${unchanged.length === 1 ? 'is' : 'are'} ${state}.`;
}

/**
Look up a setting in one scope with the configurations that the session selects, including the ones that the files of
the repository select.

@param context the settings from before the edit.
@param key the dotted setting name.
*/
export function readSetting(
    context: SettingsEditContext,
    key: string,
): { availableSettings: AvailableSettings; match: SettingMatch; scope: Scope } {
    if (Object.hasOwn(RECORD_FIELDS, key))
        throw new GspotError(
            'arguments',
            key === 'ignore'
                ? 'Use gspot ignore to add an ignore, or gspot unignore to remove one.'
                : `Write [[${key}]] by hand in gspot.toml. Record lists have their own fields.`,
        );
    if (['configurations', 'removed_configurations'].includes(key))
        throw new GspotError('arguments', ADD_REMOVE_MESSAGE);
    const { settings } = context;
    const session = context.session;
    const selected = session.scopes.find((each) => each.path === context.scope) as Scope;
    const { availableSettings } = selected;
    const match = findSetting(availableSettings, key);
    if (match === undefined) {
        const selectedScope = session.scopes.find(
            (each) => settings.scopes.has(each.path) && findSetting(each.availableSettings, key) !== undefined,
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
