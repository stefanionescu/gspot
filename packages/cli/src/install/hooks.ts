import { GspotError } from '#cli/system/errors.ts';
import { join, resolve, relative } from 'node:path';
import type { Session } from '#cli/types/session.ts';
import { listHookNames } from '#cli/generation/hooks.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { readHooks } from '#cli/repository/setup/tools.ts';
import { statSync, readdirSync, readFileSync } from 'node:fs';
import { type Repository } from '#cli/types/repository/files.ts';
import { type RepositorySetup } from '#cli/types/repository/setup.ts';
import type { HookPlan, HookStatus } from '#cli/types/install/hooks.ts';
import { HOOKS_PATH_SETTING } from '#cli/config/repository/setup/tools.ts';
import { readGitSetting, runGitBlocking, readHooksFolder } from '#cli/system/git.ts';
import { LFS_HOOKS, HOOK_CHECKS, HOOK_SHEBANG, LFS_GUARD_PREFIX } from '#cli/config/generation/hooks.ts';
import { LFS_PUSH_CALLS, SET_HOOKS_PATH, UNSET_HOOKS_PATH, SAMPLE_HOOK_SUFFIX } from '#cli/config/install/hooks.ts';

// Check whether git lfs install wrote a hook: a shebang, an optional git-lfs guard, and the git lfs call.
// The hooks of gspot run Git Large File Storage (LFS) themselves.
function isLfsHookScript(folder: string, name: string): boolean {
    if (!(LFS_HOOKS as readonly string[]).includes(name)) return false;
    const lines = readFileSync(join(folder, name), 'utf8').trim().split(/\r?\n/u);
    const call = lines.at(-1) ?? '';
    const isCall = call === `git lfs ${name} "$@"` || (name === 'pre-push' && LFS_PUSH_CALLS.has(call));
    return lines[0] === HOOK_SHEBANG && isCall && lines.slice(1, -1).every((line) => line.startsWith(LFS_GUARD_PREFIX));
}

// Find the hooks that another setup in this clone runs: another hooks folder, a hook tool,
// or scripts in the default Git hooks folder.
function readForeignHooks(root: string, own: string): RepositorySetup['hooks'] {
    const found = readHooks(root).filter((hook) => !(hook.kind === 'hooksPath' && hook.path === own));
    const folder = readHooksFolder(root);
    if (
        readGitSetting(root, HOOKS_PATH_SETTING) !== undefined ||
        statSync(folder, { throwIfNoEntry: false }) === undefined
    )
        return found;
    const scripts = readdirSync(folder, { withFileTypes: true }).filter(
        (entry) => entry.isFile() && !entry.name.endsWith(SAMPLE_HOOK_SUFFIX) && !isLfsHookScript(folder, entry.name),
    );
    return scripts.length === 0
        ? found
        : [
              ...found,
              {
                  kind: 'hooksPath',
                  path: convertToPosixPath(relative(root, folder)),
                  files: scripts.map((entry) => entry.name),
              },
          ];
}

// List the commands that another hook setup must run. Install and the status line share this text.
function formatForeignHooks(hooks: RepositorySetup['hooks'], session: Session): string {
    const runner = session.startRunner;
    const names = listHookNames(session.configuredChecks);
    const lines = names.map((name) => `  ${name}: ${runner.command} ${HOOK_CHECKS[name].arguments}`);
    return `hooks already run from ${hooks.map((hook) => hook.path).join(', ')}; add these gspot lines to them:\n${lines.join('\n')}`;
}

/**
 * Plan the Git setting, or the instructions for existing hooks, and change no hooks.
 *
 * @param session the settings, repository, runner, and configured checks.
 *
 * @returns the command and a note, or instructions for existing hooks.
 */
function planHooks(session: Session): HookPlan {
    const { repository } = session;
    const { settings } = session.settingsFile;
    if (settings.hooks?.enabled !== true)
        return readGitSetting(repository.root, HOOKS_PATH_SETTING) === GSPOT_PATHS.hooks
            ? { command: UNSET_HOOKS_PATH, note: 'disabled hooks: unset core.hooksPath' }
            : { note: '' };
    const foreign = readForeignHooks(repository.root, GSPOT_PATHS.hooks);
    if (foreign.length > 0) return { note: formatForeignHooks(foreign, session) };
    return {
        command: [...SET_HOOKS_PATH, GSPOT_PATHS.hooks],
        note: `set core.hooksPath to ${GSPOT_PATHS.hooks}`,
    };
}

/**
 * Set the planned Git setting, or report the instructions for existing hooks.
 *
 * @param session what the hook plan reads.
 * @param steps collects each command that install runs.
 *
 * @returns the install summary.
 */
export function installHooks(session: Session, steps: (readonly string[])[]): string {
    if (!session.repository.hasGit) return '';
    const plan = planHooks(session);
    if (plan.command !== undefined) {
        steps.push(plan.command);
        const result = runGitBlocking(session.repository.root, plan.command.slice(1));
        if (result.code !== 0) throw new GspotError('install', `Cannot set core.hooksPath: ${result.stderr.trim()}`);
    }
    return plan.note;
}

/**
 * Check whether the hooks in the settings run in this clone.
 *
 * @param session the settings, runner, and configured checks.
 * @param clone the Git clone whose hooks to inspect.
 *
 * @returns whether the hooks run, and the status line.
 */
export function readHookStatus(session: Session, clone: Pick<Repository, 'root' | 'hasGit'>): HookStatus {
    const { settings } = session.settingsFile;
    if (settings.hooks?.enabled !== true) return { ready: true, text: 'none' };
    if (!clone.hasGit) return { ready: false, text: 'not installed: no Git repository' };
    if (readGitSetting(clone.root, HOOKS_PATH_SETTING) === GSPOT_PATHS.hooks) return { ready: true, text: 'installed' };
    const foreign = readForeignHooks(clone.root, GSPOT_PATHS.hooks);
    if (foreign.length > 0) {
        const paths = foreign.flatMap((hook) => {
            if (hook.files.length === 0) return [resolve(clone.root, hook.path)];
            const folder = hook.kind === 'hooksPath' ? readHooksFolder(clone.root) : resolve(clone.root, hook.path);
            return hook.files.map((file) => resolve(folder, file));
        });
        const texts = paths.map((file) => readFileSync(file, 'utf8'));
        const ready = listHookNames(session.configuredChecks).every((name) =>
            texts.some((text) => text.includes(`check --hook ${name}`)),
        );
        return {
            ready,
            text: ready
                ? `run from ${foreign.map((hook) => hook.path).join(', ')}`
                : `not installed; ${formatForeignHooks(foreign, session)}`,
        };
    }
    return { ready: false, text: 'not installed; run gspot install' };
}
