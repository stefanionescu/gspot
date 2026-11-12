import { accessSync, constants, existsSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { addAbortSignal } from 'node:stream';

import { runPushCheck } from '#cli/commands/check/push.ts';
import { formatAnnotations } from '#cli/commands/check/report.ts';
import { runTreeCheck } from '#cli/commands/check/tree.ts';
import {
    BASE_OPTION,
    CHECK_INPUT_HOOKS,
    CHECK_STAGES,
    CHECK_STOPPED_MESSAGE,
    COMMIT_FILE_MESSAGE,
    GIT_SETUP_FILES_ARGUMENTS,
    GIT_STAGED_SETTINGS_ARGUMENTS,
    HOOK_OPTION,
    HOOK_REFUSAL_REASONS,
    NOTHING_STAGED_MESSAGE,
    ONLY_OPTION,
    PUSH_INPUT_MESSAGE,
    PUSH_STDIN_MESSAGE,
    SETUP_PATHS,
    SKIP_OPTION,
    STAGE_SETUP_MESSAGE,
    UNSTAGED_TOOLS_NOTE,
} from '#cli/config/commands/reports.ts';
import { BASE_FLAG, FIX_FLAG, STAGED_FLAG } from '#cli/config/engine.ts';
import { TOOL_PROJECT_FILES } from '#cli/config/generation/files.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { HOOK_CHECKS } from '#cli/config/tools/installers.ts';
import { copyRevision } from '#cli/engine/copies/revision.ts';
import { buildEmptyRunReport } from '#cli/engine/report.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { readGitPaths, readGitText } from '#cli/repository/git/run.ts';
import { readTreeStatus } from '#cli/repository/revisions/changes.ts';
import { readIndexTree } from '#cli/repository/revisions/files.ts';
import { readSettings } from '#cli/settings/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { rewriteProgress, runCancelableCommand } from '#cli/system/terminal.ts';
import { formatNameList, formatNameState } from '#cli/system/text.ts';
import type { CommandDefinition, CommandLocation } from '#cli/types/commands/edits.ts';
import type { CheckCommandJson, CheckFlags, CheckOptions } from '#cli/types/commands/reports.ts';
import type { CommandResult } from '#cli/types/system.ts';

const EMPTY_CHECKS_MESSAGE = 'Name a check, such as python/ruff.';

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

function assertHookFlags(flags: CheckFlags, hook: NonNullable<CheckFlags['hook']>): void {
    const list = [
        flags.staged === true ? STAGED_FLAG : undefined,
        flags.base === undefined ? undefined : BASE_FLAG,
        flags.fix === true ? FIX_FLAG : undefined,
    ]
        .filter((value) => value !== undefined)
        .join(', ');
    if (list !== '')
        throw new GspotError(
            'arguments',
            `${list} cannot run with --hook ${hook}: ${HOOK_REFUSAL_REASONS[hook]}. Leave out ${list}.`,
        );
    if (hook === 'pre-push' && process.stdin.isTTY) throw new GspotError('arguments', PUSH_STDIN_MESSAGE);
}

function assertStagedFlags(options: CheckOptions, flags: CheckFlags): void {
    if (!options.staged) return;
    if (options.fix)
        throw new GspotError(
            'arguments',
            `--fix cannot run with ${STAGED_FLAG}: fixers change the working tree, not the staged files. Run gspot check --fix, then stage them with git add -p.`,
        );
    if (flags.base !== undefined)
        throw new GspotError('arguments', `${BASE_FLAG} cannot run with ${STAGED_FLAG}. Choose one file selection.`);
}

function assertCheckSelection(options: CheckOptions, flags: CheckFlags): void {
    const { only, skip } = options;
    if (flags.hook !== undefined) assertHookFlags(flags, flags.hook);
    assertStagedFlags(options, flags);
    if (only?.every((id) => skip?.includes(id) === true) === true)
        throw new GspotError(
            'arguments',
            `--skip leaves out every check that --only names: ${formatNameList(only)}. Change --only or --skip.`,
        );
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

function assertReadableMessageFile({ cwd, messageArgument }: CheckOptions): void {
    if (messageArgument === undefined) return;
    try {
        accessSync(resolve(cwd, messageArgument), constants.R_OK);
    } catch (error) {
        throw new GspotError('filesystem', `gspot cannot read the commit message file ${messageArgument}.`, {
            cause: error,
        });
    }
}

function readOnlyStage({ only, hook }: CheckFlags): CheckOptions['stage'] {
    const stage = CHECK_STAGES.find((name) => only?.includes(name) === true);
    if (stage === undefined) return undefined;
    if (only?.length !== 1)
        throw new GspotError(
            'arguments',
            `--only ${stage} runs every check of that stage, so it takes no other name. Name the stage, or name the checks.`,
        );
    if (hook !== undefined)
        throw new GspotError('arguments', `--only ${stage} cannot run with --hook. Choose a stage or a Git hook.`);
    return stage;
}

// The commit-msg hook passes an absolute path, and its `$PWD` may reach the repository through a symlink.
function formatMessageArgument(typed: string, cwd: string): string {
    if (!isAbsolute(typed) || !existsSync(typed)) return typed;
    return convertToPosixPath(relative(realpathSync(cwd), realpathSync(typed)));
}

async function assertSetupStaged(root: string, cancelSignal: AbortSignal): Promise<void> {
    const indexed = await readGitPaths(root, GIT_SETUP_FILES_ARGUMENTS, { cancelSignal });
    const unstaged = SETUP_PATHS.filter(
        (path) => existsSync(join(root, path)) && indexed.every((file) => !file.startsWith(path)),
    );
    if (unstaged.length > 0)
        throw new GspotError('git', `${formatNameState(unstaged, 'not staged')}. ${STAGE_SETUP_MESSAGE}`);
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
    // The disk holds the staged bytes, so checks run in place, unless gspot.toml has edits that the commit leaves out.
    if (selection.unstagedChanges === 0 && !unstagedPaths.has(SETTINGS_FILE))
        return await runTreeCheck(root, options, cancelSignal, {
            session: { toolsRoot: root, untracked: { paths: [], unreadablePaths: untracked.unreadablePaths } },
            started,
            selection: { ...selection, reference: await readIndexTree(root, cancelSignal) },
        });
    using copy = await copyRevision(root, { kind: 'index', paths: stagedPaths }, cancelSignal);
    // The tools on disk follow the tool files on disk, and the copy asks for the tools of the staged settings.
    const toolFiles = TOOL_PROJECT_FILES.filter((path) => unstagedPaths.has(path));
    const changed = `${formatNameList(toolFiles)} ${toolFiles.length === 1 ? 'has' : 'have'}`;
    return await runTreeCheck(copy.root, options, cancelSignal, {
        session: { toolsRoot: root, unreadablePaths: copy.unreadablePaths },
        started,
        selection: { ...selection, reference: copy.tree },
        ...(copy.dependencyNote !== undefined && { dependencyNote: copy.dependencyNote }),
        ...(toolFiles.length > 0 && { missingToolsNote: UNSTAGED_TOOLS_NOTE.replace('<files>', () => changed) }),
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
        const session = { settings: readSettings(text, root), listing };
        return await runTreeCheck(root, { ...options, session }, cancelSignal);
    }
    return await (options.staged
        ? runStagedCheck(root, options, cancelSignal)
        : runTreeCheck(root, options, cancelSignal));
}

async function runCheckCommand({
    root,
    ...options
}: CheckOptions & CommandLocation): Promise<CommandResult<CheckCommandJson>> {
    try {
        const result = await runCancelableCommand(
            (cancelSignal) => runCheckSelection(root, options, cancelSignal),
            CHECK_STOPPED_MESSAGE,
        );
        return { ...result, annotations: formatAnnotations(result.json) };
    } finally {
        rewriteProgress('');
    }
}

export const CHECK_COMMAND: CommandDefinition<[string[]], CheckFlags, CheckOptions> = {
    name: 'check',
    arguments: [{ term: '[paths...]' }],
    options: [
        { flags: ONLY_OPTION, list: EMPTY_CHECKS_MESSAGE },
        { flags: SKIP_OPTION, list: EMPTY_CHECKS_MESSAGE },
        { flags: STAGED_FLAG },
        { flags: BASE_OPTION },
        { flags: FIX_FLAG },
        { flags: HOOK_OPTION, choices: CHECK_INPUT_HOOKS, hidden: true },
    ],
    parse: ({ arguments: commandArguments, flags, cwd }) => {
        const [paths] = commandArguments;
        const { hook } = flags;
        const onlyStage = readOnlyStage(flags);
        const messagePath = hook === 'commit-msg' ? paths[0] : undefined;
        const options: CheckOptions = {
            cwd,
            staged: flags.staged === true,
            fix: flags.fix === true,
            verbose: flags.verbose === true,
            paths: hook === 'commit-msg' ? [] : paths,
            hook,
            only: onlyStage === undefined ? flags.only : undefined,
            skip: flags.skip,
            base: flags.base,
            messageFile: messagePath === undefined ? undefined : resolve(cwd, messagePath),
            messageArgument: messagePath === undefined ? undefined : formatMessageArgument(messagePath, cwd),
            stage: hook === undefined ? onlyStage : HOOK_CHECKS[hook].stages[0],
        };
        assertCheckSelection(options, flags);
        assertMessageSelection(options, paths);
        assertReadableMessageFile(options);
        return options;
    },
    run: runCheckCommand,
};
