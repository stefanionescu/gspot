import { toPosix } from '#cli/platform/contracts.ts';
import { GspotError } from '#cli/platform/public.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { HOOK_ARGS } from '#cli/config/generation/hooks.ts';
import type { Policy } from '#cli/types/policy/settings.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import { join, dirname, resolve, relative } from 'node:path';
import { isValePackageFile } from '#cli/repository/public.ts';
import { getHooks } from '#cli/repository/discovery/public.ts';
import type { HookName } from '#cli/types/generation/hooks.ts';
import { runGitBlocking } from '#cli/platform/git/contracts.ts';
import { VALE_PACKAGE_FOLDERS } from '#cli/config/tools/vale.ts';
import { getOwnership } from '#cli/lifecycle/ownership/public.ts';
import { openRoot, walkRoot } from '#cli/platform/root/public.ts';
import type { Tooling } from '#cli/types/repository/inventory.ts';
import { hookLine, hookPrefix } from '#cli/generation/contracts.ts';
import type { ValeInstallation } from '#cli/types/tools/install.ts';
import { inspectTool, toolAvailability } from '#cli/tools/public.ts';
import { runTool, installationDiagnostics } from '#cli/tools/contracts.ts';
import { hooksDirectory, readGitSetting } from '#cli/platform/git/public.ts';
import type { HookPlan, HookStatus, HookContext } from '#cli/types/lifecycle/install.ts';

import {
    VALE_CONFIG,
    HOOKS_DIRECTORY,
    STYLES_DIRECTORY,
    VALE_PACKAGE_DIRECTORY,
} from '#cli/config/platform/locations.ts';
import {
    openSync,
    statSync,
    closeSync,
    constants,
    fstatSync,
    lstatSync,
    mkdirSync,
    existsSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';

// Copies the Vale configuration and the gspot style into the folder vale sync runs in.
function stageInputs(owner: ValeInstallation['owner'], files: Root, work: string): void {
    const inputs = [VALE_CONFIG, ...listStyleFiles(files, STYLES_DIRECTORY).filter((path) => !isValePackageFile(path))];
    for (const path of inputs) {
        const content = owner.read(path);
        if (content === undefined) throw new Error(`Vale setup input is missing: ${path}`);
        mkdirSync(dirname(join(work, path)), { recursive: true });
        writeFileSync(join(work, path), content.bytes, { mode: PRIVATE_FILE });
    }
}

// The value core.hooksPath takes for the gspot hooks, relative to the Git top level.

function ownHooksPath(root: string): string {
    return `${hookPrefix(root)}${HOOKS_DIRECTORY}`;
}

// The hooks this clone already runs that are not the gspot ones: another hooks folder, a hook manager, or scripts
// in the default Git hooks folder.
function foreignHooks(root: string, own: string): Tooling['hooks'] {
    const found = getHooks(root).filter((hook) => !(hook.kind === 'hooksPath' && hook.path === own));
    const directory = hooksDirectory(root);
    if (readGitSetting(root, 'core.hooksPath') !== undefined || !existsSync(directory)) return found;
    const scripts = readdirSync(directory, { withFileTypes: true }).filter(
        (entry) => entry.isFile() && !entry.name.endsWith('.sample'),
    );
    return scripts.length === 0
        ? found
        : [
              ...found,
              {
                  kind: 'hooksPath',
                  path: toPosix(relative(root, directory)),
                  files: scripts.map((entry) => entry.name),
              },
          ];
}

// The native hook commands a foreign setup must invoke; install and readiness use the same instructions.
function foreignHookNote(hooks: Tooling['hooks'], policy: Policy): string {
    const lines = (Object.keys(HOOK_ARGS) as HookName[]).map((name) => `  ${name}: ${hookLine(name, policy.runner)}`);
    return `hooks already run from ${hooks.map((hook) => hook.path).join(', ')}; add these gspot lines to them:\n${lines.join('\n')}`;
}

/**
 * Check whether configured upstream styles are available for a prose check.
 * @param root the repository root
 * @param level the selected check level
 * @returns whether the config and required package directories exist
 */
export function hasValePackages(root: string, level: Policy['level']): boolean {
    using files = openRoot(root);
    if (files.read(VALE_CONFIG) === undefined) return false;
    if (level === 'recommended') return true;
    const available = VALE_PACKAGE_FOLDERS.every(
        (name) => files.stat(`${VALE_PACKAGE_DIRECTORY}/${name}`)?.isDirectory() === true,
    );
    return available && getOwnership(root).installed?.includes('vale') === true;
}

/**
 * Every file under the styles folder, whether it belongs to a Vale package or to the gspot style.
 * @param files the root the styles folder is read from
 * @param folder the emitted or installed style directory
 * @returns the files, relative to the root
 */
export function listStyleFiles(files: Root, folder: string): string[] {
    const found: string[] = [];
    walkRoot(files, folder, (path) => {
        if (files.stat(path)?.isDirectory() === true) return true;
        found.push(path);
        return false;
    });
    return found;
}

/**
 * Downloads the upstream packages shipped at the selected level, and replaces the installed ones with them. Needs the network.
 * @param request the tool search, selected Vale pin, deadline, and cancellation
 * @returns what went wrong, or undefined when the packages are in place
 */
export async function installValePackages(request: ValeInstallation): Promise<string | undefined> {
    const { owner, search, tool, level, timeoutSeconds, cancelSignal } = request;
    const { root } = search;
    using files = openRoot(root);
    using workFolder = scratchFolder('gspot-vale-');
    const work = workFolder.path;
    stageInputs(owner, files, work);
    if (level === 'recommended') return undefined;
    const available = toolAvailability(tool, inspectTool(search, tool));
    if ('status' in available) return available.note;
    const result = await runTool([available.path, '--config', join(work, VALE_CONFIG), 'sync'], {
        cwd: work,
        cancelSignal,
        timeoutSeconds,
    });
    if (result.isCanceled === true) return 'Vale package sync was canceled.';
    if (result.isTimedOut === true) return 'Vale package sync exceeded its tool deadline.';
    if (result.code !== 0) return installationDiagnostics(result, []);
    const missing = VALE_PACKAGE_FOLDERS.find((folder) => {
        const path = `${VALE_PACKAGE_DIRECTORY}/${folder}`;
        const entry = lstatSync(join(work, path), { throwIfNoEntry: false });
        if (entry?.isSymbolicLink() === true) throw new Error(`Unsafe lifecycle destination: ${path}`);
        return entry?.isDirectory() !== true;
    });
    if (missing !== undefined) return `Vale setup output is missing: ${VALE_PACKAGE_DIRECTORY}/${missing}`;
    await owner.installTree('vale', join(work, VALE_PACKAGE_DIRECTORY));
    return undefined;
}

/**
 * Calculate the Git setting or instructions without changing existing hooks.
 * @param options the policy and the repository
 * @param options.policy the repository policy
 * @param options.repository the repository root and whether Git is present
 * @returns the command and completion note, or instructions for existing hooks
 */
export function getHookPlan({ policy, repository }: HookContext): HookPlan {
    if (!repository.hasGit) return { note: '' };
    const path = ownHooksPath(repository.root);
    if (policy.hooks?.enabled !== true)
        return readGitSetting(repository.root, 'core.hooksPath') === path
            ? { command: ['git', 'config', '--unset', 'core.hooksPath'], note: 'disabled hooks: unset core.hooksPath' }
            : { note: '' };
    const foreign = foreignHooks(repository.root, path);
    if (foreign.length > 0) return { note: foreignHookNote(foreign, policy) };
    return {
        path,
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
    if (policy.hooks?.enabled !== true) return { ready: true, text: 'none' };
    if (!repository.hasGit) return { ready: false, text: 'not installed: no Git repository' };
    const path = ownHooksPath(repository.root);
    if (readGitSetting(repository.root, 'core.hooksPath') === path) return { ready: true, text: `${path}: installed` };
    const foreign = foreignHooks(repository.root, path);
    if (foreign.length > 0) {
        const paths = foreign.flatMap((hook) => {
            const directory =
                hook.kind === 'hooksPath' ? hooksDirectory(repository.root) : resolve(repository.root, hook.path);
            return hook.files.length === 0 ? [directory] : hook.files.map((file) => resolve(directory, file));
        });
        const ready = paths.some((file) => {
            let descriptor: number;
            try {
                descriptor = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
            } catch (error) {
                if (!statSync(file).isFile()) return false;
                throw error;
            }
            try {
                return (
                    fstatSync(descriptor).isFile() && readFileSync(descriptor, 'utf8').includes('gspot check --hook')
                );
            } finally {
                closeSync(descriptor);
            }
        });
        return {
            ready,
            text: ready
                ? `run from ${foreign.map((hook) => hook.path).join(', ')}`
                : `not installed; ${foreignHookNote(foreign, policy)}`,
        };
    }
    return { ready: false, text: 'not installed; run gspot install' };
}
