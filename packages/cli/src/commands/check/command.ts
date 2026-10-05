// The check command's flags, its pre-push input, and the cancellation the termination signals cause.
import { readFileSync } from 'node:fs';
import { addAbortSignal } from 'node:stream';
import { resolve, relative } from 'node:path';
import { compact } from '#cli/platform/objects.ts';
import { progress } from '#cli/output/reporter.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { checkTree } from '#cli/commands/check/tree.ts';
import type { CommandResult } from '#cli/types/output.ts';
import { EXIT_ERROR } from '#cli/config/platform/runtime.ts';
import { Option, Command } from '@commander-js/extra-typings';
import { PUSH_ARGUMENTS } from '#cli/config/commands/options.ts';
import { getStaged } from '#cli/repository/revisions/changes.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { findRoot, isGitRepository } from '#cli/repository/root.ts';
import { checkOutRevision } from '#cli/execution/snapshot/revision.ts';
import { printResult, selectVerbosity } from '#cli/output/messages.ts';
import type { Program, GlobalFlags } from '#cli/types/commands/program.ts';
import { HOOKS, CHECK_FLAG_DEFAULTS } from '#cli/config/commands/check.ts';
import { checkPush, assertPushOptions } from '#cli/commands/check/push.ts';
import type { CheckFlags, CheckOptions } from '#cli/types/commands/check.ts';

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
        throw new GspotError('selection', ['Pre-push expects the remote name and URL supplied by Git.']);
    // A refused flag stops the run before it waits for input that a terminal may never send.
    assertPushOptions(options);
    const input = await readPushInput(signal);
    return { ...options, paths: [], push: { stdin: input, ...(paths[0] === undefined ? {} : { remote: paths[0] }) } };
}

// Checks an exact staged-index snapshot and writes the report in the working repository.
async function checkStaged(root: string, options: CheckOptions, signal: AbortSignal): Promise<CommandResult> {
    if (options.fix)
        throw new GspotError('selection', [
            'Staged checks do not run fixers. Run gspot check --fix and stage the reviewed changes.',
        ]);
    if (options.changed !== undefined) throw new GspotError('selection', ['Choose --staged or --changed, not both.']);
    const set = await getStaged(root, signal);
    return checkOutRevision(
        root,
        { kind: 'index' },
        async (checkout, tree) => {
            const paths = options.paths.map((path) => relative(root, resolve(options.cwd, path)));
            return checkTree(checkout, { ...options, cwd: checkout, paths }, signal, {
                content: 'index',
                installedRoot: root,
                reference: tree,
                staged: set,
                reportRoot: root,
            });
        },
        signal,
    );
}

// Validate command input and dispatch the selected working tree or exact snapshot.
async function checkCommand(root: string, options: CheckOptions, signal: AbortSignal): Promise<CommandResult> {
    let selected = options;
    if (options.isDryRun && !options.fix) throw new GspotError('selection', ['--dry-run requires --fix.']);
    if (options.stage === 'message' && options.messageFile !== undefined) {
        const commitFile = resolve(options.cwd, options.messageFile);
        selected = { ...options, messageFile: commitFile };
        try {
            readFileSync(commitFile, 'utf8');
        } catch (error) {
            throw new GspotError('selection', [`The commit message file ${commitFile} cannot be read.`], {
                cause: error,
            });
        }
    }
    if (selected.push !== undefined) return await checkPush(root, { ...selected, push: selected.push }, signal);
    return await (selected.staged ? checkStaged(root, selected, signal) : checkTree(root, selected, signal));
}

// Runs check, or reports cancellation before every check finished.
async function runCancelable(
    options: CheckOptions,
    paths: string[],
    isPush: boolean,
    signal: AbortSignal,
): Promise<CommandResult> {
    try {
        const root = findRoot(options.cwd);
        if ((options.staged || isPush || options.changed !== undefined) && !isGitRepository(root))
            throw new GspotError('selection', ['--staged, --changed, and pre-push checks need a Git repository.']);
        const selected = isPush ? await pushOptions(options, paths, signal) : options;
        return await checkCommand(root, selected, signal);
    } catch (error) {
        if (!signal.aborted) throw error;
        return {
            text: 'Check stopped before every check finished.\n',
            json: {
                error: 'canceled',
                message: 'Check stopped before every check finished.',
                exitCode: EXIT_ERROR,
            },
            exitCode: EXIT_ERROR,
        };
    }
}

// Runs check with an abort signal wired to the termination signals for the duration of the run.
async function runCheck(paths: string[], flags: CheckFlags, global: GlobalFlags): Promise<void> {
    const controller = new AbortController();
    const hook = flags.hook ?? HOOKS.find((name) => name === environmentVariables()['GSPOT_HOOK']);

    const cancel = (): void => {
        controller.abort();
    };
    process.on('SIGINT', cancel);
    process.on('SIGTERM', cancel);
    try {
        const cwd = resolve(global.C ?? process.cwd());
        const verbosity = selectVerbosity(global);

        // Git passes a message file to commit-msg; an explicit file selects the same stage.
        const options: CheckOptions = {
            cwd,
            staged: flags.staged === true,
            fix: flags.fix === true,
            isDryRun: flags.dryRun === true,
            skips: flags.skip,
            verbosity,
            paths,
            ...compact({
                hook,
                only: flags.only,
                changed: flags.changed === true ? flags.base : undefined,
                messageFile: flags.messageFile,
                onResult: global.json === true ? undefined : progress(process.stderr, verbosity),
            }),
        };
        if (hook === 'pre-commit') {
            options.stage = 'commit';
            options.staged = true;
        }
        if (flags.messageFile !== undefined || hook === 'commit-msg') options.stage = 'message';
        printResult(await runCancelable(options, paths, hook === 'pre-push', controller.signal));
    } finally {
        process.removeListener('SIGINT', cancel);
        process.removeListener('SIGTERM', cancel);
    }
}

/**
 * Registers check.
 * @param program the commander program
 */
export function registerCheck(program: Program): void {
    const command = new Command<[], CheckFlags, GlobalFlags>('check').copyInheritedSettings(program);
    program.addCommand(command);
    command
        .argument('[paths...]', 'Repository files or folders to check; omit to check all applicable inputs')
        .summary('Run the checks')
        .description(
            'Run the selected checks and print each finding with its file, line, rule, and help. --json prints the report as JSON. A plain check reads the working tree, --staged reads the staged files, and --changed reads the files changed since a branch. --fix runs the fixers and can change your source files. --fix --dry-run shows those changes in a copy.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: every check that ran passed. The report lists the skipped checks.\n- 1: findings remain, or a fix failed.\n- 2: the run could not finish: a tool is missing, a report is invalid, or the input is invalid.\n\nExample:\ngspot check --staged',
        )
        .option('--only <checks...>', 'Run only these checks')
        .option('--staged', 'Check staged files in an exact snapshot of the index')
        .option('--changed', 'Check files changed from the upstream or default branch')
        .addOption(
            new Option('--base <ref>', 'Compare changed files against this Git reference')
                .default(CHECK_FLAG_DEFAULTS.base, 'upstream or default branch')
                .implies({ changed: true }),
        )
        .option('--fix', 'Run every fixer, then run the checks again')
        .option('--dry-run', 'With --fix, print the diff of each fix and write nothing')
        .addOption(new Option('--hook <hook>', 'Run the checks of one Git hook, as that hook does').choices(HOOKS))
        .option('--skip <checks...>', 'Skip these checks for this run', CHECK_FLAG_DEFAULTS.skip)
        .addOption(new Option('--message-file <path>', 'Check this commit message file, as the commit-msg hook does'))
        .action(async (paths, flags, command) => {
            await runCheck(paths, flags, command.optsWithGlobals());
        });
}
