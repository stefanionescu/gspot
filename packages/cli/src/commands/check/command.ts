// Parse the check flags, read the pre-push input, and stop the run on a termination signal.

import { addAbortSignal } from 'node:stream';
import { resolve, relative } from 'node:path';
import { constants, accessSync } from 'node:fs';
import { findRoot } from '#cli/repository/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isGitRepository } from '#cli/system/git.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { checkPush } from '#cli/commands/check/push.ts';
import { checkTree } from '#cli/commands/check/tree.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { printProgress } from '#cli/commands/check/report.ts';
import { CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { copyRevision } from '#cli/runs/scratch-copy/revision.ts';
import { CHECK_LIST_SEPARATOR } from '#cli/config/commands/check.ts';
import { readStagedPaths } from '#cli/repository/revisions/changes.ts';
import type { CheckResult, CheckProgress } from '#cli/types/runs/check.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { Option, type Command, InvalidArgumentError } from '@commander-js/extra-typings';
import { type CheckFlags, type CheckOptions, type CheckCommandJson } from '#cli/types/commands/check.ts';

// Read the pre-push lines from standard input until the signal stops the run.
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

function collectChecks(value: string, previous: string[] | undefined): string[] {
    const checks = value
        .split(CHECK_LIST_SEPARATOR)
        .map((check) => check.trim())
        .filter((check) => check !== '');
    if (checks.length === 0) throw new InvalidArgumentError('Name a check, such as --only python/ruff.');
    return [...(previous ?? []), ...checks];
}

function getChangedBase(changed: CheckFlags['changed']): string | undefined {
    if (typeof changed === 'string') return changed;
    return changed === true ? '' : undefined;
}

function buildCheckOptions(paths: string[], flags: CheckFlags): CheckOptions {
    const hook = flags.hook;
    return {
        cwd: process.cwd(),
        staged: flags.staged === true || hook === 'pre-commit',
        fix: flags.fix === true,
        isDryRun: flags.dryRun === true,
        verbose: flags.verbose === true,
        paths: hook === 'commit-msg' ? [] : paths,
        ...stripUndefined({
            hook,
            only: flags.only,
            base: getChangedBase(flags.changed),
            messageFile: hook === 'commit-msg' ? paths[0] : undefined,
            stage: hook === 'pre-commit' ? ('commit' as const) : undefined,
            onResult:
                flags.json === true
                    ? undefined
                    : (_result: CheckResult, progress: CheckProgress) => {
                          printProgress(progress);
                      },
        }),
    };
}

function validatePushFlags(flags: CheckFlags): void {
    const conflicts = [
        flags.staged === true ? '--staged' : undefined,
        getChangedBase(flags.changed) === undefined ? undefined : '--changed',
        flags.fix === true ? '--fix' : undefined,
        flags.dryRun === true ? '--dry-run' : undefined,
    ].filter((value) => value !== undefined);
    if (conflicts.length > 0)
        throw new GspotError(
            'arguments',
            `${conflicts.join(', ')} cannot run with --hook pre-push: it checks the pushed commits. Leave out ${conflicts.join(', ')}.`,
        );
}

function validateCheckSelection(options: CheckOptions, flags: CheckFlags): void {
    if (flags.hook === 'pre-push') validatePushFlags(flags);
    const selector = flags.hook === 'pre-commit' ? '--hook pre-commit' : '--staged';
    if (options.staged && options.fix)
        throw new GspotError(
            'arguments',
            `--fix cannot run with ${selector}: fixers change the working tree, not the staged files. Run gspot check --fix, then stage the changes.`,
        );
    if (options.staged && options.base !== undefined)
        throw new GspotError('arguments', `--changed cannot run with ${selector}. Choose one file selection.`);
}

function validateGitSelection(root: string, options: CheckOptions): void {
    const staged = options.hook === 'pre-commit' ? '--hook pre-commit' : '--staged';
    const gitFlags = [
        options.staged ? staged : undefined,
        options.base === undefined ? undefined : '--changed',
        options.hook === 'pre-push' ? '--hook pre-push' : undefined,
    ].filter((value) => value !== undefined);
    if (gitFlags.length > 0 && !isGitRepository(root))
        throw new GspotError('git', `${gitFlags.join(', ')} needs a Git repository.`);
}

function validateMessageSelection(root: string, options: CheckOptions, paths: string[]): void {
    const messageCheck = [...readManifests(createReadCache(root)).values()]
        .flatMap(({ checks }) => checks)
        .find((check) => check.stage === 'message' && options.only?.includes(check.name) === true);
    if (messageCheck !== undefined && options.messageFile === undefined)
        throw new GspotError(
            'arguments',
            `${messageCheck.name} checks commit messages. Run gspot check --hook commit-msg -- <file>.`,
        );
    if (options.hook === 'pre-push' && process.stdin.isTTY)
        throw new GspotError(
            'arguments',
            '--hook pre-push reads the lines that Git writes to standard input. Run it from the pre-push hook.',
        );
    if (options.hook === 'commit-msg' && paths.length !== 1)
        throw new GspotError('arguments', '--hook commit-msg needs one commit message file after --.');
}

function readCommitMessageFile(options: CheckOptions): void {
    if (options.messageFile === undefined) return;
    const commitFile = resolve(options.cwd, options.messageFile);
    options.messageFile = commitFile;
    options.stage = 'message';
    try {
        accessSync(commitFile, constants.R_OK);
    } catch (error) {
        throw new GspotError('files', `The commit message file ${commitFile} cannot be read.`, { cause: error });
    }
}

// Validate the flags before reading the Git pre-push input or starting a check.
function parseCheckFlags(paths: string[], flags: CheckFlags): CheckOptions {
    if (flags.dryRun === true && flags.fix !== true)
        throw new GspotError('arguments', '--dry-run previews the fixes. Add --fix.');
    const options = buildCheckOptions(paths, flags);
    validateCheckSelection(options, flags);
    const root = findRoot(options.cwd);
    validateGitSelection(root, options);
    validateMessageSelection(root, options, paths);
    readCommitMessageFile(options);
    return options;
}

// Check a scratch copy of the staged index, and write the report in the working tree.
async function checkStaged(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
): Promise<CommandResult<CheckCommandJson>> {
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

// Validate the input, then check the working tree or a scratch copy.
async function runCheckCommand(
    root: string,
    options: CheckOptions,
    signal: AbortSignal,
): Promise<CommandResult<CheckCommandJson>> {
    if (options.hook === 'pre-push') {
        const input = await readPushInput(signal);
        const push = { stdin: input, ...(options.paths[0] === undefined ? {} : { remote: options.paths[0] }) };
        return await checkPush(root, { ...options, paths: [], push }, signal);
    }
    return await (options.staged ? checkStaged(root, options, signal) : checkTree(root, options, signal));
}

// Run check with an abort signal that the termination signals trigger.
async function runCheck(paths: string[], flags: CheckFlags): Promise<CommandResult<CheckCommandJson>> {
    try {
        return await runCancelableCommand(async (signal) => {
            const options = parseCheckFlags(paths, flags);
            const root = findRoot(options.cwd);
            return await runCheckCommand(root, options, signal);
        }, 'Check stopped before every check finished.');
    } finally {
        if (flags.json !== true) printProgress(undefined);
    }
}

/**
 * Register the check command.
 *
 * @param program the CLI that gets the command.
 * @param onResult writes the command result.
 */
export function registerCheck(program: Command, onResult: CommandCompletion): void {
    program
        .command('check')
        .argument('[paths...]', COMMAND_HELP.check.arguments['paths'])
        .summary(COMMAND_HELP.check.summary)
        .description(COMMAND_HELP.check.description)
        .option('--only <checks>', COMMAND_HELP.check.options['--only <checks>'], collectChecks)
        .option('--staged', COMMAND_HELP.check.options['--staged'])
        .option('--changed [ref]', COMMAND_HELP.check.options['--changed [ref]'])
        .option('--fix', COMMAND_HELP.check.options['--fix'])
        .option('--dry-run', COMMAND_HELP.check.options['--dry-run'])
        .addOption(new Option('--hook <hook>', COMMAND_HELP.check.options['--hook <hook>']).choices(CHECK_HOOKS))
        .option('--verbose', COMMAND_HELP.check.options['--verbose'])
        .action(async (paths, flags) => {
            onResult(await runCheck(paths, flags));
        });
}
