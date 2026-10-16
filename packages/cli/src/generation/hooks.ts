import { name as cliName } from '../../package.json';
import type { Settings } from '#cli/types/settings/values.ts';
import { HOOKS_DIRECTORY } from '#cli/config/system/locations.ts';
import { readGitPrefix, isGitRepository } from '#cli/system/git.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import { selectPackageManager } from '#cli/tools/npm/package-manager.ts';
import type { HookName, StartRunner, GeneratedFile } from '#cli/types/generation/files.ts';
import { RUNNERS, HOOK_ARGS, HOOK_SHEBANG, COMMIT_MESSAGE_PATH_LINES } from '#cli/config/generation/hooks.ts';

// The script of one hook. Git runs it from the top level; a commit message path Git gives relative to there
// becomes absolute first, in the Windows spelling under Git for Windows.
function buildHookScript(name: HookName, runner: StartRunner, prefix: string): string {
    const program = runner.name;
    const { missing } = runner;
    const quoted = prefix.replaceAll("'", String.raw`'\''`);
    const absolutePath = name === 'commit-msg' ? COMMIT_MESSAGE_PATH_LINES : [];
    const body = [
        ...absolutePath,
        ...(prefix === '' ? [] : [`cd '${quoted}' || exit 2`]),
        `command -v ${program} >/dev/null 2>&1 || { echo '${program} is not installed. ${missing}' >&2; exit 2; }`,
        `exec ${formatHookCommand(name, runner)}`,
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
export async function selectRunner(root: string): Promise<StartRunner> {
    const manifest = readPackageJson(root, 'package.json');
    const hasDependency =
        manifest?.dependencies?.[cliName] !== undefined || manifest?.devDependencies?.[cliName] !== undefined;
    const client = hasDependency ? await selectPackageManager(root, []) : undefined;
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
export function formatHookCommand(name: HookName, runner: StartRunner): string {
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
export function buildHookFiles(root: string, settings: Settings, runner: StartRunner): GeneratedFile[] {
    if (settings.hooks?.enabled !== true) return [];
    const prefix = isGitRepository(root) ? readGitPrefix(root) : '';
    return (Object.keys(HOOK_ARGS) as HookName[]).map((name) => ({
        path: `${HOOKS_DIRECTORY}/${name}`,
        content: buildHookScript(name, runner, prefix),
        executable: true,
        kind: 'hook',
    }));
}
