import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Settings } from '#cli/types/settings/file.ts';
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

// The script of one hook. Git runs it from the top level; a commit message path Git gives relative to there becomes
// absolute first, in the Windows spelling under Git for Windows. In a repository that uses
// Git Large File Storage (LFS), the hook runs git lfs first, and the pre-push hook saves its input so that both
// commands read it.
function buildHookScript(name: HookName, runner: StartRunner, { usesLfs }: { usesLfs: boolean }): string {
    const program = runner.name;
    const { missing, installCommand } = runner;
    const absolutePath = name === 'commit-msg' ? COMMIT_MESSAGE_PATH_LINES : [];
    const lfs = usesLfs && (LFS_HOOKS as readonly string[]).includes(name);
    const replay = lfs ? PUSH_INPUT_REPLAY : '';
    const body = [
        ...(lfs
            ? [
                  PUSH_INPUT_SAVE,
                  `if command -v git-lfs >/dev/null 2>&1; then ${replay}git lfs ${name} "$@" || exit $?; fi`,
              ]
            : []),
        ...absolutePath,
        `command -v ${program} >/dev/null 2>&1 || { echo '${program} is not installed. ${missing} Install gspot with: ${installCommand}' >&2; exit 2; }`,
        `${lfs ? replay : 'exec '}${runner.command} ${HOOK_CHECKS[name].arguments}`,
        '',
    ].join('\n');
    return `${HOOK_SHEBANG}\n${body}`;
}

/**
 * List the hooks that run at least one configured check.
 *
 * @param checks the configured checks.
 *
 * @returns the hook names, in the order Git runs them.
 */
export function listHookNames(checks: PlannedCheck[]): HookName[] {
    const stages = new Set<string>(checks.map((planned) => planned.check.stage));
    return CHECK_HOOKS.filter((name) => HOOK_CHECKS[name].stages.some((stage) => stages.has(stage)));
}

/**
 * Build a script for each hook, when the settings turn hooks on.
 *
 * @param settings the parsed gspot.toml.
 * @param runner the command that starts gspot.
 * @param hooks the hooks to write.
 * @param hooks.names the hooks that run a configured check.
 * @param hooks.usesLfs whether the tracked files use Git Large File Storage, which needs every hook in LFS_HOOKS.
 * @returns the hook scripts.
 */
export function buildHookFiles(
    settings: Settings,
    runner: StartRunner,
    hooks: { names: HookName[]; usesLfs: boolean },
): GeneratedFile[] {
    if (settings.hooks?.enabled !== true) return [];
    const { names, usesLfs } = hooks;
    const lfsOnly = usesLfs ? LFS_HOOKS.filter((name) => !(names as readonly string[]).includes(name)) : [];
    return [
        ...names.map((name) => ({ name, content: buildHookScript(name, runner, { usesLfs }) })),
        ...lfsOnly.map((name) => ({
            name,
            content: `${HOOK_SHEBANG}\n${LFS_GUARD_PREFIX}exit 0\nexec git lfs ${name} "$@"\n`,
        })),
    ].map(({ name, content }) => ({ path: `${GSPOT_PATHS.hooks}/${name}`, content, executable: true }));
}
