import cliPackage from '#cli-package' with { type: 'json' };
import {
    COMMIT_MESSAGE_PATH_LINES,
    LFS_MISSING_GUARD,
    PUSH_INPUT_REPLAY,
    PUSH_INPUT_SAVE,
} from '#cli/config/generation.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { HOOK_SHEBANG, LFS_HOOKS } from '#cli/config/repository/setup.ts';
import { HOOK_CHECKS } from '#cli/config/tools/installers.ts';
import { quoteArgument } from '#cli/system/text.ts';
import type { StartRunner } from '#cli/types/repository.ts';
import type { GeneratedFile, HookName } from '#cli/types/tools.ts';

// Yarn Plug'n'Play keeps packages out of node_modules, so its loader file shows that the project is installed.
const YARN_PNP_FILE = '.pnp.cjs';

function buildInstallGuard(name: Exclude<StartRunner['name'], 'mise'>): string {
    const pnp = name === 'yarn' ? `test -f ${YARN_PNP_FILE} || ` : '';
    const installed = `test -f node_modules/${cliPackage.name}/package.json`;
    const message = quoteArgument(`gspot is not installed in this worktree. Run ${name} install, then gspot install.`);
    return String.raw`${pnp}${installed} || { printf '%s\n' ${message} >&2; exit 2; }`;
}

function buildHookScript(name: HookName, runner: StartRunner, lfsHooks: readonly string[]): string {
    const program = runner.command.split(' ', 1)[0] as string;
    const { missing } = runner;
    const messagePathLines = name === 'commit-msg' ? COMMIT_MESSAGE_PATH_LINES : [];
    const isLfs = lfsHooks.includes(name);
    const check = `${runner.command} ${HOOK_CHECKS[name].arguments}`;
    const body = [
        ...(isLfs ? [LFS_MISSING_GUARD, PUSH_INPUT_SAVE] : []),
        ...messagePathLines,
        `command -v ${program} >/dev/null 2>&1 || { printf ${quoteArgument(missing.replace('$PATH', '%s') + '\n')} "$PATH" >&2; exit 2; }`,
        ...(runner.name === 'mise' ? [] : [buildInstallGuard(runner.name)]),
        ...(isLfs
            ? [`${PUSH_INPUT_REPLAY}${check} || exit $?`, `${PUSH_INPUT_REPLAY}git lfs ${name} "$@"`]
            : [`exec ${check}`]),
        '',
    ].join('\n');
    return `${HOOK_SHEBANG}\n${body}`;
}

/**
Build a script for each hook that runs a check. Include hooks for Git Large File Storage (LFS) when the repository uses it.
The pre-push hook runs the checks before the LFS upload, so a push that the checks refuse uploads nothing.

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
