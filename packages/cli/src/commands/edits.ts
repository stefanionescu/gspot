import { relative } from 'node:path';

import { InvalidArgumentError } from '@commander-js/extra-typings';

import {
    ADD_REMOVE_MESSAGE,
    FIX_INSTALL_MESSAGE,
    REPAIRED_FILES_MESSAGE,
    UNCHANGED_SETTINGS_MESSAGE,
} from '#cli/config/commands/edits.ts';
import { PATHS_OPTION } from '#cli/config/commands/help.ts';
import { CHECK_LIST_SEPARATOR, EMPTY_CHECKS_MESSAGE } from '#cli/config/commands/reports.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { findEmptySetting } from '#cli/engine/skips.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { formatApplyReport, listInstallNotes, writeGeneratedFiles } from '#cli/generation/write.ts';
import { listCheckIds } from '#cli/manifests/read.ts';
import { assertConfigurationsEditable, assertConfigurationsExist } from '#cli/manifests/select.ts';
import { listRepositoryFiles } from '#cli/repository/read.ts';
import { buildArgumentPath, selectScope } from '#cli/repository/scopes.ts';
import { scopeSchema } from '#cli/schemas/settings/file.ts';
import { addScopeTable, buildEditedSettings } from '#cli/settings/edit.ts';
import { readSettingsFile, writeSettings } from '#cli/settings/file.ts';
import { findSetting } from '#cli/settings/inherit.ts';
import { findSettingSchema, RECORD_FIELDS } from '#cli/settings/lookup.ts';
import { buildArgumentPaths } from '#cli/settings/paths.ts';
import { readSettings } from '#cli/settings/read.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { SETTINGS_PAGE_SENTENCE } from '#cli/settings/validation/messages.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { formatNameList, quoteArgument } from '#cli/system/text.ts';
import type {
    CommandLocation,
    CommandOption,
    ConfigurationChange,
    ConfigurationsOptions,
    IgnoreEditContext,
    SettingsEditContext,
    SettingsEditOptions,
    SettingsEditReport,
} from '#cli/types/commands/edits.ts';
import type { ApplyReport } from '#cli/types/generation.ts';
import type { AvailableSettings, Scope, SettingMatch, Settings } from '#cli/types/settings.ts';
import type { CommandResult, Files } from '#cli/types/system.ts';
import type { Generation, Session } from '#cli/types/tools.ts';

function assertSettingEditable(key: string, scopePath: string): void {
    if (Object.hasOwn(RECORD_FIELDS, key))
        throw new GspotError(
            'arguments',
            key === 'ignore'
                ? 'Use gspot ignore to add an ignore, or gspot unignore to remove one.'
                : `Write [[${key}]] by hand in gspot.toml. Record lists have their own fields.`,
        );
    if (['configurations', 'removed_configurations'].includes(key))
        throw new GspotError('arguments', ADD_REMOVE_MESSAGE);
    if (scopePath !== '' && findSettingSchema(key) !== undefined && findSettingSchema(key, scopeSchema) === undefined)
        throw new GspotError('arguments', `${key} applies to the whole repository. Leave out --scope.`);
}

function listTurnedOffNotes(previous: Session | undefined, session: Session): string[] {
    if (previous === undefined) return [];
    const turnedOff = previous.configuredChecks.filter(({ check, scope }) => {
        const next = session.scopes.find(({ path }) => path === scope.path);
        const isSelected = next?.configurations.some(({ checks }) => checks.includes(check)) === true;
        return next !== undefined && isSelected && findEmptySetting(session.settings, next, check) !== undefined;
    });
    return [...new Set(turnedOff.map(({ check }) => `This turns off ${check.id}.`))];
}

function listStaysOffNotes(previous: Session | undefined, session: Session): string[] {
    if (previous === undefined) return [];
    const before = new Set(
        previous.scopes.flatMap(({ configurations }) => configurations.flatMap(({ checks }) => checks)),
    );
    const notes = session.scopes.flatMap((scope) =>
        scope.configurations
            .flatMap(({ checks }) => checks)
            .filter((check) => !before.has(check))
            .flatMap((check) => {
                const setting = findEmptySetting(session.settings, scope, check);
                return setting === undefined ? [] : [`${check.id} stays off until you set ${setting}.`];
            }),
    );
    return [...new Set(notes)];
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
                `gspot.toml keeps this change, and writing the generated files stopped: ${error.message}`,
                FIX_INSTALL_MESSAGE,
            ].join('\n'),
            { cause: error },
        );
    }
}

function assertNoCheckPaths(context: IgnoreEditContext, paths: string[]): void {
    const checks = new Set(listCheckIds(Object.values(context.settings.commandChecks)));
    for (const path of paths)
        if (checks.has(path))
            throw new GspotError(
                'arguments',
                `--paths ${quoteArgument(path)} names a check. Give the check as a positional argument.`,
            );
}

function assertSelectorsMatch(context: IgnoreEditContext, selectors: string[]): void {
    for (const selector of selectors) {
        const path = selector.startsWith('!') ? selector.slice(1) : selector;
        const isMatched = buildPathMatcher([path]);
        if (
            context.listing.files.every(
                (file) => file.path !== path && !file.path.startsWith(`${path}/`) && !isMatched(file.path),
            )
        )
            throw new GspotError(
                'arguments',
                `--paths ${quoteArgument(selector)} matches no repository file. Name an existing file, folder, or matching glob.`,
            );
    }
}

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

@param location where the command starts.
@param location.root the validated repository root.
@param location.cwd the calling folder.
@param scopePath the --scope path relative to the repository root, or absent for the top level.
*/
export async function readSettingsEditContext(
    { root, cwd }: CommandLocation,
    scopePath?: string,
): Promise<SettingsEditContext> {
    if (scopePath?.startsWith('.') === true && relative(root, cwd) !== '')
        throw new GspotError('arguments', '--scope takes the path from the repository root, such as services/b.');
    const context = await readIgnoreEditContext(root);
    const { edit: input, settings, cache, listing } = context;
    const session = await openSession(root, { settings, cache, listing });
    const path = scopePath === undefined ? '' : buildArgumentPath(root, root, scopePath);
    if (session.scopes.every((scope) => scope.path !== path))
        throw new GspotError(
            'arguments',
            `There is no scope called ${path}. Name a folder that has a [[scope]] record or holds a project file.`,
        );
    return { ...context, session, scopePath: path, scopeTable: addScopeTable(input.table, path) };
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
    assertNoCheckPaths(context, paths ?? []);
    const selectors = buildArgumentPaths(context.root, cwd, paths);
    assertSelectorsMatch(context, selectors ?? []);
    return selectors;
}

/**
Validate the configuration names and the scope for add and remove before either command edits a list.

@param options where the command starts, the configurations, and the scope.
*/
export async function readConfigurationEditContext(options: ConfigurationsOptions): Promise<
    SettingsEditContext & {
        scopeSettings: Pick<Settings, 'configurations' | 'removed_configurations'>;
        selected: string[];
    }
> {
    const context = await readSettingsEditContext(options, options.scopePath);
    const { settings, scopePath } = context;
    assertConfigurationsExist(options.configurations);
    assertConfigurationsEditable(options.configurations);
    const scopeSettings =
        scopePath === ''
            ? settings
            : (settings.scopes.get(scopePath) ?? { configurations: [], removed_configurations: [] });
    const selected = selectScope(scopePath, context.session.scopes).configurations.map(
        (configuration) => configuration.name,
    );
    return { ...context, scopeSettings, selected };
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
export function selectSettingToEdit(
    context: SettingsEditContext,
    key: string,
): { availableSettings: AvailableSettings; match: SettingMatch; scope: Scope } {
    assertSettingEditable(key, context.scopePath);
    const { settings } = context;
    const session = context.session;
    const selected = selectScope(context.scopePath, session.scopes);
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
        const offered = new Set(session.scopes.flatMap((each) => each.availableSettings.settings.keys().toArray()));
        const unknown = formatUnknownSetting(key, { available: availableSettings.settings.keys().toArray(), offered });
        throw new GspotError('arguments', `${unknown} ${SETTINGS_PAGE_SENTENCE}`);
    }
    return { availableSettings, match, scope: selected };
}

/**
Build the result of an edit that leaves gspot.toml and the generated files unchanged.

@param summary the sentence that says why nothing changed.
@param notes the notes of the edit.
*/
export function buildUnchangedResult(summary: string, notes: string[] = []): CommandResult<SettingsEditReport> {
    const noteLines = notes.map((note) => `note     ${note}\n`);
    return {
        text: `${summary}\n${noteLines.join('')}`,
        json: { written: [], unchanged: [], deleted: [], updated: [], changed: false, summary, notes },
        exitCode: 0,
    };
}

/**
Edit settings, check them, and write them and their generated files. Installs nothing.

@param context the edit, the repository that it changes, and the session before it, when the command has one.
@param options the text the report adds.
*/
export async function writeSettingsEdit(
    context: IgnoreEditContext & { session?: Session },
    options: SettingsEditOptions,
): Promise<CommandResult<SettingsEditReport>> {
    const { root, edit, cache, listing } = context;
    const { summary } = options;
    const writer = openFiles(root);
    const result = buildEditedSettings(root, edit);
    cache.sources.set(SETTINGS_FILE, Buffer.from(result.text));
    const session = await openSession(root, { cache, listing, settings: result.settings });
    const generated = buildGeneratedFiles(session);
    writeSettings(writer, result.text, edit.previous);
    const report = await writeEditedFiles(session, generated, { writer, summary });
    report.notes.push(
        ...(await listInstallNotes(session, generated, report)),
        ...(options.notes ?? []),
        ...listTurnedOffNotes(context.session, session),
        ...listStaysOffNotes(context.session, session),
    );
    const written = report.written.length + report.updated.length + report.deleted.length;
    if (written === 0 && !result.changed)
        return buildUnchangedResult(options.unchangedSummary ?? UNCHANGED_SETTINGS_MESSAGE, report.notes);
    const shown = result.changed ? summary : (options.unchangedSummary ?? REPAIRED_FILES_MESSAGE);
    return {
        text: `${shown}\n${formatApplyReport(report)}`,
        json: { ...report, summary: shown, changed: result.changed },
        exitCode: 0,
    };
}

/**
Parse the value of a flag that names checks, such as --only: one check, or several separated by commas. A repeated flag
adds its checks to the earlier ones.

@param value the text of one flag.
@param previous the checks of the earlier flags.
*/
export function parseCheckNames(value: string, previous: string[] | undefined): string[] {
    const checks = value
        .split(CHECK_LIST_SEPARATOR)
        .map((check) => check.trim())
        .filter((check) => check !== '');
    if (checks.length === 0) throw new InvalidArgumentError(EMPTY_CHECKS_MESSAGE);
    return [...(previous ?? []), ...checks];
}

export const pathsOption: CommandOption = {
    flags: PATHS_OPTION,
    parse: (value: string, previous: string[] | undefined) => [...(previous ?? []), value],
};
