// The check command's flags, its pre-push input, and the cancellation the termination signals cause.
import { addAbortSignal } from 'node:stream';
import { resolve, relative } from 'node:path';
import { compact } from '#cli/system/values.ts';
import { constants, accessSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { Option } from '@commander-js/extra-typings';
import { printResult } from '#cli/system/terminal.ts';
import { checkTree } from '#cli/commands/check/tree.ts';
import { progress } from '#cli/commands/check/report.ts';
import type { Command } from '@commander-js/extra-typings';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { type CommandResult } from '#cli/types/terminal.ts';
import { CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import { copyRevision } from '#cli/execution/copy/revision.ts';
import { type CheckOptions } from '#cli/types/commands/check.ts';
import { readStagedPaths } from '#cli/repository/revisions/changes.ts';
import { EXIT_ERROR, SIGNAL_EXIT_CODES } from '#cli/config/terminal.ts';
import { findRoot, isGitRepository } from '#cli/repository/find-root.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { checkPush, assertPushOptions } from '#cli/commands/check/push.ts';

// Reads the pre-push protocol from standard input, stopping when the signal stops the run.
async function readPushInput(signal: AbortSignal): Promise<string> {
    signal.throwIfAborted();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let input = '';
    try {
        for await (const chunk of addAbortSignal(signal, process.stdin) as AsyncIterable<Buffer>)
            input += decoder.decode(chunk, { stream: true });
        return input + decoder.decode();
    } catch (error) {
        signal.throwIfAborted();
        if (error instanceof TypeError)
            throw new GspotError('git', 'Git sent pre-push input that is not UTF-8 text.', { cause: error });
        throw error;
    }
}

// Turns the pre-push invocation into check options: Git's remote name and the object updates on standard input.
async function pushOptions(options: CheckOptions, paths: string[], signal: AbortSignal): Promise<CheckOptions> {
    // A refused flag stops the run before it waits for input that a terminal may never send.
    assertPushOptions(options);
    const input = await readPushInput(signal);
    return { ...options, paths: [], push: { stdin: input, ...(paths[0] === undefined ? {} : { remote: paths[0] }) } };
}

// Checks an exact staged-index copy and writes the report in the working repository.
async function checkStaged(root: string, options: CheckOptions, signal: AbortSignal): Promise<CommandResult> {
    if (options.fix)
        throw new GspotError(
            'arguments',
            'Staged checks do not run fixers. Run gspot check --fix and stage the reviewed changes.',
        );
    if (options.base !== undefined) throw new GspotError('arguments', 'Choose --staged or --changed, not both.');
    const set = await readStagedPaths(root, signal);
    return copyRevision(
        root,
        { kind: 'index' },
        async (scratch, tree) => {
            const paths = options.paths.map((path) => relative(root, resolve(options.cwd, path)));
            return checkTree(scratch, { ...options, cwd: scratch, paths }, signal, {
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

// Validate command input and dispatch the selected working tree or exact copy.
async function checkCommand(root: string, options: CheckOptions, signal: AbortSignal): Promise<CommandResult> {
    const isPush = options.hook === 'pre-push';
    const needsGit = [options.staged, isPush, options.base !== undefined].includes(true);
    if (needsGit && !isGitRepository(root))
        throw new GspotError('git', '--staged, --changed, and pre-push checks need a Git repository.');
    let selected = isPush ? await pushOptions(options, options.paths, signal) : options;
    if (options.messageFile !== undefined) {
        const commitFile = resolve(options.cwd, options.messageFile);
        selected = { ...options, messageFile: commitFile, stage: 'message' };
        try {
            accessSync(commitFile, constants.R_OK);
        } catch (error) {
            throw new GspotError('files', `The commit message file ${commitFile} cannot be read.`, {
                cause: error,
            });
        }
    }
    if (selected.push !== undefined) return await checkPush(root, { ...selected, push: selected.push }, signal);
    return await (selected.staged ? checkStaged(root, selected, signal) : checkTree(root, selected, signal));
}

// Runs check with an abort signal wired to the termination signals for the duration of the run.
async function runCheck(paths: string[], flags: ReturnType<ReturnType<typeof registerCheck>['opts']>): Promise<void> {
    const controller = new AbortController();
    const hook = flags.hook;

    let canceledCode: number | undefined;
    const cancellations = Object.entries(SIGNAL_EXIT_CODES).map(([signal, code]) => {
        const onSignal = (): void => {
            canceledCode = code;
            controller.abort();
        };
        process.on(signal, onSignal);
        return { signal, onSignal };
    });
    let result: CommandResult;
    try {
        // Git passes a message file to commit-msg; an explicit file selects the same stage.
        const options: CheckOptions = {
            cwd: process.cwd(),
            staged: flags.staged === true,
            fix: flags.fix === true,
            isDryRun: flags.dryRun === true,
            verbose: flags.verbose === true,
            paths,
            ...compact({
                hook,
                only: flags.only,
                base: flags.changed === true ? (flags.base ?? '') : undefined,
                messageFile: flags.messageFile,
                onResult: progress,
            }),
        };
        if (hook === 'pre-commit') {
            options.stage = 'commit';
            options.staged = true;
        }
        const root = findRoot(options.cwd);
        result = await checkCommand(root, options, controller.signal);
    } catch (error) {
        if (!controller.signal.aborted) throw error;
        result = {
            text: 'Check stopped before every check finished.\n',
            json: { error: 'canceled', message: 'Check stopped before every check finished.', exitCode: EXIT_ERROR },
            exitCode: EXIT_ERROR,
        };
    } finally {
        for (const { signal, onSignal } of cancellations) process.removeListener(signal, onSignal);
    }
    result.exitCode = canceledCode ?? result.exitCode;
    (result.json as Record<string, unknown>)['exitCode'] = result.exitCode;
    printResult(result);
}

/**
 * Register the check command.
 * @param program the command program
 * @returns the registered command with its inferred argument and flag types
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types -- reason: Commander infers the option types from these registered flags.
export function registerCheck(program: Command) {
    return program
        .command('check')
        .argument('[paths...]', COMMAND_HELP.check.arguments['paths'])
        .summary(COMMAND_HELP.check.summary)
        .description(COMMAND_HELP.check.description)
        .option('--only <checks...>', COMMAND_HELP.check.options['--only <checks...>'])
        .option('--staged', COMMAND_HELP.check.options['--staged'])
        .option('--changed', COMMAND_HELP.check.options['--changed'])
        .addOption(new Option('--base <ref>', COMMAND_HELP.check.options['--base <ref>']).implies({ changed: true }))
        .option('--fix', COMMAND_HELP.check.options['--fix'])
        .addOption(
            new Option('--dry-run', COMMAND_HELP.check.options['--dry-run']).implies({
                fix: true,
            }),
        )
        .addOption(new Option('--hook <hook>', COMMAND_HELP.check.options['--hook <hook>']).choices(CHECK_HOOKS))
        .addOption(new Option('--message-file <path>', COMMAND_HELP.check.options['--message-file <path>']))
        .option('--verbose', COMMAND_HELP.check.options['--verbose'])
        .action(async (paths, flags) => {
            const messageCheck = [...configurationManifests().values()]
                .flatMap(({ checks }) => checks)
                .find((check) => check.stage === 'message' && flags.only?.includes(check.name) === true);
            const hasMessage = flags.messageFile !== undefined;
            if (messageCheck !== undefined && !hasMessage)
                throw new GspotError(
                    'arguments',
                    `${messageCheck.name} checks commit messages. Run gspot check --hook commit-msg --message-file <file>.`,
                );
            await runCheck(paths, flags);
        });
}
