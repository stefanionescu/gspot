import { emitAll } from '#cli/generation/files.ts';
import { findStaleFiles } from '#cli/apply/stale.ts';
import { type StaleFile } from '#cli/types/apply.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { type Session } from '#cli/types/planning.ts';
import { openSession } from '#cli/commands/session.ts';
import { findRoot } from '#cli/repository/find-root.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { type Command } from '@commander-js/extra-typings';
import { readVersionPin } from '#cli/apply/version-pin.ts';
import { reportText } from '#cli/commands/save-settings.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { noteLines, printResult } from '#cli/system/terminal.ts';
import { type DryRunJson, type ApplyOptions } from '#cli/types/commands/save-settings.ts';

function staleFilesText(drift: StaleFile[]): string {
    const noun = drift.length === 1 ? 'file' : 'files';
    const lines = [`${String(drift.length)} generated ${noun} need updating:`, ''];
    for (const entry of drift) {
        const differences = (entry.diff ?? '').split('\n').map((line) => `    ${line}`);
        lines.push(`  ${entry.path}  ${entry.kind}`);
        if ((entry.diff ?? '') !== '') lines.push(...differences);
    }
    lines.push(
        '',
        'Run gspot apply to write these files. apply keeps a generated file you edited; move it aside to get the new version.',
    );
    return `${lines.join('\n')}\n`;
}

function planApply(session: Session): CommandResult {
    const generated = emitAll(session);
    const drift = findStaleFiles(session, generated);
    const summary = drift.length === 0 ? 'every generated file is up to date\n' : staleFilesText(drift);
    const text = summary + noteLines(generated.notes);
    const pin = { from: readVersionPin(session.root), to: session.version };
    const json: DryRunJson = { dryRun: true, pin, drift, notes: generated.notes };
    const version = pin.from === pin.to ? '' : `version ${pin.from ?? 'unpinned'} -> ${pin.to}\n`;
    return { text: `${version}${text}`, json, exitCode: 0 };
}

/**
 * Register the apply command.
 * @param program the command program
 */
export function registerApply(program: Command): void {
    program
        .command('apply')
        .summary(COMMAND_HELP.apply.summary)
        .description(COMMAND_HELP.apply.description)
        .option('--dry-run', COMMAND_HELP.apply.options['--dry-run'])
        .action(async (flags) => {
            printResult(
                await applyCommand({
                    cwd: process.cwd(),
                    isDryRun: flags.dryRun === true,
                }),
            );
        });
}

/**
 * Writes generated files or shows planned changes without writing.
 * @param options the parsed flags
 * @returns the command result
 */
export async function applyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    if (options.isDryRun) {
        const result = planApply(session);
        return { ...result, text: `${result.text}Dry run: nothing was written.\n` };
    }
    using log = openWriter(root);
    const report = writeGeneratedFiles(session, emitAll(session), log);
    return { text: reportText(report), json: report, exitCode: 0 };
}
