import { gt } from 'semver';
import { openWriter } from '#cli/write.ts';
import { openSession } from '#cli/session.ts';
import { formatCount } from '#cli/system/text.ts';
import { type Session } from '#cli/types/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { type Command } from '@commander-js/extra-typings';
import cliPackage from '#cli-package' with { type: 'json' };
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { TOOL_LOCKFILES } from '#cli/config/gspot-folder.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { DRY_RUN_NOTE } from '#cli/config/commands/dry-run.ts';
import { listOutdatedFiles } from '#cli/generation/outdated.ts';
import { type OutdatedFile } from '#cli/types/generation/files.ts';
import { readVersionPin, assertVersionPin } from '#cli/repository/version-pin.ts';
import { type DryRunJson, type ApplyOptions } from '#cli/types/commands/apply.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { formatUpToDate, formatApplyReport, writeGeneratedFiles } from '#cli/generation/write.ts';

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

function formatOutdatedFiles(outdatedFiles: OutdatedFile[]): string {
    const lines = [
        `${formatCount(outdatedFiles.length, 'generated file')} ${outdatedFiles.length === 1 ? 'needs' : 'need'} updating:`,
        '',
    ];
    const groups = [
        {
            files: outdatedFiles.filter(({ path }) => !TOOL_LOCKFILES.has(path)),
            repair: 'Run gspot apply to write these files.',
        },
        {
            files: outdatedFiles.filter(({ path }) => TOOL_LOCKFILES.has(path)),
            repair: 'Run gspot install to write the tool lockfiles.',
        },
    ];
    for (const group of groups) lines.push(...formatFileChanges(group.files, group.repair));
    return `${lines.join('\n')}\n`;
}

async function buildDryRunResult(session: Session): Promise<CommandResult> {
    const generated = generate(session);
    const outdatedFiles = await listOutdatedFiles(session, generated);
    const summary =
        outdatedFiles.length === 0 ? `${formatUpToDate(generated.files.length)}\n` : formatOutdatedFiles(outdatedFiles);
    const pin = { from: readVersionPin(session.root), to: cliPackage.version };
    const json: DryRunJson = { dryRun: true, pin, outdated: outdatedFiles };
    const version = pin.from === pin.to ? '' : `version ${pin.from ?? 'unpinned'} -> ${pin.to}\n`;
    return { text: `${version}${summary}${DRY_RUN_NOTE}\n`, json, exitCode: 0 };
}

async function runApplyCommand(options: ApplyOptions): Promise<CommandResult> {
    const root = readRepositoryRoot(options.cwd);
    const pin = readVersionPin(root);
    if (pin !== undefined && gt(pin, cliPackage.version)) assertVersionPin(root);
    const session = await openSession(root);
    if (options.isDryRun) return buildDryRunResult(session);
    using writer = openWriter(root);
    const report = await writeGeneratedFiles(session, generate(session), writer);
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
