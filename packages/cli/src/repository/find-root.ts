// Finds a repository root from a file or directory.
import { statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { realPath } from '#cli/system/safe-folder/reads.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { gitLine, isOutsideGit, runGitBlocking } from '#cli/system/git.ts';
import { GIT_LOCALE, WORK_TREE_ARGV, GIT_TOP_LEVEL_ARGV } from '#cli/config/system/git.ts';

/**
 * True when a Git work tree contains the root.
 * @param root the directory.
 * @returns whether Git confirms a work tree.
 * @throws when Git cannot establish the repository state.
 */
export function isGitRepository(root: string): boolean {
    const inspection = runGitBlocking(root, WORK_TREE_ARGV, { env: GIT_LOCALE });
    if (inspection.code === 0 && inspection.stdout.trim() === 'true') return true;
    if (isOutsideGit(inspection)) return false;
    throw new Error(
        `Git work-tree discovery failed in ${root} (exit ${String(inspection.code)}): ${inspection.stderr.trim()}`,
    );
}

/**
 * The nearest folder at or above start that holds gspot.toml, stopping at the Git top level.
 * Without settings, use the Git top level or start outside Git.
 * @param start the directory to start from.
 * @returns the root.
 */
export function findRoot(start: string): string {
    const directory = realPath(start);
    const top = runGitBlocking(directory, [...GIT_TOP_LEVEL_ARGV]);
    const gitRoot = top.code === 0 ? resolve(gitLine(top.stdout)) : undefined;
    if (gitRoot === undefined && !isOutsideGit(runGitBlocking(directory, WORK_TREE_ARGV, { env: GIT_LOCALE })))
        throw new Error(`Git root discovery failed in ${directory} (exit ${String(top.code)}): ${top.stderr.trim()}`);
    let current = directory;
    while (statSync(join(current, SETTINGS_FILE), { throwIfNoEntry: false }) === undefined) {
        if (current === gitRoot) return gitRoot;
        const parent = dirname(current);
        if (parent === current) return directory;
        current = parent;
    }
    return current;
}
