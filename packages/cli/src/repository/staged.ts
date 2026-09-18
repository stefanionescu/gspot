// Staged files for the commit stage, and the honest note about unstaged changes.
import { git } from '#cli/platform/spawn.ts';
import type { StagedSet } from '#types/repository.ts';

function paths(listed: string | undefined): string[] {
    return (listed ?? '').split('\0').filter((path) => path !== '');
}

/**
 * Staged paths (added, copied, modified, renamed, type-changed) and how many of them also have unstaged changes.
 * @param root the repository root
 * @returns the staged paths, sorted, and the unstaged count
 */
export function stagedFiles(root: string): StagedSet {
    const staged = paths(git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACMRT', '-z'])).toSorted((a, b) =>
        a.localeCompare(b),
    );
    const dirty = new Set(paths(git(root, ['diff', '--name-only', '-z'])));
    return { staged, unstaged: staged.filter((path) => dirty.has(path)).length };
}

/**
 * Files changed since a ref, for the pull-request form.
 * @param root the repository root
 * @param reference the git ref to compare against
 * @returns the paths, sorted
 */
export function changedSince(root: string, reference: string): string[] {
    const merged = git(root, ['merge-base', reference, 'HEAD'])?.trim() ?? reference;
    const committed = paths(git(root, ['diff', '--name-only', '--diff-filter=ACMRT', '-z', merged]));
    const working = paths(git(root, ['diff', '--name-only', '--diff-filter=ACMRT', '-z']));
    return [...new Set([...committed, ...working])].toSorted((a, b) => a.localeCompare(b));
}
