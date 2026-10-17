import { name as cliName } from '../../package.json';
import { HOOKS_PATH } from '#cli/config/system/locations.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import { readGitPrefix, isGitRepository } from '#cli/system/git.ts';
import { readPackageJson } from '#cli/repository/dependency-files.ts';
import { selectPackageManager } from '#cli/tools/npm/package-manager.ts';
import type { HookName, StartRunner, GeneratedFile } from '#cli/types/generation/files.ts';
import { RUNNERS, HOOK_SHEBANG, HOOK_ARGUMENTS, COMMIT_MESSAGE_PATH_LINES } from '#cli/config/generation/hooks.ts';

// The script of one hook. Git runs it from the top level; a commit message path Git gives relative to there
// becomes absolute first, in the Windows spelling under Git for Windows.
function buildHookScript(name: HookName, runner: StartRunner, prefix: string): string {
    const program = runner.name;
    const { missing, pin } = runner;
    const install = pin.includes('<version>') ? pin : `${pin} ${cliName}@<version>`;
    const quoted = prefix.replaceAll("'", String.raw`'\''`);
    const absolutePath = name === 'commit-msg' ? COMMIT_MESSAGE_PATH_LINES : [];
    const body = [
        ...absolutePath,
        ...(prefix === '' ? [] : [`cd '${quoted}' || exit 2`]),
        `command -v ${program} >/dev/null 2>&1 || { echo '${program} is not installed. ${missing} Install gspot with: ${install}' >&2; exit 2; }`,
        `exec ${runner.command} ${HOOK_ARGUMENTS[name]}`,
        '',
    ].join('\n');
    return `${HOOK_SHEBANG}\n${body}`;
}

/**
 * Select the runner from the root gspot dependency.
 *
 * @param repositoryRoot the folder whose package.json decides the runner.
 *
 * @returns the runner of the package manager, or mise when gspot has no root npm dependency.
 */
export async function selectRunner(repositoryRoot: string): Promise<StartRunner> {
    const manifest = readPackageJson(repositoryRoot, 'package.json');
    const hasDependency =
        manifest?.dependencies?.[cliName] !== undefined || manifest?.devDependencies?.[cliName] !== undefined;
    const packageManager = hasDependency ? await selectPackageManager(repositoryRoot, []) : undefined;
    const name = packageManager === undefined ? 'mise' : packageManager.name;
    const runner = RUNNERS[name];
    return { name, ...runner, pin: runner.pin.replace('<package>', cliName) };
}

/**
 * Build one hook script per stage in the hooks folder, when the settings turn hooks on.
 *
 * @param repositoryRoot the folder for Git detection and hook command prefixes.
 * @param settings the parsed gspot.toml.
 * @param runner the command that starts gspot.
 *
 * @returns the hook scripts.
 */
export function buildHookFiles(repositoryRoot: string, settings: Settings, runner: StartRunner): GeneratedFile[] {
    if (settings.hooks?.enabled !== true) return [];
    const prefix = isGitRepository(repositoryRoot) ? readGitPrefix(repositoryRoot) : '';
    return (Object.keys(HOOK_ARGUMENTS) as HookName[]).map((name) => ({
        path: `${HOOKS_PATH}/${name}`,
        content: buildHookScript(name, runner, prefix),
        executable: true,
        kind: 'hook',
    }));
}
