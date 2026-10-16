// Reads staged paths and compares branches.
import { GspotError } from '#cli/system/errors.ts';
import type { StagedPaths, ChangedPaths } from '#cli/types/repository/revisions.ts';
import { runGit, isShallow, readGitText, readGitLines, readGitPaths } from '#cli/system/git.ts';

import {
    HEAD_SUFFIX,
    ORIGIN_HEAD,
    UPSTREAM_ARGUMENTS,
    HEAD_NAME_ARGUMENTS,
    MERGE_BASE_ARGUMENTS,
    STAGED_DIFF_ARGUMENTS,
    REMOTE_HEADS_ARGUMENTS,
    WORKTREE_DIFF_ARGUMENTS,
    CHANGED_COMMITS_ARGUMENTS,
} from '#cli/config/repository/revisions.ts';

// The remote branch references, as pairs of the ref name and the branch it points to.
async function listRemoteHeads(root: string, cancelSignal?: AbortSignal): Promise<[string, string][]> {
    const lines = await readGitLines(root, [...REMOTE_HEADS_ARGUMENTS], {
        cancelSignal,
    });
    return lines.flatMap((line) => {
        const [name, target] = line.split('\t');
        const isHead = name !== undefined && name.endsWith(HEAD_SUFFIX) && target !== undefined && target !== '';
        return isHead ? [[name, target] as [string, string]] : [];
    });
}
/** Read the upstream or remote default branch.
 * @param root the repository root.
 * @param cancelSignal cancellation for Git reads.
 * @returns the selected branch or an empty string when absent.
 */
export async function readDefaultRef(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const head = await readGitText(root, [...HEAD_NAME_ARGUMENTS], { cancelSignal });
    const upstreamText = await readGitText(root, [...UPSTREAM_ARGUMENTS, head.trim()], {
        cancelSignal,
    });
    const upstream = upstreamText.trim();
    if (upstream !== '') return upstream;
    const heads = await listRemoteHeads(root, cancelSignal);
    const preferred = heads.find(([name]) => name === ORIGIN_HEAD) ?? (heads.length === 1 ? heads[0] : undefined);
    return preferred?.[1] ?? '';
}
/** Read the merge base between a comparison branch and `HEAD`.
 * @param root the repository root.
 * @param compared the comparison branch.
 * @param cancelSignal cancellation for Git reads.
 * @returns the shared base commit.
 */
export async function readMergeBase(root: string, compared: string, cancelSignal?: AbortSignal): Promise<string> {
    const base = await runGit(root, [...MERGE_BASE_ARGUMENTS, compared, 'HEAD'], {
        cancelSignal,
    });
    if (base.code === 0) return base.stdout.trim();
    const help = (await isShallow(root, { cancelSignal })) ? ' History is cut; run git fetch --unshallow.' : '';
    throw new GspotError('git', `Git merge-base failed for ${compared}: ${base.stderr.trim()}.${help}`);
}

/**
 * Staged paths include deletions and both sides of renames. Count paths with unstaged changes.
 * @param root the repository root.
 * @param cancelSignal cancellation for the Git commands.
 * @returns the staged paths, sorted, and the unstaged count.
 */
export async function readStagedPaths(root: string, cancelSignal?: AbortSignal): Promise<StagedPaths> {
    const cached = await readGitPaths(root, [...STAGED_DIFF_ARGUMENTS], {
        cancelSignal,
    });
    const staged = cached.toSorted((a, b) => a.localeCompare(b));
    const dirty = new Set(await readGitPaths(root, WORKTREE_DIFF_ARGUMENTS, { cancelSignal }));
    return { staged, unstaged: staged.filter((path) => dirty.has(path)).length };
}

/**
 * Files and commits changed relative to a ref, for the pull-request form.
 * @param root the repository root.
 * @param reference the git ref to compare against.
 * @param cancelSignal cancellation for the Git commands.
 * @returns the selected reference, the sorted paths, and the commits after the merge base, oldest first.
 */
export async function readChangedPaths(
    root: string,
    reference: string,
    cancelSignal?: AbortSignal,
): Promise<ChangedPaths> {
    const compared = reference === '' ? await readDefaultRef(root, cancelSignal) : reference;
    if (compared === '') {
        throw new GspotError('git', 'No upstream or default branch is available; use --changed --base <ref>.');
    }
    const merged = await readMergeBase(root, compared, cancelSignal);
    const committed = await readGitPaths(root, [...WORKTREE_DIFF_ARGUMENTS, merged, '--'], { cancelSignal });
    const working = await readGitPaths(root, WORKTREE_DIFF_ARGUMENTS, { cancelSignal });
    const commits = await readGitLines(root, [...CHANGED_COMMITS_ARGUMENTS, `${merged}..HEAD`, '--'], {
        cancelSignal,
    });
    return {
        reference: compared,
        paths: [...new Set([...committed, ...working])].toSorted((a, b) => a.localeCompare(b)),
        commits,
    };
}
