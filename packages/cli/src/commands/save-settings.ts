import { emitAll } from '#cli/generation/files.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { formatNotes } from '#cli/system/terminal.ts';
import { openSession } from '#cli/commands/session.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { findRoot } from '#cli/repository/find-root.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { assertVersionPin } from '#cli/apply/version-pin.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { SettingsEdit } from '#cli/types/settings/file.ts';
import { editSettings, readSettingsEdit } from '#cli/settings/edit.ts';
import type { SaveSettingsResult, SaveSettingsOptions } from '#cli/types/commands/save-settings.ts';

/**
 * Edit settings, check them, and write them and their generated files. Installs nothing.
 * @param root the repository root
 * @param options the settings edit and its summary
 * @returns the apply report and whether the written settings changed
 */
async function saveSettings(root: string, options: SaveSettingsOptions): Promise<SaveSettingsResult> {
    const { input, change, summary } = options;
    using log = openWriter(root);
    const result = editSettings(root, input, change);
    const session = await openSession(root, { settings: result.settings, text: result.text });
    const generated = emitAll(session);
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
        text: `${summary === '' ? '' : summary + '\n'}${reportText(report)}`,
        json: { ...report, changed: result.changed },
        exitCode: 0,
    };
}

/**
 * Format generated file changes and notes for command output.
 * @param report the applied file changes and notes.
 * @returns the report text.
 */
function reportText(report: ApplyReport): string {
    const lines = [
        ...report.written.map((path) => `wrote    ${path}`),
        ...report.updated.map((path) => `updated  ${path}`),
        ...report.removed.map((path) => `removed  ${path}`),
    ];
    if (lines.length === 0 && report.notes.length === 0)
        lines.push(`everything up to date (${String(report.unchanged.length)} files)`);
    return `${lines.length === 0 ? '' : lines.join('\n') + '\n'}${formatNotes(report.notes)}`;
}

/**
 * Capture settings and verify the pinned CLI before a command edits them.
 * @param cwd the current folder
 * @returns the repository root and captured settings edit
 */
async function startSettingsEdit(cwd: string): Promise<{ root: string; input: SettingsEdit }> {
    const root = findRoot(cwd);
    const input = readSettingsEdit(root);
    await assertVersionPin(root);
    return { root, input };
}

/**
 * Refuse explicit edits to configurations that gspot selects itself.
 * @param names the configuration names
 * @param manifests the configuration declarations
 */
function refuseAlwaysSelected(names: string[], manifests: Map<string, Manifest>): void {
    const name = names.find((entry) => manifests.get(entry)?.configuration.always_selected === true);
    if (name !== undefined)
        throw new GspotError(
            'arguments',
            `gspot selects ${name} by itself when the repository needs it, so you cannot add or remove it. To run more or fewer of its checks, run gspot set level. To turn one check off, run gspot ignore.`,
        );
}

export { reportText, saveSettings, startSettingsEdit, refuseAlwaysSelected };
