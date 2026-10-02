// The check command's flags, its pre-push input, and the cancellation the termination signals cause.
import { addAbortSignal } from 'node:stream';
import { progress } from '#cli/output/reporter.ts';
import { checkCommand } from '#cli/commands/check/run.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import type { Stage } from '#cli/types/execution/planning.ts';
import { ERROR_EXIT } from '#cli/config/platform/platform.ts';
import { PUBLIC_STAGES } from '#cli/config/commands/check.ts';
import type { CheckOptions } from '#cli/types/commands/check.ts';
import { Option, Command, InvalidArgumentError } from 'commander';
import type { CommandResult } from '#cli/types/commands/commands.ts';
import type { StageFilter } from '#cli/types/execution/execution.ts';
import { listFlag, textFlag, textEntry, directoryOf } from '#cli/commands/flags.ts';

// Git gives the pre-push hook the remote name and the remote URL.
const PUSH_ARGUMENTS = 2;

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
        paths,
        ...(only === undefined ? {} : { only }),
        ...(typeof flags['changed'] === 'string' ? { changed: flags['changed'] } : {}),
        ...(stage === undefined ? {} : { stage }),
        ...textEntry(flags, 'messageFile', 'messageFile'),
    };
}

// Reads the pre-push protocol from standard input, stopping when the run is canceled.
async function readPushInput(signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let input = '';
    try {
        for await (const chunk of addAbortSignal(signal, process.stdin) as AsyncIterable<Buffer>)
            input += decoder.decode(chunk, { stream: true });
    } catch (error) {
        signal.throwIfAborted();
        throw error;
    }
    return input + decoder.decode();
}

// Turns the pre-push invocation into check options: Git's remote name and the object updates on standard input.
async function pushOptions(options: CheckOptions, paths: string[], signal: AbortSignal): Promise<CheckOptions> {
    if (paths.length > 0 && paths.length !== PUSH_ARGUMENTS)
        throw new InvalidArgumentError('Pre-push expects the remote name and URL supplied by Git.');
    const input = await readPushInput(signal);
    return { ...options, paths: [], push: { input, ...(paths[0] === undefined ? {} : { remote: paths[0] }) } };
}

// Runs check, or reports the cancellation when the signal fired before every selected content was checked.
async function checkedCommand(
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
            json: { error: 'canceled', exitCode: ERROR_EXIT },
            exitCode: ERROR_EXIT,
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
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: The signal handlers and the finally block all call this one cancellation.
    const cancel = (): void => {
        controller.abort();
    };
    process.on('SIGINT', cancel);
    process.on('SIGTERM', cancel);
    try {
        await printCommand(() => checkedCommand(options, paths, flags['push'] === true, controller.signal), global);
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
        .summary('Run the checks')
        .description('Run checks over the selected files and folders and print findings')
        .addHelpText(
            'after',
            '\nEffects:\nRuns the selected checks and prints each finding with its file, line, rule, and help. --json prints the report as JSON. A plain check reads the working tree, --staged reads the staged files, and --changed reads the files changed since a branch. --fix runs the fixers and can change your source files. --fix --dry-run shows those changes in a copy.\n\nExit codes:\n- 0: every check that ran passed. The report lists the skipped checks.\n- 1: findings remain, or a fix failed.\n- 2: the run could not finish: a tool is missing, a report is invalid, or the input is invalid.\n\nExample:\ngspot check --staged',
        )
        .option('--only <checks...>', 'Run only these checks')
        .addOption(new Option('--push', 'Read Git pre-push object updates from stdin').hideHelp())
        .option('--staged', 'Check the staged files, as the commit hook does')
        .option(
            '--changed [ref]',
            'Check the files changed from the upstream or default branch, or from --changed=<ref>',
        )
        .option('--fix', 'Run every fixer, then run the checks again')
        .option('--dry-run', 'With --fix, print the diff of each fix and write nothing')
        .addOption(
            new Option('--stage <stage>', 'Run the checks of one stage')
                .choices(PUBLIC_STAGES)
                .argParser(stageArgument),
        )
        .option('--skip <checks...>', 'Skip these checks for this run')
        .addOption(new Option('--message-file <path>', 'The commit message file, for the message stage').hideHelp())
        .action(async (paths: string[], flags: Record<string, unknown>, command: Command) => {
            await runCheck(paths, flags, command.optsWithGlobals());
        });
}
