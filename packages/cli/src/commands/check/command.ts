// The check command's flags, its pre-push input, and the cancellation the termination signals cause.
import { progress } from '#cli/output/reporter.ts';
import type { Stage } from '#cli/types/configurations.ts';
import { checkCommand } from '#cli/commands/check/run.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import type { CheckOptions } from '#cli/types/commands/check.ts';
import { Command, InvalidArgumentError, Option } from 'commander';
import type { CommandResult } from '#cli/types/commands/commands.ts';
import type { StageFilter } from '#cli/types/execution/execution.ts';
import { CANCELED_EXIT, PUBLIC_STAGES } from '#cli/constants/commands/check.ts';
import { directoryOf, listFlag, textEntry, textFlag } from '#cli/platform/arguments.ts';

class CheckCommand extends Command {
    override parseOptions(argv: string[]): {
        operands: string[];
        unknown: string[];
    } {
        const end = argv.indexOf('--');
        return super.parseOptions(
            argv.map((argument, index) =>
                argument === '--changed' && (end === -1 || index < end) ? '--changed=' : argument,
            ),
        );
    }
}

function stageArgument(value: string): Stage {
    if (value === 'message') return value;
    const stage = PUBLIC_STAGES.find((entry) => entry === value);
    if (stage === undefined) throw new InvalidArgumentError(`Choose ${PUBLIC_STAGES.join(', ')}.`);
    return stage;
}

function optionsFrom(paths: string[], flags: Record<string, unknown>, global: Record<string, unknown>): CheckOptions {
    const stage = textFlag(flags, 'stage') as StageFilter | undefined;
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
        ...(typeof flags['changed'] === 'string' ? { changed: flags['changed'] } : {}),
        ...(stage === undefined ? {} : { stage }),
        ...textEntry(flags, 'messageFile', 'messageFile'),
    };
}

// Reads the pre-push protocol from standard input, stopping when the run is canceled.
async function readPushInput(signal: AbortSignal): Promise<string> {
    const reader = Bun.stdin.stream().getReader();
    let cancellation: Promise<void> | undefined;
    const stopReading = (): void => {
        cancellation = reader.cancel();
    };
    signal.addEventListener('abort', stopReading, { once: true });
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let input = '';
    try {
        signal.throwIfAborted();
        for (;;) {
            const chunk = await reader.read();
            signal.throwIfAborted();
            if (chunk.done) break;
            input += decoder.decode(chunk.value, { stream: true });
        }
        return input + decoder.decode();
    } finally {
        signal.removeEventListener('abort', stopReading);
        await cancellation;
        reader.releaseLock();
    }
}

// Turns the pre-push invocation into check options: Git's remote name and the object updates on standard input.
async function pushOptions(options: CheckOptions, paths: string[], signal: AbortSignal): Promise<CheckOptions> {
    if (paths.length > 0 && paths.length !== 2)
        throw new InvalidArgumentError('Pre-push expects the remote name and URL supplied by Git.');
    const input = await readPushInput(signal);
    return { ...options, paths: [], push: { input, ...(paths[0] === undefined ? {} : { remote: paths[0] }) } };
}

// Runs check, or reports the cancellation when the signal fired before every selected content was checked.
async function runOrCancel(
    options: CheckOptions,
    paths: string[],
    isPush: boolean,
    signal: AbortSignal,
): Promise<CommandResult> {
    try {
        const selected = isPush ? await pushOptions(options, paths, signal) : options;
        return await checkCommand(selected, signal);
    } catch (error) {
        if (!signal.aborted) throw error;
        return {
            text: 'Check canceled before all selected content was checked.\n',
            json: { error: 'canceled', exitCode: CANCELED_EXIT },
            exitCode: CANCELED_EXIT,
        };
    }
}

// Runs check with an abort signal wired to the termination signals for the duration of the run.
async function runCheck(
    paths: string[],
    flags: Record<string, unknown>,
    global: Record<string, unknown>,
): Promise<void> {
    const options = optionsFrom(paths, flags, global);
    if (global['json'] !== true) options.onResult = progress(process.stdout, options.quiet);
    const controller = new AbortController();
    const cancel = (): void => {
        controller.abort();
    };
    process.on('SIGINT', cancel);
    process.on('SIGTERM', cancel);
    try {
        await printCommand(() => runOrCancel(options, paths, flags['push'] === true, controller.signal), global);
    } finally {
        process.removeListener('SIGINT', cancel);
        process.removeListener('SIGTERM', cancel);
    }
}

/**
 * Registers check.
 * @param program the commander program
 */
export function registerCheck(program: Command): void {
    const command = new CheckCommand('check').copyInheritedSettings(program);
    program.addCommand(command);
    command
        .argument('[paths...]')
        .summary('Run checks')
        .description('Run checks over the selected files and folders and print findings')
        .addHelpText(
            'after',
            '\nEffects:\nRuns the selected checks and writes managed reports and cache observations. --fix runs configured corrections and can change selected source files. --fix --dry-run previews corrections in a disposable copy. --staged checks index content; --changed checks working-tree content for paths changed from the comparison reference. A plain check uses the working tree.\n\nExit codes:\n0: executed checks passed; review skipped checks separately. 1: findings or failed corrections remain. 2: the run could not complete, including missing tools, invalid reports, or invalid input.\n\nExample:\ngspot check --staged',
        )
        .option('--only <checks...>', 'Run the named checks')
        .addOption(new Option('--push', 'Read Git pre-push object updates from stdin').hideHelp())
        .option('--staged', 'The commit stage over staged files, as the pre-commit hook runs it')
        .option(
            '--changed [ref]',
            'Changed paths from the upstream or default branch; use --changed=<ref> to choose a ref',
        )
        .option('--fix', 'Run every fixer in order, then the checks again')
        .option('--dry-run', 'With --fix, print the diff of every fix and write nothing')
        .addOption(new Option('--stage <stage>', 'One stage').choices(PUBLIC_STAGES).argParser(stageArgument))
        .option('--skip <checks...>', 'Skip the named checks for this run')
        .addOption(new Option('--message-file <path>', 'The commit message file, for the message stage').hideHelp())
        .option('--no-cache', 'Run every check even when its inputs are unchanged')
        .action(async (paths: string[], flags: Record<string, unknown>, command: Command) => {
            await runCheck(paths, flags, command.optsWithGlobals());
        });
}
