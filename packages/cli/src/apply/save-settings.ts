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
import type { SettingsEdit } from '#cli/types/settings/file.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { formatCount, quoteArgument } from '#cli/system/text.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { findScopeTable, updateSettings, readSettingsEdit } from '#cli/settings/edit.ts';
import { refuseAlwaysSelected, listUnknownConfigurations } from '#cli/configurations/select.ts';
import type { SaveSettingsResult, SaveSettingsOptions } from '#cli/types/commands/edit-settings.ts';
import { type Settings, type KnownSettings, type DeclarationMatch } from '#cli/types/settings/values.ts';
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
 * Capture and validate settings once before a command edits them.
 * @param cwd the folder where the command starts.
 * @returns the repository root, original settings, and reads for one edit.
 */
function startSettingsEdit(cwd: string): { root: string; input: SettingsEdit; settings: Settings; reads: ReadCache } {
    const root = findRoot(cwd);
    const input = readSettingsEdit(root);
    const reads = createReadCache(root);
    const settings = parseSettings(input.text, root, reads);
    return { root, input, settings, reads };
}

/**
 * Validate the configuration names shared by add and remove before either command edits a list.
 * @param cwd the folder where the command starts.
 * @param names the configuration names supplied to the command.
 * @returns the validated configuration edit and its shipped manifests.
 */
export function startConfigurationEdit(
    cwd: string,
    names: string[],
): {
    root: string;
    input: SettingsEdit;
    settings: Settings;
    reads: ReadCache;
    manifests: Map<string, Manifest>;
} {
    const edit = startSettingsEdit(cwd);
    const manifests = readManifests(edit.reads);
    const [unknown] = listUnknownConfigurations(
        names.map((name) => ({ name })),
        manifests,
    );
    if (unknown !== undefined) throw new GspotError('arguments', unknown.message);
    refuseAlwaysSelected(names, manifests);
    return { ...edit, manifests };
}

/**
 * Look up a setting in its selected scope using the settings already validated for this edit.
 * @param repositoryRoot the folder for Git detection and automatic configuration selection.
 * @param input the validated settings and original file captured before the edit.
 * @param input.input the original settings text and editable table.
 * @param input.settings the parsed settings before the edit.
 * @param input.reads the file reads shared with setting lookup.
 * @param key the dotted setting name supplied by the command.
 * @param scope the selected repository-relative scope, or the root when omitted.
 * @returns the selected declaration and defaults for the validated scope.
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
