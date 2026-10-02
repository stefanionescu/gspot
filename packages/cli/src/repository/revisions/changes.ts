// Staged files for the commit stage, and the honest note about unstaged changes.
import { GspotError } from '#cli/platform/errors.ts';
import { WORKTREE_DIFF_ARGV } from '#cli/config/repository/revisions.ts';
import type { StagedPaths, ChangedPaths } from '#cli/types/repository/revisions.ts';
import { runGit, gitLines, gitPaths, isShallow, gitTrimmed } from '#cli/platform/git.ts';

// The remote HEAD symrefs, as pairs of the ref name and the branch it points to.
async function getRemoteHeads(root: string, cancelSignal?: AbortSignal): Promise<[string, string][]> {
    const lines = await gitLines(
        root,
        ['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes'],
        cancelSignal,
    );
    return lines.flatMap((line) => {
        const [name, target] = line.split('\t');
        const isHead = name !== undefined && name.endsWith('/HEAD') && target !== undefined && target !== '';
        return isHead ? [[name, target] as [string, string]] : [];
    });
}

// The upstream or remote default branch, or an empty string when neither exists.
async function getDefaultRef(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const head = await gitTrimmed(root, ['rev-parse', '--symbolic-full-name', 'HEAD'], cancelSignal);
    const upstream = await gitTrimmed(root, ['for-each-ref', '--format=%(upstream)', '--', head], cancelSignal);
    if (upstream !== '') return upstream;
    const heads = await getRemoteHeads(root, cancelSignal);
    const preferred =
        heads.find(([name]) => name === 'refs/remotes/origin/HEAD') ?? (heads.length === 1 ? heads[0] : undefined);
    return preferred?.[1] ?? '';
}

// The merge base of a ref and HEAD, with a note about cut history when the repository is shallow.
async function getMergeBase(root: string, compared: string, cancelSignal?: AbortSignal): Promise<string> {
    const base = await runGit(root, ['merge-base', '--', compared, 'HEAD'], {
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (base.code === 0) return base.stdout.trim();
    const help = (await isShallow(root, cancelSignal)) ? ' History is cut; run git fetch --unshallow.' : '';
    throw new GspotError('selection', [`Git merge-base failed for ${compared}: ${base.stderr.trim()}.${help}`]);
}

/**
 * Staged paths include deletions and both sides of renames. Count paths with unstaged changes.
 * @param root the repository root
 * @param cancelSignal cancellation for the Git commands
 * @returns the staged paths, sorted, and the unstaged count
 */
export async function getStaged(root: string, cancelSignal?: AbortSignal): Promise<StagedPaths> {
    const cached = await gitPaths(
        root,
        ['diff', '--relative', '--cached', '--name-only', '--no-renames', '-z'],
        cancelSignal,
    );
    const staged = cached.toSorted((a, b) => a.localeCompare(b));
    const dirty = new Set(await gitPaths(root, WORKTREE_DIFF_ARGV, cancelSignal));
    return { staged, unstaged: staged.filter((path) => dirty.has(path)).length };
}

/**
 * Files and commits changed relative to a ref, for the pull-request form.
 * @param root the repository root
 * @param reference the git ref to compare against
 * @param cancelSignal cancellation for the Git commands
 * @returns the selected reference, the sorted paths, and the commits after the merge base, oldest first
 */
export async function changedFiles(root: string, reference: string, cancelSignal?: AbortSignal): Promise<ChangedPaths> {
    const compared = reference === '' ? await getDefaultRef(root, cancelSignal) : reference;
    if (compared === '') {
        throw new GspotError('selection', ['No upstream or default branch is available; use --changed=<ref>.']);
    }
    const merged = await getMergeBase(root, compared, cancelSignal);
    const committed = await gitPaths(root, [...WORKTREE_DIFF_ARGV, merged, '--'], cancelSignal);
    const working = await gitPaths(root, WORKTREE_DIFF_ARGV, cancelSignal);
    const commits = await gitLines(root, ['rev-list', '--reverse', `${merged}..HEAD`, '--'], cancelSignal);
    return {
        reference: compared,
        paths: [...new Set([...committed, ...working])].toSorted((a, b) => a.localeCompare(b)),
        commits,
    };
}

/**
 * Compare a push with its upstream or remote default. Without either, start at the root commit.
 * @param root the repository root
 * @param cancelSignal cancellation for the Git commands
 * @returns the commit the pushed range starts after
 */
export async function getPushBase(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const compared = await getDefaultRef(root, cancelSignal);
    if (compared !== '') return getMergeBase(root, compared, cancelSignal);
    const roots = await gitLines(root, ['rev-list', '--max-parents=0', 'HEAD'], cancelSignal);
    const first = roots.at(-1);
    if (first === undefined || first === '') throw new Error('Git did not return a root commit for HEAD.');
    return first;
}
