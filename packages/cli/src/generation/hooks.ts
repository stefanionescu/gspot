import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import type { HookName, GeneratedFile } from '#cli/types/generation/files.ts';
import type { StartRunner } from '#cli/types/repository/npm/package-manager.ts';

import {
    LFS_HOOKS,
    HOOK_CHECKS,
    HOOK_SHEBANG,
    PUSH_INPUT_SAVE,
    LFS_MISSING_GUARD,
    PUSH_INPUT_REPLAY,
    COMMIT_MESSAGE_PATH_LINES,
} from '#cli/config/generation/hooks.ts';

function buildHookScript(name: HookName, runner: StartRunner, lfsHooks: readonly string[]): string {
    const program = runner.name;
    const { missing } = runner;
    const messagePathLines = name === 'commit-msg' ? COMMIT_MESSAGE_PATH_LINES : [];
    const isLfs = lfsHooks.includes(name);
    const replay = isLfs ? PUSH_INPUT_REPLAY : '';
    const body = [
        ...(isLfs ? [LFS_MISSING_GUARD, PUSH_INPUT_SAVE, `${replay}git lfs ${name} "$@" || exit $?`] : []),
        ...messagePathLines,
        `command -v ${program} >/dev/null 2>&1 || { echo '${missing}' >&2; exit 2; }`,
        `${isLfs ? replay : 'exec '}${runner.command} ${HOOK_CHECKS[name].arguments}`,
        '',
    ].join('\n');
    return `${HOOK_SHEBANG}\n${body}`;
}

/**
Build a script for each hook that runs a check. Include hooks for Git Large File Storage (LFS) when the repository uses it.

@param runner the command that starts gspot.
@param names the hooks that run a configured check.
@param options the repository features the hooks need.
@param options.hasLfsFiles whether tracked files use Git Large File Storage.
*/
export function buildHookFiles(
    runner: StartRunner,
    names: HookName[],
    options: { hasLfsFiles: boolean },
): GeneratedFile[] {
    const lfsHooks: readonly string[] = options.hasLfsFiles ? LFS_HOOKS : [];
    const lfsOnly = lfsHooks.filter((name) => !(names as readonly string[]).includes(name));
    return [
        ...names.map((name) => ({ name, content: buildHookScript(name, runner, lfsHooks) })),
        ...lfsOnly.map((name) => ({
            name,
            content: `${HOOK_SHEBANG}\n${LFS_MISSING_GUARD}\nexec git lfs ${name} "$@"\n`,
        })),
    ].map(({ name, content }) => ({ path: `${GSPOT_PATHS.hooks}/${name}`, content, executable: true }));
}
