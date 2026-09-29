// Where Git keeps this clone's hooks, and which root bounds and records them.
import { toPosix } from '#cli/platform/paths.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { STATE_DIRECTORY } from '#cli/config/platform.ts';
import type { HookLocation } from '#cli/types/repository/repository.ts';
import { dirname, resolve, basename, relative, isAbsolute } from 'node:path';

// One line of Git plumbing output, or a failure that names the unresolved reference.
function gitOutput(cwd: string, argv: string[], description: string): string {
    const result = runBlocking(['git', ...argv], { cwd });
    if (result.code !== 0) throw new Error(`Cannot resolve ${description}: ${result.stderr.trim()}`);
    return result.stdout.replace(/\n$/u, '');
}

// Refuses a hooks destination that exists and is not a directory.
function assertHooksDirectory(top: string, local: string | undefined, location: HookLocation): void {
    if (local === '') return;
    const root = local === undefined ? location.root : top;
    const path = local ?? location.directory;
    const files = openRoot(root);
    try {
        const directory = files.stat(path);
        if (directory !== undefined && !directory.isDirectory())
            throw new Error(`Git hooks destination is not a directory: ${location.absolute}`);
    } finally {
        files.close();
    }
}

/**
 * The path of a file relative to a root, or undefined when the file lies outside it.
 * @param from the root
 * @param to the file
 * @returns the relative path with forward slashes
 */
export function relativeInside(from: string, to: string): string | undefined {
    const path = toPosix(relative(from, to));
    const isOutside = path === '..' || path.startsWith('../') || isAbsolute(path);
    return isOutside ? undefined : path;
}

/**
 * Ask Git for the clone-local hook destination while honoring worktrees and `core.hooksPath`.
 * @param root the repository root
 * @returns the hooks directory with the roots that confine and record it
 */
export function hookLocation(root: string): HookLocation {
    const top = resolve(root, gitOutput(root, ['rev-parse', '--show-toplevel'], 'Git root'));
    // An explicit path format canonicalizes symlinks before bounds can inspect them.
    const absolute = resolve(top, gitOutput(top, ['rev-parse', '--git-path', 'hooks'], 'Git hooks'));
    const location: HookLocation = {
        root: dirname(absolute),
        directory: basename(absolute),
        absolute,
        gitRoot: top,
        stateDirectory: STATE_DIRECTORY,
    };
    const local = relativeInside(top, absolute);
    assertHooksDirectory(top, local, location);
    if (local !== undefined && local !== '.git' && !local.startsWith('.git/')) {
        const ownerRoot = relativeInside(root, absolute) === undefined ? top : root;
        return { ...location, root: ownerRoot, directory: toPosix(relative(ownerRoot, absolute)) };
    }
    const gitDirectory = resolve(top, gitOutput(top, ['rev-parse', '--git-common-dir'], 'Git state'));
    const internal = relativeInside(gitDirectory, absolute);
    if (internal !== undefined) return { ...location, root: gitDirectory, directory: internal };
    return { ...location, stateDirectory: `${location.directory}/.gspot/state` };
}
