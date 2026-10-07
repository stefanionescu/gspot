// Configuration-root discovery and Git work-tree state.
import { statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { isOutsideGit, runGitBlocking } from '#cli/platform/git.ts';

/**
 * Ask Git whether a directory belongs to a work tree, using stable diagnostic language.
 * @param root the directory to inspect
 * @returns the command result for repository-state classification
 */
export function inspectWorkTree(root: string): SpawnResult {
    return runGitBlocking(root, ['rev-parse', '--is-inside-work-tree'], { env: { LC_ALL: 'C' } });
}

/**
 * True when the root is inside a git work tree.
 * @param root the directory
 * @returns whether Git confirms a work tree
 * @throws when Git cannot establish the repository state
 */
export function isGitRepository(root: string): boolean {
    const inspection = inspectWorkTree(root);
    if (inspection.code === 0 && inspection.stdout.trim() === 'true') return true;
    if (isOutsideGit(root, inspection)) return false;
    throw new Error(
        `Git work-tree discovery failed in ${root} (exit ${String(inspection.code)}): ${inspection.stderr.trim()}`,
    );
}

/**
 * The nearest folder at or above start that holds gspot.toml, stopping at the Git top level.
 * Without a policy, use the Git top level or start outside Git.
 * @param start the directory to start from
 * @returns the root
 */
export function findRoot(start: string): string {
    const directory = resolve(start);
    const top = runGitBlocking(directory, ['rev-parse', '--show-toplevel']);
    const gitRoot = top.code === 0 ? resolve(top.stdout.trim()) : undefined;
    if (gitRoot === undefined && !isOutsideGit(directory, inspectWorkTree(directory)))
        throw new Error(`Git root discovery failed in ${directory} (exit ${String(top.code)}): ${top.stderr.trim()}`);
    let current = directory;
    while (statSync(join(current, POLICY_FILE), { throwIfNoEntry: false }) === undefined) {
        if (current === gitRoot) return gitRoot;
        const parent = dirname(current);
        if (parent === current) return directory;
        current = parent;
    }
    return current;
}
