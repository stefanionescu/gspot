import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { HookName, GeneratedFile } from '#cli/types/generation/files.ts';
import type { StartRunner } from '#cli/types/repository/npm/package-manager.ts';

import {
    LFS_HOOKS,
    CHECK_HOOKS,
    HOOK_CHECKS,
    HOOK_SHEBANG,
    PUSH_INPUT_SAVE,
    LFS_GUARD_PREFIX,
    PUSH_INPUT_REPLAY,
    COMMIT_MESSAGE_PATH_LINES,
} from '#cli/config/generation/hooks.ts';

function buildHookScript(name: HookName, runner: StartRunner): string {
    const program = runner.name;
    const { missing } = runner;
    const installCommand = runner.installCommand.replace('<version>', () => cliPackage.version);
    const messagePathLines = name === 'commit-msg' ? COMMIT_MESSAGE_PATH_LINES : [];
    const isLfs = (LFS_HOOKS as readonly string[]).includes(name);
    const replay = isLfs ? PUSH_INPUT_REPLAY : '';
    const body = [
        ...(isLfs
            ? [
                  PUSH_INPUT_SAVE,
                  `if command -v git-lfs >/dev/null 2>&1; then ${replay}git lfs ${name} "$@" || exit $?; fi`,
              ]
            : []),
        ...messagePathLines,
        `command -v ${program} >/dev/null 2>&1 || { echo '${program} is not installed. ${missing} Install gspot with: ${installCommand}' >&2; exit 2; }`,
        `${isLfs ? replay : 'exec '}${runner.command} ${HOOK_CHECKS[name].arguments}`,
        '',
    ].join('\n');
    return `${HOOK_SHEBANG}\n${body}`;
}

/**
List the hooks that run at least one configured check.

@param checks the configured checks.

@returns the hook names, in the order Git runs them.
*/
export function listHookNames(checks: PlannedCheck[]): HookName[] {
    const stages = new Set<string>(checks.map((planned) => planned.check.stage));
    return CHECK_HOOKS.filter((name) => HOOK_CHECKS[name].stages.some((stage) => stages.has(stage)));
}

/**
Build a script for each hook that runs a check, and one for each other hook of Git Large File Storage (LFS), which
runs git lfs when Git has it.

@param runner the command that starts gspot.
@param names the hooks that run a configured check.
@returns the hook scripts.
*/
export function buildHookFiles(runner: StartRunner, names: HookName[]): GeneratedFile[] {
    const lfsOnly = LFS_HOOKS.filter((name) => !(names as readonly string[]).includes(name));
    return [
        ...names.map((name) => ({ name, content: buildHookScript(name, runner) })),
        ...lfsOnly.map((name) => ({
            name,
            content: `${HOOK_SHEBANG}\n${LFS_GUARD_PREFIX}exit 0\nexec git lfs ${name} "$@"\n`,
        })),
    ].map(({ name, content }) => ({ path: `${GSPOT_PATHS.hooks}/${name}`, content, executable: true }));
}
