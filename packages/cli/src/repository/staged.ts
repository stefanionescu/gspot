import { runBlocking } from '#cli/platform/spawn.ts';
// Staged files for the commit stage, and the honest note about unstaged changes.
import type { StagedSet } from '#types/repository.ts';

function observed(root: string, argv: string[]): string {
    const result = runBlocking(['git', ...argv], { cwd: root });
    if (result.code !== 0) {
        throw new Error(
            `Git ${argv[0] ?? ''} failed in ${root} (exit ${String(result.code)}): ${result.stderr.trim()}`,
        );
    }
    return result.stdout;
}

function paths(root: string, argv: string[]): string[] {
    return observed(root, argv)
        .split('\0')
        .filter((path) => path !== '');
}

/**
 * Staged paths include deletions and both sides of renames. Count paths with unstaged changes.
 * @param root the repository root
 * @returns the staged paths, sorted, and the unstaged count
 */
export function stagedFiles(root: string): StagedSet {
    const staged = paths(root, ['diff', '--cached', '--name-only', '--no-renames', '-z']).toSorted((a, b) =>
        a.localeCompare(b),
    );
    const dirty = new Set(paths(root, ['diff', '--name-only', '--no-renames', '-z']));
    return { staged, unstaged: staged.filter((path) => dirty.has(path)).length };
}

/**
 * Files changed relative to a ref, for the pull-request form.
 * @param root the repository root
 * @param reference the git ref to compare against
 * @returns the paths, sorted
 */
export function changedSince(root: string, reference: string): string[] {
    const merged = observed(root, ['merge-base', '--', reference, 'HEAD']).trim();
    const committed = paths(root, ['diff', '--name-only', '--no-renames', '-z', merged, '--']);
    const working = paths(root, ['diff', '--name-only', '--no-renames', '-z']);
    return [...new Set([...committed, ...working])].toSorted((a, b) => a.localeCompare(b));
}

/**
 * Where a push starts: the merge base with the upstream branch, or the root commit when the branch has none.
 * @param root the repository root
 * @returns the commit the pushed range starts after
 */
export function pushBase(root: string): string {
    const head = observed(root, ['rev-parse', '--symbolic-full-name', 'HEAD']).trim();
    const upstream = observed(root, ['for-each-ref', '--format=%(upstream)', '--', head]).trim();
    if (upstream !== '') return observed(root, ['merge-base', '--', 'HEAD', upstream]).trim();
    const first = observed(root, ['rev-list', '--max-parents=0', 'HEAD']).trim().split('\n').at(-1);
    if (first === undefined || first === '') throw new Error('Git did not return a root commit for HEAD.');
    return first;
}
