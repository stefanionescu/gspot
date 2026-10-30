import { formatCount } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import { type Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { TOOL_LOCKFILES } from '#cli/config/files/gspot.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { listOutdatedFiles } from '#cli/generation/outdated.ts';
import type { OutdatedFile } from '#cli/types/generation/files.ts';
import { GENERATED_FILE_NOUN } from '#cli/config/generation/write.ts';
import type { DryRunJson, ApplyOptions } from '#cli/types/commands/apply.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { formatUpToDate, formatApplyReport, writeGeneratedFiles } from '#cli/generation/write.ts';
import { DRY_RUN_FLAG, DRY_RUN_NOTE, APPLY_WRITE_MESSAGE, INSTALL_WRITE_MESSAGE } from '#cli/config/commands/apply.ts';

function formatFileChanges(files: OutdatedFile[], repair: string): string[] {
    if (files.length === 0) return [];
    const lines: string[] = [];
    for (const file of files) {
        lines.push(`  ${file.path}  ${file.kind}`);
        if (file.diff !== undefined && file.diff !== '')
            lines.push(...file.diff.split('\n').map((line) => `    ${line}`));
    }
    return [...lines, '', repair, ''];
}

function formatOutdatedFiles(files: OutdatedFile[]): string {
    const lines = [
        `${formatCount(files.length, GENERATED_FILE_NOUN)} ${files.length === 1 ? 'needs' : 'need'} updating:`,
        '',
    ];
    const groups = [
        {
            files: files.filter(({ path }) => !TOOL_LOCKFILES.has(path)),
            repair: APPLY_WRITE_MESSAGE,
        },
        {
            files: files.filter(({ path }) => TOOL_LOCKFILES.has(path)),
            repair: INSTALL_WRITE_MESSAGE,
        },
    ];
    for (const group of groups) lines.push(...formatFileChanges(group.files, group.repair));
    return `${lines.join('\n')}\n`;
}

async function buildDryRunResult(session: Session): Promise<CommandResult> {
    const generated = generateFiles(session);
    const outdatedFiles = await listOutdatedFiles(session, generated);
    const summary =
        outdatedFiles.length === 0 ? `${formatUpToDate(generated.files.length)}\n` : formatOutdatedFiles(outdatedFiles);
    const json: DryRunJson = { dryRun: true, outdated: outdatedFiles };
    return { text: `${summary}${DRY_RUN_NOTE}\n`, json, exitCode: 0 };
}

async function runApplyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = await readRepositoryRoot(options.cwd);
    const session = await openSession(root);
    if (options.dryRun) return buildDryRunResult(session);
    const writer = openFiles(root);
    const report = await writeGeneratedFiles(session, generateFiles(session), writer);
    return { text: formatApplyReport(report), json: report, exitCode: 0 };
}

/**
Register the apply command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerApply(program: Command, onResult: CommandCompletion): void {
    program
        .command('apply')
        .summary(COMMAND_HELP.apply.summary)
        .description(COMMAND_HELP.apply.description)
        .option(DRY_RUN_FLAG, COMMAND_HELP.apply.options[DRY_RUN_FLAG])
        .action(async (flags) => {
            onResult(
                await runApplyCommand({
                    cwd: process.cwd(),
                    dryRun: flags.dryRun === true,
                }),
            );
        });
}
