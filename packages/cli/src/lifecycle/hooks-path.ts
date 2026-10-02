// Git runs the gspot hooks through core.hooksPath. A repository that already runs hooks keeps them, and gets the
// lines to add to them instead.
import { relative } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { existsSync, readdirSync } from 'node:fs';
import type { Policy } from '#cli/types/policy/policy.ts';
import { existingHooks } from '#cli/repository/survey.ts';
import { hookLine, hookPrefix } from '#cli/generation/hooks.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import { HOOK_FILES, HOOKS_DIRECTORY } from '#cli/config/generation/generation.ts';
import { hooksDirectory, readGitSetting, runGitBlocking } from '#cli/platform/git.ts';

// The value core.hooksPath takes for the gspot hooks, relative to the Git top level.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Installing the hooks, reading their status, and finding foreign hooks compare core.hooksPath with this spelling.
function ownHooksPath(root: string): string {
    return `${hookPrefix(root)}${HOOKS_DIRECTORY}`;
}

// The hooks this clone already runs that are not the gspot ones: another hooks folder, a hook manager, or scripts
// in the default Git hooks folder.
function foreignHooks(root: string): string[] {
    const own = ownHooksPath(root);
    const found = existingHooks(root)
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
 * Point Git at the gspot hooks, or print the lines to add when the repository already runs other hooks.
 * @param options the policy and the repository
 * @param options.policy the repository policy
 * @param options.repository the repository root and whether Git is present
 * @returns the line that says what happened, or '' when the policy selects no hooks
 */
export function installHooks({
    policy,
    repository,
}: {
    policy: Policy;
    repository: Pick<Repository, 'root' | 'hasGit'>;
}): string {
    if (policy.hooks === undefined || !repository.hasGit) return '';
    const foreign = foreignHooks(repository.root);
    if (foreign.length > 0) {
        const lines = HOOK_FILES.map((name) => `  ${name}: ${hookLine(name, policy.runner?.tool)}`);
        return `hooks already run from ${foreign.join(', ')}; add these gspot lines to them:\n${lines.join('\n')}`;
    }
    const path = ownHooksPath(repository.root);
    const result = runGitBlocking(repository.root, ['config', 'core.hooksPath', path]);
    if (result.code !== 0) throw new Error(`Cannot set core.hooksPath: ${result.stderr.trim()}`);
    return `installed hooks: core.hooksPath is ${path}`;
}

/**
 * Whether the hooks the policy selects run in this clone, with the line that says so.
 * @param options the policy and the repository
 * @param options.policy the repository policy
 * @param options.repository the repository root and whether Git is present
 * @returns whether the hooks are ready, and the line
 */
export function hookStatus({
    policy,
    repository,
}: {
    policy: Policy;
    repository: Pick<Repository, 'root' | 'hasGit'>;
}): { ready: boolean; text: string } {
    if (policy.hooks === undefined) return { ready: true, text: 'none' };
    if (!repository.hasGit) return { ready: false, text: 'not installed: no Git repository' };
    const path = ownHooksPath(repository.root);
    if (readGitSetting(repository.root, 'core.hooksPath') === path) return { ready: true, text: `${path}: installed` };
    const foreign = foreignHooks(repository.root);
    if (foreign.length > 0)
        return { ready: true, text: `run from ${foreign.join(', ')}; gspot install prints the lines they need` };
    return { ready: false, text: 'not installed; run gspot install' };
}
