import { join, resolve } from 'node:path';
import { addAbortSignal } from 'node:stream';
import { GspotError } from '#cli/system/errors.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { runPushCheck } from '#cli/commands/check/push.ts';
import { runTreeCheck } from '#cli/commands/check/tree.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { constants, accessSync, existsSync } from 'node:fs';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { printProgress } from '#cli/commands/check/report.ts';
import { buildArgumentPath } from '#cli/repository/scopes.ts';
import { readGitText, readGitPaths } from '#cli/system/git.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { TRAILING_NEWLINE } from '#cli/config/system/system.ts';
import { CHECK_HOOKS } from '#cli/config/generation/generation.ts';
import { GIT_WRITE_TREE_ARGUMENTS } from '#cli/config/runs/copy.ts';
import { readStagedPaths } from '#cli/repository/revisions/changes.ts';
import { type CommandResult, type CommandCompletion } from '#cli/types/terminal.ts';
import { Option, type Command, InvalidArgumentError } from '@commander-js/extra-typings';

import {
    type CheckFlags,
    type CheckOptions,
    type CheckProgress,
    type CheckCommandJson,
} from '#cli/types/commands/check.ts';
import {
    FIX_FLAG,
    STAGED_FLAG,
    SETUP_PATHS,
    ONLY_OPTION,
    HOOK_OPTION,
    CHANGED_FLAG,
    VERBOSE_FLAG,
    PROGRESS_CLEAR,
    CHANGED_OPTION,
    NO_BASE_REVISION,
    PRE_COMMIT_OPTION,
    PUSH_STDIN_MESSAGE,
    PUSH_INPUT_MESSAGE,
    COMMIT_FILE_MESSAGE,
    STAGE_SETUP_MESSAGE,
    CHECK_LIST_SEPARATOR,
    EMPTY_CHECKS_MESSAGE,
    CHECK_STOPPED_MESSAGE,
    GIT_SETUP_FILES_ARGUMENTS,
} from '#cli/config/commands/check.ts';

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
        if (error instanceof TypeError) throw new GspotError('git', PUSH_INPUT_MESSAGE, { cause: error });
        throw error;
    }
}

function parseCheckNames(value: string, previous: string[] | undefined): string[] {
    const checks = value
        .split(CHECK_LIST_SEPARATOR)
        .map((check) => check.trim())
        .filter((check) => check !== '');
    if (checks.length === 0) throw new InvalidArgumentError(EMPTY_CHECKS_MESSAGE);
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
        verbose: flags.verbose === true,
        paths: hook === 'commit-msg' ? [] : paths,
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
    };
}

function assertPushFlags(flags: CheckFlags): void {
    const conflicts = [
        flags.staged === true ? STAGED_FLAG : undefined,
        flags.changed === undefined ? undefined : CHANGED_FLAG,
        flags.fix === true ? FIX_FLAG : undefined,
    ].filter((value) => value !== undefined);
    if (conflicts.length > 0)
        throw new GspotError(
            'arguments',
            `${conflicts.join(', ')} cannot run with --hook pre-push: it checks the pushed commits. Leave out ${conflicts.join(', ')}.`,
        );
    if (process.stdin.isTTY) throw new GspotError('arguments', PUSH_STDIN_MESSAGE);
}

function assertCheckSelection(options: CheckOptions, flags: CheckFlags): void {
    if (flags.hook === 'pre-push') assertPushFlags(flags);
    const selector = flags.hook === 'pre-commit' ? PRE_COMMIT_OPTION : STAGED_FLAG;
    if (options.staged && options.fix)
        throw new GspotError(
            'arguments',
            `--fix cannot run with ${selector}: fixers change the working tree, not the staged files. Run gspot check --fix, then stage the changes.`,
        );
    if (options.staged && flags.changed !== undefined)
        throw new GspotError('arguments', `--changed cannot run with ${selector}. Choose one file selection.`);
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
    if (options.hook === 'commit-msg' && paths.length !== 1) throw new GspotError('arguments', COMMIT_FILE_MESSAGE);
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

async function parseCheckFlags(
    paths: string[],
    flags: CheckFlags,
    cwd: string,
): Promise<{ root: string; options: CheckOptions }> {
    const options = buildCheckOptions(paths, flags, cwd);
    assertCheckSelection(options, flags);
    const root = await readRepositoryRoot(options.cwd);
    assertMessageSelection(options, paths);
    assertReadableMessageFile(options);
    return { root, options };
}

async function assertSetupStaged(root: string, cancelSignal: AbortSignal): Promise<void> {
    const indexed = await readGitPaths(root, GIT_SETUP_FILES_ARGUMENTS, { cancelSignal });
    const unstaged = SETUP_PATHS.filter(
        (path) => existsSync(join(root, path)) && !indexed.some((file) => file.startsWith(path)),
    );
    if (unstaged.length > 0)
        throw new GspotError(
            'git',
            `${unstaged.join(' and ')} ${unstaged.length === 1 ? 'is' : 'are'} not staged. ${STAGE_SETUP_MESSAGE}`,
        );
}

async function runStagedCheck(
    root: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
): Promise<CommandResult<CheckCommandJson>> {
    const started = new Date();
    await assertSetupStaged(root, cancelSignal);
    const staged = await readStagedPaths(root, cancelSignal);
    const revision = {
        content: 'index',
        cwd: options.cwd,
        paths: options.paths,
        toolsRoot: root,
        staged,
        started,
    } as const;
    if (staged.staged.length === 0) {
        const tree = await readGitText(root, GIT_WRITE_TREE_ARGUMENTS, { cancelSignal });
        return await runTreeCheck(root, options, cancelSignal, {
            ...revision,
            reference: tree.replace(TRAILING_NEWLINE, ''),
            reportRoot: root,
        });
    }
    using copy = await copyRevision(root, { kind: 'index' }, cancelSignal);
    const paths = options.paths.map((path) => buildArgumentPath(root, options.cwd, path));
    return await runTreeCheck(copy.root, { ...options, cwd: copy.root, paths }, cancelSignal, {
        ...revision,
        ...(copy.dependencyNote !== undefined && { dependencyNote: copy.dependencyNote }),
        unreadablePaths: copy.unreadablePaths,
        reference: copy.tree,
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
        return await runPushCheck(root, { ...options, paths: [], push }, cancelSignal);
    }
    return await (options.staged
        ? runStagedCheck(root, options, cancelSignal)
        : runTreeCheck(root, options, cancelSignal));
}

async function runCheckCommand(
    paths: string[],
    flags: CheckFlags,
    cwd: string,
): Promise<CommandResult<CheckCommandJson>> {
    try {
        return await runCancelableCommand(async (cancelSignal) => {
            const { root, options } = await parseCheckFlags(paths, flags, cwd);
            return await runCheckSelection(root, options, cancelSignal);
        }, CHECK_STOPPED_MESSAGE);
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
        .option(ONLY_OPTION, COMMAND_HELP.check.options[ONLY_OPTION], parseCheckNames)
        .option(STAGED_FLAG, COMMAND_HELP.check.options[STAGED_FLAG])
        .option(CHANGED_OPTION, COMMAND_HELP.check.options[CHANGED_OPTION])
        .option(FIX_FLAG, COMMAND_HELP.check.options[FIX_FLAG])
        .addOption(new Option(HOOK_OPTION, COMMAND_HELP.check.options[HOOK_OPTION]).choices(CHECK_HOOKS))
        .option(VERBOSE_FLAG, COMMAND_HELP.check.options[VERBOSE_FLAG])
        .action(async (paths, flags) => {
            onResult(await runCheckCommand(paths, flags, process.cwd()));
        });
}
