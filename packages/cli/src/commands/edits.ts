import { relative } from 'node:path';

import { InvalidArgumentError } from '@commander-js/extra-typings';

import {
    ADD_REMOVE_MESSAGE,
    FIX_INSTALL_MESSAGE,
    NAME_LIST_SEPARATOR,
    REPAIRED_FILES_MESSAGE,
    UNCHANGED_SETTINGS_MESSAGE,
} from '#cli/config/commands/edits.ts';
import { PATHS_OPTION } from '#cli/config/commands/help.ts';
import { MANAGED_KEYS_NOTE } from '#cli/config/generation/files.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { hasReleasedScanner } from '#cli/configurations/general/dependencies/generate.ts';
import { openSession } from '#cli/engine/session.ts';
import { findEmptySetting } from '#cli/engine/skips.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { formatApplyReport, listInstallNotes, writeGeneratedFiles } from '#cli/generation/write.ts';
import { listCheckIds } from '#cli/manifests/read.ts';
import { assertConfigurationsEditable, assertConfigurationsExist } from '#cli/manifests/select.ts';
import { listRepositoryFiles } from '#cli/repository/read.ts';
import { selectScope } from '#cli/repository/scopes.ts';
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
import { buildArgumentPath } from '#cli/system/paths.ts';
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

function listEmptySettingNotes(previous: Session | undefined, session: Session): string[] {
    if (previous === undefined) return [];
    const selected = new Set(
        previous.scopes.flatMap(({ configurations }) => configurations.flatMap(({ checks }) => checks)),
    );
    const notes = session.scopes.flatMap((scope) => {
        const configured = previous.configuredChecks.filter((each) => each.scope.path === scope.path);
        return scope.configurations
            .flatMap(({ checks }) => checks)
            .flatMap((check) => {
                const setting = findEmptySetting(session.settings, scope, check);
                if (setting === undefined) return [];
                if (!selected.has(check)) return [`${check.id} stays off until you set ${setting}.`];
                return configured.some((each) => each.check === check) ? [`This turns off ${check.id}.`] : [];
            });
    });
    return [...new Set(notes)];
}

// A configuration that leaves the scope stops managing the keys its tools write into a config file of the repository.
function hasReleasedSharedKeys(before: Scope, after: Scope): boolean {
    const kept = new Set(after.configurations.map(({ name }) => name));
    return before.configurations.some(
        (configuration) =>
            !kept.has(configuration.name) &&
            configuration.tools.some((tool) => tool.replace_key?.some(({ pointer }) => pointer === true) === true),
    );
}

/**
Note an edit after which gspot stops managing keys that stay in the files of the repository: the keys of a removed
configuration in a shared config file, or the Bun scanner key in bunfig.toml.
*/
function listReleasedKeyNotes(previous: Session | undefined, session: Session, writer: Files): string[] {
    if (previous === undefined) return [];
    const isReleased = session.scopes.some((scope) => {
        const before = previous.scopes.find(({ path }) => path === scope.path);
        return (
            before !== undefined && (hasReleasedSharedKeys(before, scope) || hasReleasedScanner(before, scope, writer))
        );
    });
    return isReleased ? [MANAGED_KEYS_NOTE] : [];
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

export async function readIgnoreEditContext(root: string, selecting?: readonly string[]): Promise<IgnoreEditContext> {
    const edit = readSettingsFile(root);
    const cache = createRunCache(root);
    cache.sources.set(SETTINGS_FILE, Buffer.from(edit.text));
    const settings = readSettings(edit.text, root, selecting);
    const listing = await listRepositoryFiles(cache);
    return { root, edit, settings, cache, listing };
}

export async function readSettingsEditContext(
    { root, cwd }: CommandLocation,
    scopePath?: string,
    selecting?: readonly string[],
): Promise<SettingsEditContext> {
    if (scopePath?.startsWith('.') === true && relative(root, cwd) !== '')
        throw new GspotError('arguments', '--scope takes the path from the repository root, such as services/b.');
    const context = await readIgnoreEditContext(root, selecting);
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

export async function readConfigurationEditContext(
    options: ConfigurationsOptions,
    selecting?: readonly string[],
): Promise<
    SettingsEditContext & {
        scopeSettings: Pick<Settings, 'configurations' | 'removed_configurations'>;
        selected: string[];
    }
> {
    const context = await readSettingsEditContext(options, options.scopePath, selecting);
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

export function formatConfigurationChange({ action, changed, where, unchanged, state }: ConfigurationChange): string {
    const summary = `${action} ${formatNameList(changed)}${where}.`;
    if (unchanged.length === 0) return summary;
    return `${summary} ${formatNameList(unchanged)} ${unchanged.length === 1 ? 'is' : 'are'} ${state}.`;
}

export function selectSettingToEdit(
    context: SettingsEditContext,
    key: string,
): { availableSettings: AvailableSettings; match: SettingMatch; scope: Scope } {
    assertSettingEditable(key, context.scopePath);
    const { settings, session } = context;
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
        ...listReleasedKeyNotes(context.session, session, writer),
        ...listEmptySettingNotes(context.session, session),
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

export function formatIgnoreSubject(check: string, rule: string | undefined): string {
    return rule === undefined ? check : `rule ${rule} of ${check}`;
}

/**
Build the parser of an option that takes names separated by commas and may repeat.

@param message the error for a value that names nothing.
*/
export function parseListOption(message: string): (value: string, previous: string[] | undefined) => string[] {
    return (value, previous) => {
        const names = value
            .split(NAME_LIST_SEPARATOR)
            .map((name) => name.trim())
            .filter((name) => name !== '');
        if (names.length === 0) throw new InvalidArgumentError(message);
        return [...(previous ?? []), ...names];
    };
}

export const pathsOption: CommandOption = {
    flags: PATHS_OPTION,
    parse: (value: string, previous: string[] | undefined) => [...(previous ?? []), value],
};
