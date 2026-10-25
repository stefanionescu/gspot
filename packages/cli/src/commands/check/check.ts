import { resolve } from 'node:path';
import { addAbortSignal } from 'node:stream';
import { constants, accessSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { isGitRepository } from '#cli/system/git.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { checkPush } from '#cli/commands/check/push.ts';
import { checkTree } from '#cli/commands/check/tree.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { CheckProgress } from '#cli/types/runs/run.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { printProgress } from '#cli/commands/check/report.ts';
import { CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import { buildArgumentPath } from '#cli/repository/scopes.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { readStagedPaths } from '#cli/repository/revisions/changes.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { Option, type Command, InvalidArgumentError } from '@commander-js/extra-typings';
import type { CheckFlags, CheckOptions, CheckCommandJson } from '#cli/types/commands/check.ts';
import { PROGRESS_CLEAR, NO_BASE_REVISION, CHECK_LIST_SEPARATOR } from '#cli/config/commands/check/check.ts';

async function readPushInput(cancelSignal: AbortSignal): Promise<string> {
    cancelSignal.throwIfAborted();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let input = '';
    try {
        for await (const chunk of addAbortSignal(cancelSignal, process.stdin) as AsyncIterable<Buffer>)
            input += decoder.decode(chunk, { stream: true });
        return input + decoder.decode();
    } catch (error) {
        cancelSignal.throwIfAborted();
        if (error instanceof TypeError)
            throw new GspotError('git', 'Git sent pre-push input that is not UTF-8 text.', { cause: error });
        throw error;
    }
}

function parseCheckNames(value: string, previous: string[] | undefined): string[] {
    const checks = value
        .split(CHECK_LIST_SEPARATOR)
        .map((check) => check.trim())
        .filter((check) => check !== '');
    if (checks.length === 0) throw new InvalidArgumentError('Name a check, such as --only python/ruff.');
    return [...(previous ?? []), ...checks];
}

function getChangedBase(changed: CheckFlags['changed']): string | undefined {
    if (typeof changed === 'string') return NO_BASE_REVISION.test(changed) ? undefined : changed;
    return changed === true ? '' : undefined;
}

function getAllFilesCause(changed: CheckFlags['changed']): CheckOptions['allFiles'] {
    if (typeof changed !== 'string' || !NO_BASE_REVISION.test(changed)) return undefined;
    return changed === '' ? 'empty-base' : 'new-branch';
}

function buildCheckOptions(paths: string[], flags: CheckFlags, cwd: string): CheckOptions {
    const hook = flags.hook;
    let stage: CheckOptions['stage'];
    if (hook === 'commit-msg') stage = 'message';
    else if (hook === 'pre-commit') stage = 'commit';
    return {
        cwd,
        staged: flags.staged === true || hook === 'pre-commit',
        fix: flags.fix === true,
        isDryRun: flags.dryRun === true,
        verbose: flags.verbose === true,
        paths: hook === 'commit-msg' ? [] : paths,
        ...stripUndefined({
            hook,
            allFiles: getAllFilesCause(flags.changed),
            only: flags.only,
            base: getChangedBase(flags.changed),
            messageFile: hook === 'commit-msg' && paths[0] !== undefined ? resolve(cwd, paths[0]) : undefined,
            stage,
            onProgress:
                flags.json === true
                    ? undefined
                    : (progress: CheckProgress) => {
                          printProgress(progress);
                      },
        }),
    };
}

function assertPushFlags(flags: CheckFlags): void {
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
    if (process.stdin.isTTY)
        throw new GspotError(
            'arguments',
            '--hook pre-push reads the lines that Git writes to standard input. Run it from the pre-push hook.',
        );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function formatStagedFlag(hook: CheckFlags['hook']): string {
    return hook === 'pre-commit' ? '--hook pre-commit' : '--staged';
}

function assertCheckSelection(options: CheckOptions, flags: CheckFlags): void {
    if (flags.hook === 'pre-push') assertPushFlags(flags);
    const selector = formatStagedFlag(flags.hook);
    if (options.staged && options.fix)
        throw new GspotError(
            'arguments',
            `--fix cannot run with ${selector}: fixers change the working tree, not the staged files. Run gspot check --fix, then stage the changes.`,
        );
    if (options.staged && options.base !== undefined)
        throw new GspotError('arguments', `--changed cannot run with ${selector}. Choose one file selection.`);
}

function assertGitSelection(root: string, options: CheckOptions): void {
    const staged = formatStagedFlag(options.hook);
    const gitFlags = [
        options.staged ? staged : undefined,
        options.base === undefined ? undefined : '--changed',
        options.hook === 'pre-push' ? '--hook pre-push' : undefined,
    ].filter((value) => value !== undefined);
    if (gitFlags.length > 0 && !isGitRepository(root))
        throw new GspotError('git', `${gitFlags.join(', ')} needs a Git repository.`);
}

function assertMessageSelection(options: CheckOptions, paths: string[]): void {
    const messageCheck = readConfigurations()
        .values()
        .flatMap(({ checks }) => checks)
        .find((check) => check.stage === 'message' && options.only?.includes(check.id) === true);
    if (messageCheck !== undefined && options.messageFile === undefined)
        throw new GspotError(
            'arguments',
            `${messageCheck.id} checks commit messages. Run gspot check --hook commit-msg -- <file>.`,
        );
    if (options.hook === 'commit-msg' && paths.length !== 1)
        throw new GspotError('arguments', '--hook commit-msg needs one commit message file after --.');
}

function assertReadableMessageFile(options: CheckOptions): void {
    if (options.messageFile === undefined) return;
    try {
        accessSync(options.messageFile, constants.R_OK);
    } catch (error) {
        throw new GspotError('filesystem', `gspot cannot read the commit message file ${options.messageFile}.`, {
            cause: error,
        });
    }
}

function parseCheckFlags(paths: string[], flags: CheckFlags, cwd: string): { root: string; options: CheckOptions } {
    if (flags.dryRun === true && flags.fix !== true)
        throw new GspotError('arguments', '--dry-run previews the fixes. Add --fix.');
    const options = buildCheckOptions(paths, flags, cwd);
    assertCheckSelection(options, flags);
    const root = readRepositoryRoot(options.cwd);
    assertGitSelection(root, options);
    assertMessageSelection(options, paths);
    assertReadableMessageFile(options);
    return { root, options };
}

async function checkStaged(
    root: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
): Promise<CommandResult<CheckCommandJson>> {
    const staged = await readStagedPaths(root, cancelSignal);
    using copy = await copyRevision(root, { kind: 'index' }, cancelSignal);
    const paths = options.paths.map((path) => buildArgumentPath(root, options.cwd, path));
    return await checkTree(copy.root, { ...options, cwd: copy.root, paths }, cancelSignal, {
        ...(copy.dependencyNote !== undefined && { dependencyNote: copy.dependencyNote }),
        content: 'index',
        cwd: options.cwd,
        paths: options.paths,
        installedRoot: root,
        reference: copy.tree,
        staged,
        reportRoot: root,
    });
}

async function runCheckSelection(
    root: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
): Promise<CommandResult<CheckCommandJson>> {
    if (options.hook === 'pre-push') {
        const input = await readPushInput(cancelSignal);
        const push = { stdin: input, ...(options.paths[0] !== undefined && { remote: options.paths[0] }) };
        return await checkPush(root, { ...options, paths: [], push }, cancelSignal);
    }
    return await (options.staged ? checkStaged(root, options, cancelSignal) : checkTree(root, options, cancelSignal));
}

async function runCheck(paths: string[], flags: CheckFlags, cwd: string): Promise<CommandResult<CheckCommandJson>> {
    try {
        return await runCancelableCommand(async (cancelSignal) => {
            const { root, options } = parseCheckFlags(paths, flags, cwd);
            return await runCheckSelection(root, options, cancelSignal);
        }, 'Check stopped before every check finished.');
    } finally {
        if (flags.json !== true && process.stderr.isTTY) process.stderr.write(PROGRESS_CLEAR);
    }
}

/**
Register the check command.

@param program the gspot program that gets the command.
@param onResult receives the result of the command.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerCheck(program: Command, onResult: CommandCompletion): void {
    program
        .command('check')
        .argument('[paths...]', COMMAND_HELP.check.arguments['paths'])
        .summary(COMMAND_HELP.check.summary)
        .description(COMMAND_HELP.check.description)
        .option('--only <checks>', COMMAND_HELP.check.options['--only <checks>'], parseCheckNames)
        .option('--staged', COMMAND_HELP.check.options['--staged'])
        .option('--changed [ref]', COMMAND_HELP.check.options['--changed [ref]'])
        .option('--fix', COMMAND_HELP.check.options['--fix'])
        .option('--dry-run', COMMAND_HELP.check.options['--dry-run'])
        .addOption(new Option('--hook <hook>', COMMAND_HELP.check.options['--hook <hook>']).choices(CHECK_HOOKS))
        .option('--verbose', COMMAND_HELP.check.options['--verbose'])
        .action(async (paths, flags) => {
            onResult(await runCheck(paths, flags, process.cwd()));
        });
}
