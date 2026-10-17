// Validate settings edits and write their generated files.

import { openSession } from '#cli/session.ts';
import { findRoot } from '#cli/repository/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isGitRepository } from '#cli/system/git.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { formatNotes } from '#cli/system/terminal.ts';
import { generate } from '#cli/generation/generate.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { findDeclaration } from '#cli/settings/inherit.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { formatCount, quoteArgument } from '#cli/system/text.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { findScopeTable, updateSettings, readSettingsEdit } from '#cli/settings/edit.ts';
import { refuseAlwaysSelected, listUnknownConfigurations } from '#cli/configurations/select.ts';
import { type Settings, type KnownSettings, type DeclarationMatch } from '#cli/types/settings/values.ts';

import type {
    SaveSettingsResult,
    SaveSettingsOptions,
    ConfigurationsOptions,
} from '#cli/types/commands/edit-settings.ts';

/**
 * Edit settings, check them, and write them and their generated files. Installs nothing.
 * @param repositoryRoot the folder where gspot writes settings and generated files.
 * @param options the settings edit and its summary
 * @returns the apply report and whether the written settings changed
 */
async function saveSettings(repositoryRoot: string, options: SaveSettingsOptions): Promise<SaveSettingsResult> {
    const { input, change, summary } = options;
    using log = openWriter(repositoryRoot);
    const result = updateSettings(repositoryRoot, input, change);
    const session = await openSession(repositoryRoot, { settings: result.settings, text: result.text });
    const generated = generate(session);
    writeSettings(log, result.text, input.original);
    let report: ApplyReport;
    try {
        report = writeGeneratedFiles(session, generated, log);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new GspotError(
            'writing',
            [
                summary,
                `gspot.toml keeps this change, and applying it stopped: ${message}`,
                'Fix that, then run gspot apply.',
            ].join('\n'),
        );
    }
    return {
        text: `${summary === '' ? '' : summary + '\n'}${formatApplyReport(report)}`,
        json: { ...report, changed: result.changed },
        exitCode: 0,
    };
}

/**
 * Format generated file changes and notes for command output.
 * @param report the applied file changes and notes.
 * @returns the report text.
 */
function formatApplyReport(report: ApplyReport): string {
    const lines = [
        ...report.written.map((path) => `wrote    ${path}`),
        ...report.updated.map((path) => `updated  ${path}`),
        ...report.removed.map((path) => `removed  ${path}`),
    ];
    if (lines.length === 0 && report.notes.length === 0)
        lines.push(`No change: the ${formatCount(report.unchanged.length, 'generated file')} are up to date.`);
    return `${lines.length === 0 ? '' : lines.join('\n') + '\n'}${formatNotes(report.notes)}`;
}

/**
 * Read and validate the settings once before a command edits them.
 * @param cwd the folder where the command starts.
 * @returns the starting state of one edit.
 */
function startSettingsEdit(cwd: string): { root: string; input: SettingsEdit; settings: Settings; reads: ReadCache } {
    const root = findRoot(cwd);
    const input = readSettingsEdit(root);
    const reads = createReadCache(root);
    const settings = parseSettings(input.text, root, reads);
    return { root, input, settings, reads };
}

/**
 * Validate the configuration names and the scope for add and remove before either command edits a list.
 * @param options where the command starts, the configurations, and the scope.
 * @returns the validated edit, the lists of that scope, and the shipped manifests.
 */
export function startConfigurationEdit(options: ConfigurationsOptions): {
    root: string;
    input: SettingsEdit;
    settings: Settings;
    scopeSettings: Pick<Settings, 'configurations' | 'removed_configurations'>;
    reads: ReadCache;
    manifests: Map<string, Manifest>;
} {
    const edit = startSettingsEdit(options.cwd);
    const manifests = readManifests(edit.reads);
    const [unknown] = listUnknownConfigurations(
        options.configurations.map((name) => ({ name })),
        manifests,
    );
    if (unknown !== undefined) throw new GspotError('arguments', unknown.message);
    refuseAlwaysSelected(options.configurations, manifests);
    findScopeTable(edit.input.table, options.scope);
    const scopeSettings =
        options.scope === undefined
            ? edit.settings
            : (edit.settings.scopes[options.scope] as Settings['scopes'][string]);
    return { ...edit, scopeSettings, manifests };
}

/**
 * Look up a setting in one scope with the settings that this edit already validated.
 * @param repositoryRoot the folder for Git detection and automatic configuration choice.
 * @param input the state from before the edit.
 * @param input.input the settings text and table before the edit.
 * @param input.settings the parsed gspot.toml before the edit.
 * @param input.reads the file cache for the lookup.
 * @param key the dotted setting name.
 * @param scope the folder to look in, or the root when absent.
 * @returns the declaration and defaults for that scope.
 */
export function findSettingDeclaration(
    repositoryRoot: string,
    input: { input: SettingsEdit; settings: Settings; reads: ReadCache },
    key: string,
    scope: string | undefined,
): { settings: Settings; known: KnownSettings; match: DeclarationMatch } {
    if (['configurations', 'removed_configurations'].includes(key))
        throw new GspotError('arguments', 'Use gspot add or gspot remove to change configurations.');
    findScopeTable(input.input.table, scope);
    const { settings, reads } = input;
    const manifests = readManifests(reads);
    const hasGit = isGitRepository(repositoryRoot);
    const general = new Map([...manifests].filter(([, manifest]) => manifest.configuration.group === 'general'));
    const automatic = detectConfigurations(repositoryRoot, [], general, []).flatMap(({ configuration }) =>
        manifests.get(configuration)?.configuration.when?.git !== true || hasGit ? [configuration] : [],
    );
    const effective = { ...settings, configurations: [...new Set([...settings.configurations, ...automatic])] };
    const known = buildKnownSettings(selectForScope(effective, scope ?? '', manifests), settings.level, reads);
    const match = findDeclaration(known, key);
    if (match === undefined) {
        const selectedScope = Object.keys(settings.scopes).find(
            (path) =>
                findDeclaration(
                    buildKnownSettings(selectForScope(effective, path, manifests), settings.level, reads),
                    key,
                ) !== undefined,
        );
        if (selectedScope !== undefined)
            throw new GspotError(
                'arguments',
                `A configuration has the setting \`${key}\` in the scope \`${selectedScope}\`; add --scope ${quoteArgument(selectedScope)}.`,
            );
        throw new GspotError('arguments', formatUnknownSetting(known, key));
    }
    return { settings, known, match };
}

export { saveSettings, formatApplyReport, startSettingsEdit };
