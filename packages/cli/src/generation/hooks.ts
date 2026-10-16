import { readGitPrefix } from '#cli/system/git.ts';
import { name as cliName } from '../../package.json';
import { selectNpmClient } from '#cli/tools/npm/client.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { isGitRepository } from '#cli/repository/find-root.ts';
import { HOOKS_DIRECTORY } from '#cli/config/system/locations.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import type { HookName, StartRunner, GeneratedFile } from '#cli/types/generation/files.ts';
import { RUNNERS, HOOK_ARGS, HOOK_SHEBANG, COMMIT_MESSAGE_PATH_LINES } from '#cli/config/generation/hooks.ts';

// The script of one hook. Git runs it from the top level; a commit message path Git gives relative to there
// becomes absolute first, in the Windows spelling under Git for Windows.
function hookScript(name: HookName, runner: StartRunner, prefix: string): string {
    const program = runner.name;
    const { missing } = runner;
    const quoted = prefix.replaceAll("'", String.raw`'\''`);
    const absolutePath = name === 'commit-msg' ? COMMIT_MESSAGE_PATH_LINES : [];
    const body = [
        ...absolutePath,
        ...(prefix === '' ? [] : [`cd '${quoted}' || exit 2`]),
        `command -v ${program} >/dev/null 2>&1 || { echo '${program} is not installed. ${missing}' >&2; exit 2; }`,
        `exec ${hookLine(name, runner)}`,
        '',
    ].join('\n');
    return `${HOOK_SHEBANG}\n${body}`;
}

/**
 * Select the start command from the root gspot dependency.
 *
 * @param root the repository root.
 *
 * @returns the package manager row, or mise when gspot has no root npm dependency.
 */
export async function startRunner(root: string): Promise<StartRunner> {
    const manifest = readPackageJson(root, 'package.json');
    const hasDependency =
        manifest?.dependencies?.[cliName] !== undefined || manifest?.devDependencies?.[cliName] !== undefined;
    const client = hasDependency ? await selectNpmClient(root, []) : undefined;
    const name = client === undefined ? 'mise' : client.name;
    const runner = RUNNERS[name];
    return { name, ...runner, pin: runner.pin.replace('<package>', cliName) };
}

/**
 * The command a hook runs for one stage through the repository package manager or mise.
 *
 * @param name the hook.
 * @param runner the start command selected from the repository gspot dependency.
 *
 * @returns the command line.
 */
export function hookLine(name: HookName, runner: StartRunner): string {
    return `${runner.command} ${HOOK_ARGS[name]}`;
}

/**
 * The hook scripts, one per stage, in the hooks folder of the repository, when the settings selects hooks.
 *
 * @param root the repository root.
 * @param settings the repository settings.
 * @param runner the start command selected from the repository pin.
 *
 * @returns the generated files.
 */
export function hookFiles(root: string, settings: Settings, runner: StartRunner): GeneratedFile[] {
    if (settings.hooks?.enabled !== true) return [];
    const prefix = readGitPrefix(root, isGitRepository(root));
    return (Object.keys(HOOK_ARGS) as HookName[]).map((name) => ({
        path: `${HOOKS_DIRECTORY}/${name}`,
        content: hookScript(name, runner, prefix),
        executable: true,
        kind: 'hook',
    }));
}
