// gspot check
import type { Command } from 'commander';

import { emit } from '#cli/commands/emit.ts';
import { checkCommand } from '#cli/run/check.ts';
import type { CheckOptions } from '#cli/run/check.ts';
import type { StageFilter } from '#cli/run/plan.ts';

/** Registers check. */
export function registerCheck(program: Command): void {
    program
        .command('check [check-id]')
        .description('Run the checks and print findings; one check when its id is given')
        .option('--staged', 'The commit stage over staged files, as the pre-commit hook runs it')
        .option('--since <ref>', 'Commit and push stages over files changed since a git ref')
        .option('--fix', 'Run every fixer in order, then the checks again')
        .option('--dry-run', 'With --fix, print the diff of every fix and write nothing')
        .option('--stage <stage>', 'One stage: commit, push, manual or message')
        .option('--scope <path>', 'One scope only')
        .option(
            '--skip <check-id>',
            'Skip one check this run; repeat for more',
            (value: string, previous: string[] = []) => [...previous, value],
        )
        .option('--message-file <path>', 'The commit message file, for the message stage')
        .option('--no-cache', 'Run every check even when its inputs are unchanged')
        .action(async (checkId: string | undefined, flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            const options: CheckOptions = {
                cwd: String(global['directory'] ?? process.cwd()),
                staged: Boolean(flags['staged']),
                fix: Boolean(flags['fix']),
                dryRun: Boolean(flags['dryRun']),
                skips: (flags['skip'] as string[] | undefined) ?? [],
                quiet: Boolean(global['quiet']),
                verbose: Boolean(global['verbose']),
                noCache: flags['cache'] === false,
                ...(checkId !== undefined ? { check: checkId } : {}),
                ...(flags['since'] ? { since: String(flags['since']) } : {}),
                ...(flags['stage'] ? { stage: flags['stage'] as StageFilter } : {}),
                ...(flags['scope'] ? { scope: String(flags['scope']).replace(/\/$/, '') } : {}),
                ...(flags['messageFile'] ? { messageFile: String(flags['messageFile']) } : {}),
            };
            await emit(() => checkCommand(options), global);
        });
}
