import { join, resolve } from 'node:path';
import { addAbortSignal } from 'node:stream';
import { GspotError } from '#cli/system/errors.ts';
import { readSettings } from '#cli/settings/read.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { CommandResult } from '#cli/types/system.ts';
import { runPushCheck } from '#cli/commands/check/push.ts';
import { runTreeCheck } from '#cli/commands/check/tree.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { constants, accessSync, existsSync } from 'node:fs';
import { HOOK_CHECKS } from '#cli/config/tools/installers.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import { formatAnnotations } from '#cli/commands/check/report.ts';
import { InvalidArgumentError } from '@commander-js/extra-typings';
import { readIndexTree } from '#cli/repository/revisions/files.ts';
import { readTreeStatus } from '#cli/repository/revisions/changes.ts';
import { readGitText, readGitPaths } from '#cli/repository/git/run.ts';
import { FIX_FLAG, BASE_FLAG, STAGED_FLAG } from '#cli/config/engine.ts';
import { printProgress, buildEmptyRunReport } from '#cli/engine/report.ts';
import { rewriteProgress, runCancelableCommand } from '#cli/system/terminal.ts';
import type { CommandLocation, CommandDefinition } from '#cli/types/commands/edits.ts';
import type { CheckFlags, CheckOptions, CheckCommandJson } from '#cli/types/commands/reports.ts';

import {
    STAGE_FLAG,
    SETUP_PATHS,
    ONLY_OPTION,
    SKIP_OPTION,
    HOOK_OPTION,
    BASE_OPTION,
    CHANGED_FLAG,
    CHECK_STAGES,
    STAGE_OPTION,
    CHECK_INPUT_HOOKS,
    PUSH_STDIN_MESSAGE,
    PUSH_INPUT_MESSAGE,
    COMMIT_FILE_MESSAGE,
    STAGE_SETUP_MESSAGE,
    CHECK_LIST_SEPARATOR,
    EMPTY_CHECKS_MESSAGE,
    CHECK_STOPPED_MESSAGE,
    NOTHING_STAGED_MESSAGE,
    GIT_SETUP_FILES_ARGUMENTS,
    GIT_STAGED_SETTINGS_ARGUMENTS,
} from '#cli/config/commands/reports.ts';

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
            `--fix cannot run with ${STAGED_FLAG}: fixers change the working tree, not the staged files. Run gspot check --fix, then stage them with git add -p.`,
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
    const { cwd } = location;
    const { hook } = flags;
    const options: CheckOptions = {
        cwd,
        staged: flags.staged === true,
        fix: flags.fix === true,
        verbose: flags.verbose === true,
        paths: hook === 'commit-msg' ? [] : paths,
        hook,
        changed: flags.changed === true,
        only: flags.only,
        skip: flags.skip,
        base: flags.base,
        messageFile: hook === 'commit-msg' && paths[0] !== undefined ? resolve(cwd, paths[0]) : undefined,
        stage: hook === undefined ? flags.stage : HOOK_CHECKS[hook].stages[0],
        onProgress: printProgress,
    };
    assertCheckSelection(options, flags);
    assertMessageSelection(options, paths);
    assertReadableMessageFile(options);
    return { root: location.root, options };
}

async function assertSetupStaged(root: string, cancelSignal: AbortSignal): Promise<void> {
    const indexed = await readGitPaths(root, GIT_SETUP_FILES_ARGUMENTS, { cancelSignal });
    const unstaged = SETUP_PATHS.filter(
        (path) => existsSync(join(root, path)) && indexed.every((file) => !file.startsWith(path)),
    );
    if (unstaged.length > 0)
        throw new GspotError(
            'git',
            `${formatNameList(unstaged)} ${unstaged.length === 1 ? 'is' : 'are'} not staged. ${STAGE_SETUP_MESSAGE}`,
        );
}

async function runStagedCheck(
    root: string,
    options: CheckOptions,
    cancelSignal: AbortSignal,
): Promise<CommandResult<CheckCommandJson>> {
    const started = new Date();
    await assertSetupStaged(root, cancelSignal);
    const status = await readTreeStatus(root, cancelSignal);
    if (!status.hasStagedChanges) {
        const json = buildEmptyRunReport(options.stage ?? 'all', started, [NOTHING_STAGED_MESSAGE]);
        return { text: `${NOTHING_STAGED_MESSAGE}\n`, json, exitCode: 0 };
    }
    const { staged: stagedPaths, unstaged, untracked } = status;
    const unstagedPaths = new Set(unstaged);
    const selection = {
        content: 'index',
        paths: stagedPaths,
        unstagedChanges: stagedPaths.filter((path) => unstagedPaths.has(path)).length,
    } as const;
    if (stagedPaths.length === 0 || (unstaged.length === 0 && untracked.paths.length === 0))
        return await runTreeCheck(root, options, cancelSignal, {
            toolsRoot: root,
            started,
            selection: { ...selection, reference: await readIndexTree(root, cancelSignal) },
            untracked,
        });
    using copy = await copyRevision(root, { kind: 'index', status, paths: stagedPaths }, cancelSignal);
    return await runTreeCheck(copy.root, options, cancelSignal, {
        toolsRoot: root,
        started,
        selection: { ...selection, reference: copy.tree },
        ...(copy.dependencyNote !== undefined && { dependencyNote: copy.dependencyNote }),
        unreadablePaths: copy.unreadablePaths,
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
    if (options.hook === 'commit-msg') {
        const text = await readGitText(root, GIT_STAGED_SETTINGS_ARGUMENTS, { cancelSignal });
        const listing = { root, index: [], attributes: new Map(), files: [], unreadablePaths: [] };
        return await runTreeCheck(root, { ...options, settings: readSettings(text, root), listing }, cancelSignal);
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
        const result = await runCancelableCommand(async (cancelSignal) => {
            const { root, options } = parseCheckFlags(paths, flags, location);
            return await runCheckSelection(root, options, cancelSignal);
        }, CHECK_STOPPED_MESSAGE);
        return { ...result, annotations: formatAnnotations(result.json) };
    } finally {
        rewriteProgress('');
    }
}

export const CHECK_COMMAND: CommandDefinition<[string[]], CheckFlags> = {
    name: 'check',
    arguments: [{ term: '[paths...]' }],
    options: [
        { flags: ONLY_OPTION, parse: parseCheckNames },
        { flags: SKIP_OPTION, parse: parseCheckNames },
        { flags: STAGED_FLAG },
        { flags: STAGE_OPTION, choices: CHECK_STAGES },
        { flags: CHANGED_FLAG },
        { flags: BASE_OPTION },
        { flags: FIX_FLAG },
        { flags: HOOK_OPTION, choices: CHECK_INPUT_HOOKS, hidden: true },
    ],
    run: async ([paths], flags, location) => await runCheckCommand(paths, flags, location),
};
