import type { PlannedCheck } from '#cli/types/planning.ts';
import { HOOKS_PATH } from '#cli/config/system/locations.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { readGitPrefix, isGitRepository } from '#cli/system/git.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import { selectPackageManager } from '#cli/repository/package-manager.ts';
import { LFS_FILTER, FILTER_ATTRIBUTE } from '#cli/config/repository/inventory.ts';
import type { HookName, StartRunner, LfsHookName, GeneratedFile } from '#cli/types/generation/files.ts';

import {
    RUNNERS,
    LFS_HOOKS,
    HOOK_STAGES,
    CHECK_HOOKS,
    HOOK_SHEBANG,
    HOOK_ARGUMENTS,
    PUSH_INPUT_SAVE,
    PUSH_INPUT_REPLAY,
    COMMIT_MESSAGE_PATH_LINES,
} from '#cli/config/generation/hooks.ts';

function isLfsHook(name: string): name is LfsHookName {
    return (LFS_HOOKS as readonly string[]).includes(name);
}

// The script of one hook. Git runs it from the top level; a commit message path Git gives relative to there
// becomes absolute first, in the Windows spelling under Git for Windows. In a repository that uses Git Large File Storage (LFS), the hook
// runs git lfs first, and the pre-push hook saves its input so that both commands read it.
function buildHookScript(name: HookName, runner: StartRunner, prefix: string, usesLfs: boolean): string {
    const program = runner.name;
    const { missing, pin } = runner;
    const install = pin.includes('<version>') ? pin : `${pin} ${packageManifest.name}@<version>`;
    const quoted = prefix.replaceAll("'", String.raw`'\''`);
    const absolutePath = name === 'commit-msg' ? COMMIT_MESSAGE_PATH_LINES : [];
    const lfs = usesLfs && isLfsHook(name);
    const replay = lfs ? PUSH_INPUT_REPLAY : '';
    const body = [
        ...(lfs
            ? [
                  PUSH_INPUT_SAVE,
                  `if command -v git-lfs >/dev/null 2>&1; then ${replay}git lfs ${name} "$@" || exit $?; fi`,
              ]
            : []),
        ...absolutePath,
        ...(prefix === '' ? [] : [`cd '${quoted}' || exit 2`]),
        `command -v ${program} >/dev/null 2>&1 || { echo '${program} is not installed. ${missing} Install gspot with: ${install}' >&2; exit 2; }`,
        `${lfs ? replay : 'exec '}${runner.command} ${HOOK_ARGUMENTS[name]}`,
        '',
    ].join('\n');
    return `${HOOK_SHEBANG}\n${body}`;
}

// A Git LFS hook that runs no check: it calls git lfs, and does nothing without git-lfs.
function buildLfsHookScript(name: LfsHookName): string {
    return `${HOOK_SHEBANG}\ncommand -v git-lfs >/dev/null 2>&1 || exit 0\nexec git lfs ${name} "$@"\n`;
}

/**
 * Check whether the tracked files use Git LFS, so that the hooks of gspot run it in place of the Git LFS hooks.
 *
 * @param attributes the Git attributes of each tracked file.
 *
 * @returns whether a tracked file has the LFS filter.
 */
export function usesGitLfs(attributes: Repository['attributes']): boolean {
    return attributes.values().some((values) => values[FILTER_ATTRIBUTE] === LFS_FILTER);
}

/**
 * Select the runner from the root gspot dependency.
 *
 * @param repositoryRoot the folder whose package.json decides the runner.
 *
 * @returns the runner of the package manager, or mise when gspot has no root npm dependency.
 */
export async function selectRunner(repositoryRoot: string): Promise<StartRunner> {
    const packageJson = readPackageJson(repositoryRoot, 'package.json');
    const hasDependency =
        packageJson?.dependencies?.[packageManifest.name] !== undefined ||
        packageJson?.devDependencies?.[packageManifest.name] !== undefined;
    const packageManager = hasDependency ? await selectPackageManager(repositoryRoot, []) : undefined;
    const name = packageManager === undefined ? 'mise' : packageManager.name;
    const runner = RUNNERS[name];
    return { name, ...runner, pin: runner.pin.replace('<package>', packageManifest.name) };
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
    return CHECK_HOOKS.filter((name) => HOOK_STAGES[name].some((stage) => stages.has(stage)));
}

/**
 * Build a script for each hook, when the settings turn hooks on.
 *
 * @param repositoryRoot the folder for Git detection and hook command prefixes.
 * @param settings the parsed gspot.toml.
 * @param runner the command that starts gspot.
 * @param hooks the hooks to write.
 * @param hooks.names the hooks that run a configured check.
 * @param hooks.usesLfs whether the tracked files use Git LFS, which needs its four hooks.
 *
 * @returns the hook scripts.
 */
export function buildHookFiles(
    repositoryRoot: string,
    settings: Settings,
    runner: StartRunner,
    hooks: { names: HookName[]; usesLfs: boolean },
): GeneratedFile[] {
    if (settings.hooks?.enabled !== true) return [];
    const { names, usesLfs } = hooks;
    const prefix = isGitRepository(repositoryRoot) ? readGitPrefix(repositoryRoot) : '';
    const lfsOnly = usesLfs ? LFS_HOOKS.filter((name) => !(names as readonly string[]).includes(name)) : [];
    return [
        ...names.map((name) => ({ name, content: buildHookScript(name, runner, prefix, usesLfs) })),
        ...lfsOnly.map((name) => ({ name, content: buildLfsHookScript(name) })),
    ].map(({ name, content }) => ({ path: `${HOOKS_PATH}/${name}`, content, executable: true, kind: 'hook' }));
}
