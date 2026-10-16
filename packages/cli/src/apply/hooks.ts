import { resolve, relative } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { HOOKS_PATH } from '#cli/config/system/locations.ts';
import { readHooks } from '#cli/repository/existing-tools.ts';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { HOOK_ARGUMENTS } from '#cli/config/generation/hooks.ts';
import { HOOKS_PATH_SETTING } from '#cli/config/repository/hooks.ts';
import type { ExistingTools } from '#cli/types/repository/inventory.ts';
import type { HookName, StartRunner } from '#cli/types/generation/files.ts';
import type { HookPlan, HookStatus, HookContext } from '#cli/types/install.ts';
import { readGitPrefix, readGitSetting, runGitBlocking, readHooksFolder } from '#cli/system/git.ts';
import { HOOK_COMMAND, SET_HOOKS_PATH, UNSET_HOOKS_PATH, SAMPLE_HOOK_SUFFIX } from '#cli/config/install.ts';

// Read this clone's existing hook mechanisms: another folder, a hook tool, or scripts
// in the default Git hooks folder.
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

// The hook commands a foreign setup must invoke; install and readiness use the same instructions.
function formatForeignHooks(hooks: ExistingTools['hooks'], runner: StartRunner): string {
    const lines = (Object.keys(HOOK_ARGUMENTS) as HookName[]).map(
        (name) => `  ${name}: ${runner.command} ${HOOK_ARGUMENTS[name]}`,
    );
    return `hooks already run from ${hooks.map((hook) => hook.path).join(', ')}; add these gspot lines to them:\n${lines.join('\n')}`;
}

/**
 * Calculate the Git setting or instructions without changing existing hooks.
 *
 * @param options the settings and the repository.
 * @param options.settings the repository settings.
 * @param options.repository the repository root and Git availability.
 * @param options.runner the start command selected from the repository pin.
 *
 * @returns the command and completion note, or instructions for existing hooks.
 */
function planHooks({ settings, repository, runner }: HookContext): HookPlan {
    const path = `${readGitPrefix(repository.root)}${HOOKS_PATH}`;
    if (settings.hooks?.enabled !== true)
        return readGitSetting(repository.root, HOOKS_PATH_SETTING) === path
            ? { path, command: UNSET_HOOKS_PATH, note: 'disabled hooks: unset core.hooksPath' }
            : { path, note: '' };
    const foreign = readForeignHooks(repository.root, path);
    if (foreign.length > 0) return { path, note: formatForeignHooks(foreign, runner) };
    return {
        path,
        command: [...SET_HOOKS_PATH, path],
        note: `set core.hooksPath to ${path}`,
    };
}

/**
 * Install the planned Git setting or report the instructions for existing hooks.
 *
 * @param context the settings and repository.
 * @param steps the commands attempted during installation.
 *
 * @returns the installation summary.
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
 * Whether the hooks the settings selects run in this clone, with the line that says so.
 *
 * @param options the settings and the repository.
 * @param options.settings the repository settings.
 * @param options.repository the repository root and Git availability.
 * @param options.runner the start command selected from the repository pin.
 *
 * @returns hook readiness and its status message.
 */
export function readHookStatus({ settings, repository, runner }: HookContext): HookStatus {
    if (settings.hooks?.enabled !== true) return { ready: true, text: 'none' };
    if (!repository.hasGit) return { ready: false, text: 'not installed: no Git repository' };
    const path = planHooks({ settings, repository, runner }).path;
    if (readGitSetting(repository.root, HOOKS_PATH_SETTING) === path)
        return { ready: true, text: `${path}: installed` };
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
                : `not installed; ${formatForeignHooks(foreign, runner)}`,
        };
    }
    return { ready: false, text: 'not installed; run gspot install' };
}
