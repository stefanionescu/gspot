import { join, resolve } from 'node:path';
import { addAbortSignal } from 'node:stream';
import { GspotError } from '#cli/system/errors.ts';
import { copyRevision } from '#cli/runs/copy/revision.ts';
import { runPushCheck } from '#cli/commands/check/push.ts';
import { runTreeCheck } from '#cli/commands/check/tree.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { constants, accessSync, existsSync } from 'node:fs';
import { printProgress } from '#cli/commands/check/report.ts';
import { buildArgumentPath } from '#cli/repository/scopes.ts';
import { readGitText, readGitPaths } from '#cli/system/git.ts';
import { runCancelableCommand } from '#cli/system/terminal.ts';
import { TRAILING_NEWLINE } from '#cli/config/system/system.ts';
import { GIT_WRITE_TREE_ARGUMENTS } from '#cli/config/runs/copy.ts';
import { readStagedPaths } from '#cli/repository/revisions/changes.ts';
import type { CommandLocation } from '#cli/types/commands/commands.ts';
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
    BASE_FLAG,
    STAGE_FLAG,
    STAGED_FLAG,
    SETUP_PATHS,
    ONLY_OPTION,
    HOOK_OPTION,
    BASE_OPTION,
    CHANGED_FLAG,
    VERBOSE_FLAG,
    CHECK_STAGES,
    STAGE_OPTION,
    PROGRESS_CLEAR,
    CHECK_INPUT_HOOKS,
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

function buildCheckOptions(paths: string[], flags: CheckFlags, cwd: string): CheckOptions {
    const hook = flags.hook;
    return {
        cwd,
        staged: flags.staged === true,
        fix: flags.fix === true,
        verbose: flags.verbose === true,
        paths: hook === 'commit-msg' ? [] : paths,
        hook,
        changed: flags.changed === true,
        only: flags.only,
        base: flags.base,
        messageFile: hook === 'commit-msg' && paths[0] !== undefined ? resolve(cwd, paths[0]) : undefined,
        stage: hook === 'commit-msg' ? 'message' : flags.stage,
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
        flags.base === undefined ? undefined : BASE_FLAG,
        flags.fix === true ? FIX_FLAG : undefined,
    ].filter((value) => value !== undefined);
    if (conflicts.length > 0)
        throw new GspotError(
            'arguments',
            `${conflicts.join(', ')} cannot run with --hook pre-push: it checks the pushed commits. Leave out ${conflicts.join(', ')}.`,
        );
    if (process.stdin.isTTY) throw new GspotError('arguments', PUSH_STDIN_MESSAGE);
}

function assertComparisonFlags(options: CheckOptions, flags: CheckFlags): void {
    const comparisons = [
        flags.changed === true ? CHANGED_FLAG : undefined,
        flags.base === undefined ? undefined : BASE_FLAG,
    ].filter((flag) => flag !== undefined);
    if (comparisons.length > 1)
        throw new GspotError('arguments', '--changed cannot run with --base. Choose one comparison.');
    if (options.staged && comparisons.length > 0)
        throw new GspotError(
            'arguments',
            `${comparisons.join('')} cannot run with ${STAGED_FLAG}. Choose one file selection.`,
        );
}

function assertCheckSelection(options: CheckOptions, flags: CheckFlags): void {
    if (flags.stage !== undefined && flags.hook !== undefined)
        throw new GspotError('arguments', `${STAGE_FLAG} cannot run with --hook. Choose a stage or a Git hook.`);
    if (flags.hook === 'pre-push') assertPushFlags(flags);
    if (options.staged && options.fix)
        throw new GspotError(
            'arguments',
            `--fix cannot run with ${STAGED_FLAG}: fixers change the working tree, not the staged files. Run gspot check --fix, then stage the changes.`,
        );
    assertComparisonFlags(options, flags);
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

function parseCheckFlags(
    paths: string[],
    flags: CheckFlags,
    location: CommandLocation,
): { root: string; options: CheckOptions } {
    const options = buildCheckOptions(paths, flags, location.cwd);
    assertCheckSelection(options, flags);
    assertMessageSelection(options, paths);
    assertReadableMessageFile(options);
    return { root: location.root, options };
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
    location: CommandLocation,
): Promise<CommandResult<CheckCommandJson>> {
    try {
        return await runCancelableCommand(async (cancelSignal) => {
            const { root, options } = parseCheckFlags(paths, flags, location);
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
@param location the calling folder and the Git root validated before the action.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: main.ts registers the command through it, like every other command.
export function registerCheck(program: Command, onResult: CommandCompletion, location: CommandLocation): void {
    program
        .command('check')
        .argument('[paths...]', COMMAND_HELP.check.arguments['paths'])
        .summary(COMMAND_HELP.check.summary)
        .description(COMMAND_HELP.check.description)
        .option(ONLY_OPTION, COMMAND_HELP.check.options[ONLY_OPTION], parseCheckNames)
        .option(STAGED_FLAG, COMMAND_HELP.check.options[STAGED_FLAG])
        .addOption(new Option(STAGE_OPTION, COMMAND_HELP.check.options[STAGE_OPTION]).choices(CHECK_STAGES))
        .option(CHANGED_FLAG, COMMAND_HELP.check.options[CHANGED_FLAG])
        .option(BASE_OPTION, COMMAND_HELP.check.options[BASE_OPTION])
        .option(FIX_FLAG, COMMAND_HELP.check.options[FIX_FLAG])
        .addOption(new Option(HOOK_OPTION, COMMAND_HELP.check.options[HOOK_OPTION]).choices(CHECK_INPUT_HOOKS))
        .option(VERBOSE_FLAG, COMMAND_HELP.check.options[VERBOSE_FLAG])
        .action(async (paths, flags) => {
            onResult(await runCheckCommand(paths, flags, location));
        });
}
