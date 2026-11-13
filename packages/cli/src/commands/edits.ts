import { relative } from 'node:path';

import {
    ADD_REMOVE_MESSAGE,
    FIX_INSTALL_MESSAGE,
    MANAGED_KEYS_NOTE,
    REPAIRED_FILES_MESSAGE,
    UNCHANGED_SETTINGS_MESSAGE,
} from '#cli/config/commands/edits.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { SETTINGS_PAGE_SENTENCE } from '#cli/config/settings/validation.ts';
import { hasReleasedScanner } from '#cli/configurations/general/dependencies/bunfig.ts';
import { findEmptySetting } from '#cli/engine/plan/skips.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { formatApplyReport, listInstallNotes } from '#cli/generation/report.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { assertConfigurationsEditable, assertConfigurationsExist } from '#cli/manifests/select.ts';
import { listRepositoryFiles } from '#cli/repository/read.ts';
import { selectScope } from '#cli/repository/scopes.ts';
import { scopeSchema } from '#cli/schemas/settings/file.ts';
import { findSettingSchema, RECORD_FIELDS } from '#cli/settings/lookup.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import { addScopeTable, buildEditedSettings } from '#cli/settings/toml/edit.ts';
import { readSettingsFile, writeSettings } from '#cli/settings/toml/file.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { findSetting } from '#cli/settings/values/inherit.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { buildArgumentPath } from '#cli/system/paths.ts';
import { formatNameList, formatNameState } from '#cli/system/text/messages.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
import type {
    CommandLocation,
    ConfigurationChange,
    ConfigurationsOptions,
    EditContext,
    SettingsEditContext,
    SettingsEditOptions,
    SettingsEditReport,
} from '#cli/types/commands.ts';
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

export async function readEditContext(root: string, selecting?: readonly string[]): Promise<EditContext> {
    const file = readSettingsFile(root);
    const cache = createRunCache(root);
    cache.sources.set(SETTINGS_FILE, Buffer.from(file.text));
    const settings = parseSettings(file.text, root, selecting);
    const listing = await listRepositoryFiles(cache);
    return { root, file, settings, cache, listing };
}

export async function readSettingsEditContext(
    { root, cwd, scopePath }: CommandLocation & { scopePath?: string | undefined },
    selecting?: readonly string[],
): Promise<SettingsEditContext> {
    if (scopePath?.startsWith('.') === true && relative(root, cwd) !== '')
        throw new GspotError('arguments', '--scope takes the path from the repository root, such as services/b.');
    const context = await readEditContext(root, selecting);
    const { file, settings, cache, listing } = context;
    const session = await openSession(root, { settings, cache, listing });
    const path = scopePath === undefined ? '' : buildArgumentPath(root, root, scopePath);
    if (session.scopes.every((scope) => scope.path !== path))
        throw new GspotError(
            'arguments',
            `There is no scope called ${path}. Name a folder that has a [[scope]] record or holds a project file.`,
        );
    return { ...context, session, scopePath: path, scopeTable: addScopeTable(file.table, path) };
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
    const context = await readSettingsEditContext(options, selecting);
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
    return `${summary} ${formatNameState(unchanged, state)}.`;
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
    context: EditContext & { session?: Session },
    options: SettingsEditOptions,
): Promise<CommandResult<SettingsEditReport>> {
    const { root, file, cache, listing } = context;
    const { summary } = options;
    const writer = openFiles(root);
    const result = buildEditedSettings(root, file);
    cache.sources.set(SETTINGS_FILE, Buffer.from(result.text));
    const session = await openSession(root, { cache, listing, settings: result.settings });
    const generated = buildGeneratedFiles(session);
    writeSettings(writer, result.text, file.previous);
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
