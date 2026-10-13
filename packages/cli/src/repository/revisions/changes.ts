// Selects files changed between repository revisions.
import { GspotError } from '#cli/errors.ts';
import { readHead } from '#cli/repository/revisions/objects.ts';
import { runGit, gitText, gitLines, gitPaths, isShallow } from '#cli/system/git.ts';
import type { StagedPaths, ChangedPaths, CommitSelection } from '#cli/types/repository/revisions.ts';

import {
    HEAD_SUFFIX,
    ORIGIN_HEAD,
    UPSTREAM_ARGV,
    HEAD_NAME_ARGV,
    MERGE_BASE_ARGV,
    STAGED_DIFF_ARGV,
    REMOTE_HEADS_ARGV,
    ROOT_COMMITS_ARGV,
    WORKTREE_DIFF_ARGV,
    CHANGED_COMMITS_ARGV,
} from '#cli/config/repository/revisions.ts';

// The remote branch references, as pairs of the ref name and the branch it points to.
async function listRemoteHeads(root: string, cancelSignal?: AbortSignal): Promise<[string, string][]> {
    const lines = await gitLines(root, [...REMOTE_HEADS_ARGV], {
        cancelSignal,
    });
    return lines.flatMap((line) => {
        const [name, target] = line.split('\t');
        const isHead = name !== undefined && name.endsWith(HEAD_SUFFIX) && target !== undefined && target !== '';
        return isHead ? [[name, target] as [string, string]] : [];
    });
}

// The upstream or remote default branch, or an empty string when neither exists.
async function readDefaultRef(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const head = await gitText(root, [...HEAD_NAME_ARGV], { cancelSignal });
    const upstreamText = await gitText(root, [...UPSTREAM_ARGV, head.trim()], {
        cancelSignal,
    });
    const upstream = upstreamText.trim();
    if (upstream !== '') return upstream;
    const heads = await listRemoteHeads(root, cancelSignal);
    const preferred = heads.find(([name]) => name === ORIGIN_HEAD) ?? (heads.length === 1 ? heads[0] : undefined);
    return preferred?.[1] ?? '';
}

// The merge base of a reference and the current commit, with a note about cut history for a shallow repository.
async function readMergeBase(root: string, compared: string, cancelSignal?: AbortSignal): Promise<string> {
    const base = await runGit(root, [...MERGE_BASE_ARGV, compared, 'HEAD'], {
        cancelSignal,
    });
    if (base.code === 0) return base.stdout.trim();
    const help = (await isShallow(root, { cancelSignal })) ? ' History is cut; run git fetch --unshallow.' : '';
    throw new GspotError('git', [`Git merge-base failed for ${compared}: ${base.stderr.trim()}.${help}`]);
}

/**
 * Staged paths include deletions and both sides of renames. Count paths with unstaged changes.
 * @param root the repository root.
 * @param cancelSignal cancellation for the Git commands.
 * @returns the staged paths, sorted, and the unstaged count.
 */
export async function readStagedPaths(root: string, cancelSignal?: AbortSignal): Promise<StagedPaths> {
    const cached = await gitPaths(root, [...STAGED_DIFF_ARGV], {
        cancelSignal,
    });
    const staged = cached.toSorted((a, b) => a.localeCompare(b));
    const dirty = new Set(await gitPaths(root, WORKTREE_DIFF_ARGV, { cancelSignal }));
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
        throw new GspotError('git', ['No upstream or default branch is available; use --changed --base <ref>.']);
    }
    const merged = await readMergeBase(root, compared, cancelSignal);
    const committed = await gitPaths(root, [...WORKTREE_DIFF_ARGV, merged, '--'], { cancelSignal });
    const working = await gitPaths(root, WORKTREE_DIFF_ARGV, { cancelSignal });
    const commits = await gitLines(root, [...CHANGED_COMMITS_ARGV, `${merged}..HEAD`, '--'], {
        cancelSignal,
    });
    return {
        reference: compared,
        paths: [...new Set([...committed, ...working])].toSorted((a, b) => a.localeCompare(b)),
        commits,
    };
}

/**
 * Compare a push with its upstream or remote default. Without either, start at the root commit.
 * @param root the repository root.
 * @param cancelSignal cancellation for the Git commands.
 * @returns the commit the pushed range starts after.
 */
export async function readPushBase(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const compared = await readDefaultRef(root, cancelSignal);
    if (compared !== '') return readMergeBase(root, compared, cancelSignal);
    const roots = await gitLines(root, [...ROOT_COMMITS_ARGV], { cancelSignal });
    const first = roots.at(-1);
    if (first === undefined) throw new Error('Git did not return a root commit for HEAD.');
    return first;
}

/**
 * The supplied pushed commits, or the commits after the push base.
 * @param root the repository root.
 * @param commits the explicit selection when supplied.
 * @param cancelSignal cancellation for the Git commands.
 * @returns the exact selected commits or the Git selection error.
 */
export async function pushedCommits(
    root: string,
    commits: string[] | undefined,
    cancelSignal?: AbortSignal,
): Promise<CommitSelection> {
    if (commits !== undefined) return commits;
    if ((await readHead(root, cancelSignal)) === undefined) return [];
    const base = await readPushBase(root, cancelSignal);
    const listed = await runGit(root, ['rev-list', `${base}..HEAD`, '--'], {
        cancelSignal,
    });
    if (listed.code !== 0) return { error: `Cannot select commit messages: ${listed.stderr.trim()}` };
    return listed.stdout.split('\n').filter(Boolean);
}
