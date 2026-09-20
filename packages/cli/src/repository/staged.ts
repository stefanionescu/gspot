import { runBlocking } from '#cli/platform/spawn.ts';
import { SelectionError } from '#cli/presets/select.ts';
// Staged files for the commit stage, and the honest note about unstaged changes.
import type { ChangedSet, StagedSet } from '#types/repository.ts';

function observed(root: string, argv: string[]): string {
    const result = runBlocking(['git', ...argv], { cwd: root });
    if (result.code !== 0) {
        throw new SelectionError([
            `Git ${argv[0] ?? ''} failed in ${root} (exit ${String(result.code)}): ${result.stderr.trim()}`,
        ]);
    }
    return result.stdout;
}

function paths(root: string, argv: string[]): string[] {
    return observed(root, argv)
        .split('\0')
        .filter((path) => path !== '');
}

function defaultReference(root: string): string {
    const head = observed(root, ['rev-parse', '--symbolic-full-name', 'HEAD']).trim();
    const upstream = observed(root, ['for-each-ref', '--format=%(upstream)', '--', head]).trim();
    if (upstream !== '') return upstream;
    const defaults = observed(root, ['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes'])
        .trim()
        .split('\n')
        .map((line) => line.split('\t'))
        .filter(
            ([name, target]) => name !== undefined && name.endsWith('/HEAD') && target !== undefined && target !== '',
        );
    const preferred =
        defaults.find(([name]) => name === 'refs/remotes/origin/HEAD') ??
        (defaults.length === 1 ? defaults[0] : undefined);
    const target = preferred?.[1];
    if (target !== undefined) return target;
    throw new SelectionError(['No upstream or default branch is available; use --changed=<ref>.']);
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
 * @returns the selected reference and sorted paths
 */
export function changedFiles(root: string, reference: string): ChangedSet {
    const compared = reference === '' ? defaultReference(root) : reference;
    const base = runBlocking(['git', 'merge-base', '--', compared, 'HEAD'], { cwd: root });
    if (base.code !== 0) {
        const shallow = observed(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true';
        const help = shallow ? ' History is cut; run git fetch --unshallow.' : '';
        throw new SelectionError([`Git merge-base failed for ${compared}: ${base.stderr.trim()}.${help}`]);
    }
    const merged = base.stdout.trim();
    const committed = paths(root, ['diff', '--name-only', '--no-renames', '-z', merged, '--']);
    const working = paths(root, ['diff', '--name-only', '--no-renames', '-z']);
    return {
        reference: compared,
        paths: [...new Set([...committed, ...working])].toSorted((a, b) => a.localeCompare(b)),
    };
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
