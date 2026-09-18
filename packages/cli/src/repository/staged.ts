// Staged files for the commit stage, and the honest note about unstaged changes.
import { git } from '#cli/platform/spawn.ts';

export type StagedSet = { staged: string[]; unstaged: number };

/** Staged paths (added, copied, modified, renamed, type-changed) and how many of them also have unstaged changes. */
export function stagedFiles(root: string): StagedSet {
    const listed = git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACMRT', '-z']) ?? '';
    const staged = listed.split('\0').filter(Boolean).sort();
    const dirty = new Set((git(root, ['diff', '--name-only', '-z']) ?? '').split('\0').filter(Boolean));
    const unstaged = staged.filter((path) => dirty.has(path)).length;
    return { staged, unstaged };
}

/** Files changed since a ref, for the pull-request form. */
export function changedSince(root: string, ref: string): string[] {
    const merged = git(root, ['merge-base', ref, 'HEAD'])?.trim() ?? ref;
    const listed = git(root, ['diff', '--name-only', '--diff-filter=ACMRT', '-z', merged]) ?? '';
    const working = git(root, ['diff', '--name-only', '--diff-filter=ACMRT', '-z']) ?? '';
    return [...new Set([...listed.split('\0'), ...working.split('\0')].filter(Boolean))].sort();
}
