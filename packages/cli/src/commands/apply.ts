import { openSession } from '#cli/session.ts';
import { formatCount } from '#cli/system/text.ts';
import { findRoot } from '#cli/repository/read.ts';
import { listStaleFiles } from '#cli/apply/stale.ts';
import { type StaleFile } from '#cli/types/apply.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { formatNotes } from '#cli/system/terminal.ts';
import { type Session } from '#cli/types/planning.ts';
import { generate } from '#cli/generation/generate.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { type Command } from '@commander-js/extra-typings';
import { readVersionPin } from '#cli/apply/version-pin.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { formatApplyReport } from '#cli/apply/save-settings.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { type DryRunJson, type ApplyOptions } from '#cli/types/commands/edit-settings.ts';

function formatStaleFiles(staleFiles: StaleFile[]): string {
    const lines = [`${formatCount(staleFiles.length, 'generated file')} need updating:`, ''];
    for (const entry of staleFiles) {
        const differences = (entry.diff ?? '').split('\n').map((line) => `    ${line}`);
        lines.push(`  ${entry.path}  ${entry.kind}`);
        if ((entry.diff ?? '') !== '') lines.push(...differences);
    }
    lines.push('', 'Run gspot apply to write these files.');
    return `${lines.join('\n')}\n`;
}

function planApply(session: Session): CommandResult {
    const generated = generate(session);
    const staleFiles = listStaleFiles(session, generated);
    const summary =
        staleFiles.length === 0
            ? `No change: the ${formatCount(generated.files.length, 'generated file')} are up to date.\n`
            : formatStaleFiles(staleFiles);
    const text = summary + formatNotes(generated.notes);
    const pin = { from: readVersionPin(session.root), to: session.version };
    const json: DryRunJson = { dryRun: true, pin, stale: staleFiles, notes: generated.notes };
    const version = pin.from === pin.to ? '' : `version ${pin.from ?? 'unpinned'} -> ${pin.to}\n`;
    return { text: `${version}${text}`, json, exitCode: 0 };
}

/**
 * Register the apply command.
 * @param program the command program
 * @param onResult the sink that writes the completed command result.
 */
function registerApply(program: Command, onResult: CommandCompletion): void {
    program
        .command('apply')
        .summary(COMMAND_HELP.apply.summary)
        .description(COMMAND_HELP.apply.description)
        .option('--dry-run', COMMAND_HELP.apply.options['--dry-run'])
        .action(async (flags) => {
            onResult(
                await runApplyCommand({
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
async function runApplyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    if (options.isDryRun) {
        const result = planApply(session);
        return { ...result, text: `${result.text}Dry run: nothing was written.\n` };
    }
    using log = openWriter(root);
    const report = writeGeneratedFiles(session, generate(session), log);
    return { text: formatApplyReport(report), json: report, exitCode: 0 };
}

export { registerApply };
