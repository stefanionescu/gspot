import type { Command } from 'commander';
import type { Stage } from '#types/manifest.ts';
// gspot check
import { Option, InvalidArgumentError } from 'commander';
import { checkCommand } from '#cli/run/check-command.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import type { StageFilter, CheckOptions } from '#types/run.ts';
import { directoryOf, listFlag, textEntry, textFlag } from '#cli/commands/flags.ts';

const PUBLIC_STAGES: Stage[] = ['commit', 'push', 'manual'];

function stageArgument(value: string): Stage {
    if (value === 'message') return value;
    const stage = PUBLIC_STAGES.find((entry) => entry === value);
    if (stage === undefined) throw new InvalidArgumentError(`Choose ${PUBLIC_STAGES.join(', ')}.`);
    return stage;
}

function optionsFrom(paths: string[], flags: Record<string, unknown>, global: Record<string, unknown>): CheckOptions {
    const stage = textFlag(flags, 'stage') as StageFilter | undefined;
    const scope = textFlag(flags, 'scope');
    const only = listFlag(flags, 'only');
    return {
        cwd: directoryOf(global),
        staged: flags['staged'] === true,
        fix: flags['fix'] === true,
        isDryRun: flags['dryRun'] === true,
        skips: listFlag(flags, 'skip') ?? [],
        quiet: global['quiet'] === true,
        verbose: global['verbose'] === true,
        noCache: flags['cache'] === false,
        paths,
        ...(only === undefined ? {} : { only }),
        ...textEntry(flags, 'since', 'since'),
        ...(stage === undefined ? {} : { stage }),
        ...(scope === undefined ? {} : { scope: scope.endsWith('/') ? scope.slice(0, -1) : scope }),
        ...textEntry(flags, 'messageFile', 'messageFile'),
    };
}

/**
 * Registers check.
 * @param program the commander program
 */
export function registerCheck(program: Command): void {
    program
        .command('check [paths...]')
        .description('Run checks over the selected files and folders and print findings')
        .option('--only <checks...>', 'Run the named checks')
        .option('--staged', 'The commit stage over staged files, as the pre-commit hook runs it')
        .option('--since <ref>', 'Commit and push stages over files changed since a git ref')
        .option('--fix', 'Run every fixer in order, then the checks again')
        .option('--dry-run', 'With --fix, print the diff of every fix and write nothing')
        .addOption(new Option('--stage <stage>', 'One stage').choices(PUBLIC_STAGES).argParser(stageArgument))
        .option('--scope <path>', 'One scope only')
        .option('--skip <checks...>', 'Skip the named checks for this run')
        .addOption(new Option('--message-file <path>', 'The commit message file, for the message stage').hideHelp())
        .option('--no-cache', 'Run every check even when its inputs are unchanged')
        .action(async (paths: string[], flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => checkCommand(optionsFrom(paths, flags, global)), global);
        });
}
