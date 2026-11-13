import { accessSync, constants, existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { formatAnnotations } from '#cli/commands/check/annotations.ts';
import { runPushCheck } from '#cli/commands/check/push.ts';
import { runStagedCheck } from '#cli/commands/check/staged.ts';
import { runTreeCheck } from '#cli/commands/check/tree.ts';
import {
    CHECK_INPUT_HOOKS,
    CHECK_STAGES,
    CHECK_STOPPED_MESSAGE,
    COMMIT_FILE_MESSAGE,
    EMPTY_CHECKS_MESSAGE,
    GIT_STAGED_SETTINGS_ARGUMENTS,
    HOOK_REFUSAL_REASONS,
    PUSH_STDIN_MESSAGE,
} from '#cli/config/commands/check.ts';
import { BASE_OPTION, HOOK_OPTION, ONLY_OPTION, SKIP_OPTION } from '#cli/config/commands/help.ts';
import { BASE_FLAG, FIX_FLAG, STAGED_FLAG } from '#cli/config/engine.ts';
import { HOOK_CHECKS } from '#cli/config/tools/installers.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { readGitText } from '#cli/repository/git/run.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import { GspotError } from '#cli/system/errors.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { runCancelableCommand } from '#cli/system/processes/signals.ts';
import { readPushInput, rewriteProgress } from '#cli/system/terminal.ts';
import { formatNameList } from '#cli/system/text/messages.ts';
import type {
    CheckCommandJson,
    CheckFlags,
    CheckOptions,
    CommandDefinition,
    CommandLocation,
} from '#cli/types/commands.ts';
import type { CommandResult } from '#cli/types/system.ts';

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

function selectOnlyStage({ only, hook }: CheckFlags): CheckOptions['stage'] {
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
        const session = { settings: parseSettings(text, root), listing };
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
        const onlyStage = selectOnlyStage(flags);
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
