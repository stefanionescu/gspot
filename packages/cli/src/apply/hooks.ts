import { resolve, relative } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { HOOKS_PATH } from '#cli/config/system/locations.ts';
import { readHooks } from '#cli/repository/existing-tools.ts';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { HOOK_ARGUMENTS } from '#cli/config/generation/hooks.ts';
import { HOOKS_PATH_SETTING } from '#cli/config/repository/hooks.ts';
import type { ExistingTools } from '#cli/types/repository/inventory.ts';
import type { HookPlan, HookStatus, HookContext } from '#cli/types/install.ts';
import { readGitPrefix, readGitSetting, runGitBlocking, readHooksFolder } from '#cli/system/git.ts';
import { HOOK_COMMAND, SET_HOOKS_PATH, UNSET_HOOKS_PATH, SAMPLE_HOOK_SUFFIX } from '#cli/config/install.ts';

// Find the hooks that another setup in this clone runs: another hooks folder, a hook tool,
// or scripts in the default Git hooks folder.
function readForeignHooks(root: string, own: string): ExistingTools['hooks'] {
    const found = readHooks(root).filter((hook) => !(hook.kind === 'hooksPath' && hook.path === own));
    const folder = readHooksFolder(root);
    if (readGitSetting(root, HOOKS_PATH_SETTING) !== undefined || !existsSync(folder)) return found;
    const scripts = readdirSync(folder, { withFileTypes: true }).filter(
        (entry) => entry.isFile() && !entry.name.endsWith(SAMPLE_HOOK_SUFFIX),
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

// The hooks folder of gspot, relative to the Git top level, as core.hooksPath names it.
function readHooksPath(root: string): string {
    return `${readGitPrefix(root)}${HOOKS_PATH}`;
}

// List the commands that another hook setup must run. Install and the status line share this text.
function formatForeignHooks(hooks: ExistingTools['hooks'], { runner, hooks: names }: HookContext): string {
    const lines = names.map((name) => `  ${name}: ${runner.command} ${HOOK_ARGUMENTS[name]}`);
    return `hooks already run from ${hooks.map((hook) => hook.path).join(', ')}; add these gspot lines to them:\n${lines.join('\n')}`;
}

/**
 * Plan the Git setting, or the instructions for existing hooks, and change no hooks.
 *
 * @param context what the plan reads: the settings, the repository, the runner, and the hooks to run.
 *
 * @returns the command and a note, or instructions for existing hooks.
 */
function planHooks(context: HookContext): HookPlan {
    const { settings, repository } = context;
    const path = readHooksPath(repository.root);
    if (settings.hooks?.enabled !== true)
        return readGitSetting(repository.root, HOOKS_PATH_SETTING) === path
            ? { path, command: UNSET_HOOKS_PATH, note: 'disabled hooks: unset core.hooksPath' }
            : { path, note: '' };
    const foreign = readForeignHooks(repository.root, path);
    if (foreign.length > 0) return { path, note: formatForeignHooks(foreign, context) };
    return {
        path,
        command: [...SET_HOOKS_PATH, path],
        note: `set core.hooksPath to ${path}`,
    };
}

/**
 * Set the planned Git setting, or report the instructions for existing hooks.
 *
 * @param context what the hook plan reads.
 * @param steps collects each command that install runs.
 *
 * @returns the install summary.
 */
export function installHooks(context: HookContext, steps: (readonly string[])[]): string {
    if (!context.repository.hasGit) return '';
    const plan = planHooks(context);
    if (plan.command !== undefined) {
        steps.push(plan.command);
        const result = runGitBlocking(context.repository.root, plan.command.slice(1));
        if (result.code !== 0)
            throw new GspotError('installation', `Cannot set core.hooksPath: ${result.stderr.trim()}`);
    }
    return plan.note;
}

/**
 * Check whether the hooks in the settings run in this clone.
 *
 * @param context what the check reads: the settings, the repository, the runner, and the hooks to run.
 *
 * @returns whether the hooks run, and the status line.
 */
export function readHookStatus(context: HookContext): HookStatus {
    const { settings, repository } = context;
    if (settings.hooks?.enabled !== true) return { ready: true, text: 'none' };
    if (!repository.hasGit) return { ready: false, text: 'not installed: no Git repository' };
    const path = readHooksPath(repository.root);
    if (readGitSetting(repository.root, HOOKS_PATH_SETTING) === path) return { ready: true, text: 'installed' };
    const foreign = readForeignHooks(repository.root, path);
    if (foreign.length > 0) {
        const paths = foreign.flatMap((hook) => {
            if (hook.files.length === 0) return [];
            const folder =
                hook.kind === 'hooksPath' ? readHooksFolder(repository.root) : resolve(repository.root, hook.path);
            return hook.files.map((file) => resolve(folder, file));
        });
        const ready = paths.some((file) => readFileSync(file, 'utf8').includes(HOOK_COMMAND));
        return {
            ready,
            text: ready
                ? `run from ${foreign.map((hook) => hook.path).join(', ')}`
                : `not installed; ${formatForeignHooks(foreign, context)}`,
        };
    }
    return { ready: false, text: 'not installed; run gspot install' };
}
