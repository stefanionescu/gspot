// Validate settings edits and write their generated files.

import { openSession } from '#cli/session.ts';
import { formatCount } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { writeSettings } from '#cli/settings/file.ts';
import { formatNotes } from '#cli/system/terminal.ts';
import { generate } from '#cli/generation/generate.ts';
import { updateSettings } from '#cli/settings/edit.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import type { SaveSettingsResult, SaveSettingsOptions } from '#cli/types/commands/settings.ts';

/**
 * Edit settings, check them, and write them and their generated files. Installs nothing.
 *
 * @param repositoryRoot the folder where gspot writes settings and generated files.
 * @param options the settings edit and its summary
 * @returns the apply report and whether the written settings changed
 */
async function saveSettings(repositoryRoot: string, options: SaveSettingsOptions): Promise<SaveSettingsResult> {
    const { input, summary } = options;
    using writer = openWriter(repositoryRoot);
    const result = updateSettings(repositoryRoot, input);
    const session = await openSession(repositoryRoot, {
        settingsFile: { settings: result.settings, text: result.text },
    });
    const generated = generate(session);
    writeSettings(writer, result.text, input.original);
    let report: ApplyReport;
    try {
        report = writeGeneratedFiles(session, generated, writer);
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
    const shown = result.changed ? summary : 'No change: gspot.toml already has this value.';
    return {
        text: `${shown === '' ? '' : shown + '\n'}${formatApplyReport(report)}`,
        json: { ...report, changed: result.changed },
        exitCode: 0,
    };
}

/**
 * Say that the generated files need no change.
 *
 * @param count how many files gspot generates.
 * @returns the sentence, with the verb agreeing with the count.
 */
function formatUpToDate(count: number): string {
    return `No change: the ${formatCount(count, 'generated file')} ${count === 1 ? 'is' : 'are'} up to date.`;
}

/**
 * Format generated file changes and notes for command output.
 *
 * @param report the applied file changes and notes.
 * @returns the report text.
 */
function formatApplyReport(report: ApplyReport): string {
    const lines = [
        ...report.written.map((path) => `wrote    ${path}`),
        ...report.updated.map((path) => `updated  ${path}`),
        ...report.removed.map((path) => `removed  ${path}`),
    ];
    if (lines.length === 0 && report.notes.length === 0) lines.push(formatUpToDate(report.unchanged.length));
    return `${lines.length === 0 ? '' : lines.join('\n') + '\n'}${formatNotes(report.notes)}`;
}

export { saveSettings, formatUpToDate, formatApplyReport };
