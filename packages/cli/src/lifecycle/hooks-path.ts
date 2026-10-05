// Git runs the gspot hooks through core.hooksPath. A repository that already runs hooks keeps them, and gets the
// lines to add to them instead.
import { relative } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { existsSync, readdirSync } from 'node:fs';
import { GspotError } from '#cli/platform/errors.ts';
import { getHooks } from '#cli/repository/survey.ts';
import { HOOK_ARGS } from '#cli/config/generation/hooks.ts';
import type { HookName } from '#cli/types/generation/hooks.ts';
import { hookLine, hookPrefix } from '#cli/generation/hooks.ts';
import { HOOKS_DIRECTORY } from '#cli/config/platform/locations.ts';
import { hooksDirectory, readGitSetting, runGitBlocking } from '#cli/platform/git.ts';
import type { HookPlan, HookStatus, HookContext } from '#cli/types/lifecycle/install.ts';

// The value core.hooksPath takes for the gspot hooks, relative to the Git top level.

function ownHooksPath(root: string): string {
    return `${hookPrefix(root)}${HOOKS_DIRECTORY}`;
}

// The hooks this clone already runs that are not the gspot ones: another hooks folder, a hook manager, or scripts
// in the default Git hooks folder.
function foreignHooks(root: string): string[] {
    const own = ownHooksPath(root);
    const found = getHooks(root)
        .filter((hook) => !(hook.kind === 'hooksPath' && hook.path === own))
        .map((hook) => hook.path);
    const directory = hooksDirectory(root);
    if (readGitSetting(root, 'core.hooksPath') !== undefined || !existsSync(directory)) return found;
    const scripts = readdirSync(directory, { withFileTypes: true }).filter(
        (entry) => entry.isFile() && !entry.name.endsWith('.sample'),
    );
    return scripts.length === 0 ? found : [...found, toPosix(relative(root, directory))];
}

/**
 * Calculate the Git setting or instructions without changing existing hooks.
 * @param options the policy and the repository
 * @param options.policy the repository policy
 * @param options.repository the repository root and whether Git is present
 * @returns the command and completion note, or instructions for existing hooks
 */
export function getHookPlan({ policy, repository }: HookContext): HookPlan {
    if (policy.hooks === undefined || !repository.hasGit) return { note: '' };
    const foreign = foreignHooks(repository.root);
    if (foreign.length > 0) {
        const lines = (Object.keys(HOOK_ARGS) as HookName[]).map(
            (name) => `  ${name}: ${hookLine(name, policy.run_with)}`,
        );
        return {
            note: `hooks already run from ${foreign.join(', ')}; add these gspot lines to them:\n${lines.join('\n')}`,
        };
    }
    const path = ownHooksPath(repository.root);
    return {
        command: ['git', 'config', 'core.hooksPath', path],
        note: `installed hooks: core.hooksPath is ${path}`,
    };
}

/**
 * Install the planned Git setting or report the instructions for existing hooks.
 * @param context the policy and repository
 * @returns what changed or which instructions the repository needs
 */
export function installHooks(context: HookContext): string {
    const plan = getHookPlan(context);
    if (plan.command !== undefined) {
        const result = runGitBlocking(context.repository.root, plan.command.slice(1));
        if (result.code !== 0)
            throw new GspotError('installation', `Cannot set core.hooksPath: ${result.stderr.trim()}`);
    }
    return plan.note;
}

/**
 * Whether the hooks the policy selects run in this clone, with the line that says so.
 * @param options the policy and the repository
 * @param options.policy the repository policy
 * @param options.repository the repository root and whether Git is present
 * @returns whether the hooks are ready, and the line
 */
export function hookStatus({ policy, repository }: HookContext): HookStatus {
    if (policy.hooks === undefined) return { ready: true, text: 'none' };
    if (!repository.hasGit) return { ready: false, text: 'not installed: no Git repository' };
    const path = ownHooksPath(repository.root);
    if (readGitSetting(repository.root, 'core.hooksPath') === path) return { ready: true, text: `${path}: installed` };
    const foreign = foreignHooks(repository.root);
    if (foreign.length > 0)
        return { ready: true, text: `run from ${foreign.join(', ')}; gspot install prints the lines they need` };
    return { ready: false, text: 'not installed; run gspot install' };
}
