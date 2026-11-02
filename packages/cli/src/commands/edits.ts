import { GspotError } from '#cli/system/errors.ts';
import { openSession } from '#cli/engine/session.ts';
import { readSettings } from '#cli/settings/read.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findSetting } from '#cli/settings/inherit.ts';
import { RECORD_FIELDS } from '#cli/settings/lookup.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { PATHS_OPTION } from '#cli/config/commands/help.ts';
import { buildArgumentPaths } from '#cli/settings/paths.ts';
import type { ApplyReport } from '#cli/types/generation.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { listRepositoryFiles } from '#cli/repository/read.ts';
import { buildArgumentPath } from '#cli/repository/scopes.ts';
import type { Session, Generation } from '#cli/types/tools.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import type { Files, CommandResult } from '#cli/types/system.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { quoteArgument, formatNameList } from '#cli/system/text.ts';
import { writeSettings, readSettingsFile } from '#cli/settings/file.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { listCheckIds, readConfigurations } from '#cli/manifests/read.ts';
import { openScopeTable, buildEditedSettings } from '#cli/settings/edit.ts';
import { formatApplyReport, writeGeneratedFiles } from '#cli/generation/write.ts';
import { assertConfigurationsExist, assertConfigurationsEditable } from '#cli/manifests/select.ts';
import type { Scope, Settings, TomlTable, SettingsEdit, SettingMatch, AvailableSettings } from '#cli/types/settings.ts';

import {
    FIX_APPLY_MESSAGE,
    ADD_REMOVE_MESSAGE,
    REPAIRED_FILES_MESSAGE,
    UNCHANGED_SETTINGS_MESSAGE,
} from '#cli/config/commands/edits.ts';
import type {
    CommandOption,
    IgnoreEditContext,
    SettingsEditOptions,
    ConfigurationChange,
    SettingsEditContext,
    ConfigurationsOptions,
} from '#cli/types/commands/edits.ts';

/**
Read and parse gspot.toml and list the repository, without a session.

@param root the validated repository root.
*/
export async function readIgnoreEditContext(root: string): Promise<IgnoreEditContext> {
    const edit = readSettingsFile(root);
    const cache = createRunCache(root);
    cache.sources.set(SETTINGS_FILE, Buffer.from(edit.text));
    const settings = readSettings(edit.text, root);
    const listing = await listRepositoryFiles(cache);
    return { root, edit, settings, cache, listing };
}

/**
Read and validate the settings once before a command edits them, and find the table of the scope that the command
writes into.

@param root the validated repository root.
@param scopePath the --scope path relative to the repository root, or absent for the top level.
*/
export async function readSettingsEditContext(root: string, scopePath?: string): Promise<SettingsEditContext> {
    const context = await readIgnoreEditContext(root);
    const { edit: input, settings, cache, listing } = context;
    const session = await openSession(root, { settings, cache, listing });
    const path = scopePath === undefined ? '' : buildArgumentPath(root, root, scopePath);
    if (!session.scopes.some((scope) => scope.path === path))
        throw new GspotError(
            'arguments',
            `There is no scope called ${path}. Name a project folder or a written scope.`,
        );
    return { ...context, session, scope: path, scopeTable: openScopeTable(input.table, path) };
}

/**
Resolve ignore selectors from the calling folder and refuse mistaken checks or unmatched paths.

@param context the settings and repository files from before the edit.
@param cwd the calling folder.
@param paths the repeated --paths values.
*/
export function buildIgnorePaths(
    context: IgnoreEditContext,
    cwd: string,
    paths: string[] | undefined,
): string[] | undefined {
    const checks = new Set(listCheckIds(Object.values(context.settings.commandChecks)));
    for (const path of paths ?? [])
        if (checks.has(path))
            throw new GspotError(
                'arguments',
                `--paths ${quoteArgument(path)} names a check. Give the check as a positional argument.`,
            );
    const selectors = buildArgumentPaths(context.root, cwd, paths);
    for (const selector of selectors ?? []) {
        const path = selector.startsWith('!') ? selector.slice(1) : selector;
        const matches = buildPathMatcher([path]);
        if (
            !context.listing.files.some(
                (file) => file.path === path || file.path.startsWith(`${path}/`) || matches(file.path),
            )
        )
            throw new GspotError(
                'arguments',
                `--paths ${quoteArgument(selector)} matches no repository file. Name an existing file, folder, or matching glob.`,
            );
    }
    return selectors;
}

/**
Validate the configuration names and the scope for add and remove before either command edits a list.

@param options where the command starts, the configurations, and the scope.
*/
export async function readConfigurationEditContext(options: ConfigurationsOptions): Promise<{
    root: string;
    input: SettingsEdit;
    scope: string;
    scopeTable: TomlTable;
    scopeSettings: Pick<Settings, 'configurations' | 'removed_configurations'>;
    selected: string[];
    configurationsByName: ReadonlyMap<string, Configuration>;
    context: SettingsEditContext;
}> {
    const context = await readSettingsEditContext(options.root, options.scope);
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
    const summary = `${action} ${formatNameList(changed)}${where}.`;
    if (unchanged.length === 0) return summary;
    return `${summary} ${formatNameList(unchanged)} ${unchanged.length === 1 ? 'is' : 'are'} ${state}.`;
}

/**
Look up a setting in one scope with the configurations that the session selects, including the ones that the files of
the repository select.

@param context the settings from before the edit.
@param key the dotted setting name.
*/
export function findEditedSetting(
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
        throw new GspotError('arguments', formatUnknownSetting(key, availableSettings.settings.keys().toArray()));
    }
    return { availableSettings, match, scope: selected };
}

/**
Build the result of an edit that leaves gspot.toml and the generated files unchanged.

@param summary the sentence that says why nothing changed.
@param notes the notes of the edit.
*/
export function buildUnchangedResult(
    summary: string,
    notes: string[] = [],
): CommandResult<{ changed: false; summary: string }> {
    const noteLines = notes.map((note) => `note     ${note}\n`);
    return { text: `${summary}\n${noteLines.join('')}`, json: { changed: false, summary, notes }, exitCode: 0 };
}

async function writeEditedFiles(
    session: Session,
    generated: Generation,
    { writer, summary }: { writer: Files; summary: string },
): Promise<ApplyReport> {
    try {
        return await writeGeneratedFiles(session, generated, writer);
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
}

/**
Edit settings, check them, and write them and their generated files. Installs nothing.

@param root the folder where gspot writes settings and generated files.
@param options the edit and the text the report adds.
*/
export async function writeSettingsEdit(
    root: string,
    options: SettingsEditOptions,
): Promise<CommandResult<(ApplyReport & { changed: boolean; summary: string }) | { changed: false; summary: string }>> {
    const { edit, summary } = options;
    const writer = openFiles(root);
    const result = buildEditedSettings(root, edit);
    options.cache?.sources.set(SETTINGS_FILE, Buffer.from(result.text));
    const session = await openSession(root, {
        cache: options.cache,
        listing: options.listing,
        settings: result.settings,
    });
    const generated = buildGeneratedFiles(session);
    writeSettings(writer, result.text, edit.previous);
    const report = await writeEditedFiles(session, generated, { writer, summary });
    report.notes.push(...(options.notes ?? []));
    const written = report.written.length + report.updated.length + report.removed.length;
    if (!result.changed && written === 0)
        return buildUnchangedResult(options.unchangedSummary ?? UNCHANGED_SETTINGS_MESSAGE, report.notes);
    const shown = result.changed ? summary : (options.unchangedSummary ?? REPAIRED_FILES_MESSAGE);
    return {
        text: `${shown}\n${formatApplyReport(report)}`,
        json: { ...report, summary: shown, changed: result.changed },
        exitCode: 0,
    };
}

export const pathsOption: CommandOption = {
    flags: PATHS_OPTION,
    parse: (value: string, previous: string[] | undefined) => [...(previous ?? []), value],
};
