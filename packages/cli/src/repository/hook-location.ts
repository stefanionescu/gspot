// Where Git keeps this clone's hooks, and which root confines and records them.
import { runBlocking } from '#cli/platform/spawn.ts';
import { STATE_DIRECTORY } from '#cli/platform/paths.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { HookLocation } from '#cli/types/repository/repository.ts';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

// One line of Git plumbing output, or a failure that names what could not be resolved.
function gitOutput(cwd: string, arguments_: string[], what: string): string {
    const result = runBlocking(['git', ...arguments_], { cwd });
    if (result.code !== 0) throw new Error(`Cannot resolve ${what}: ${result.stderr.trim()}`);
    return result.stdout.replace(/\n$/u, '');
}

// Refuses a hooks destination that exists and is not a directory.
function assertHooksDirectory(root: string, path: string, absolute: string): void {
    const files = openConfinedRoot(root);
    try {
        const directory = files.stat(path);
        if (directory !== undefined && !directory.isDirectory())
            throw new Error(`Git hooks destination is not a directory: ${absolute}`);
    } finally {
        files.close();
    }
}

// The location of hooks that live inside the checkout: owned by the repository root when it contains them.
function checkoutLocation(root: string, top: string, absolute: string, location: HookLocation): HookLocation {
    const ownerRoot = relativeInside(root, absolute) === undefined ? top : root;
    return { ...location, root: ownerRoot, directory: relative(ownerRoot, absolute).replaceAll('\\', '/') };
}

/**
 * The path of a file relative to a root, or undefined when the file lies outside it.
 * @param from the root
 * @param to the file
 * @returns the relative path with forward slashes
 */
export function relativeInside(from: string, to: string): string | undefined {
    const path = relative(from, to).replaceAll('\\', '/');
    const isOutside = path === '..' || path.startsWith('../') || isAbsolute(path);
    return isOutside ? undefined : path;
}

/**
 * Ask Git for the clone-local destination, including worktrees and core.hooksPath.
 * @param root the repository root
 * @returns the hooks directory with the roots that confine and record it
 */
export function hookLocation(root: string): HookLocation {
    const top = resolve(root, gitOutput(root, ['rev-parse', '--show-toplevel'], 'Git root'));
    // An explicit path format canonicalizes symlinks before confinement can inspect them.
    const absolute = resolve(top, gitOutput(top, ['rev-parse', '--git-path', 'hooks'], 'Git hooks'));
    const location: HookLocation = {
        root: dirname(absolute),
        directory: basename(absolute),
        absolute,
        gitRoot: top,
        stateDirectory: STATE_DIRECTORY,
    };
    const local = relativeInside(top, absolute);
    if (local !== '')
        assertHooksDirectory(local === undefined ? location.root : top, local ?? location.directory, absolute);
    if (local !== undefined && local !== '.git' && !local.startsWith('.git/'))
        return checkoutLocation(root, top, absolute, location);
    const gitDirectory = resolve(top, gitOutput(top, ['rev-parse', '--git-common-dir'], 'Git state'));
    const internal = relativeInside(gitDirectory, absolute);
    if (internal !== undefined) return { ...location, root: gitDirectory, directory: internal };
    return { ...location, stateDirectory: `${location.directory}/.gspot/state` };
}
