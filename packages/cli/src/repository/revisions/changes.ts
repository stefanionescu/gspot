// Reads staged paths and compares branches.
import { GspotError } from '#cli/system/errors.ts';
import type { StagedPaths, ChangedPaths } from '#cli/types/repository/revisions.ts';
import { runGit, isShallow, readGitText, readGitLines, readGitPaths } from '#cli/system/git.ts';

import {
    HEAD_SUFFIX,
    ORIGIN_HEAD,
    GIT_UPSTREAM_ARGUMENTS,
    GIT_HEAD_NAME_ARGUMENTS,
    GIT_MERGE_BASE_ARGUMENTS,
    GIT_DIFF_NAMES_ARGUMENTS,
    GIT_STAGED_DIFF_ARGUMENTS,
    GIT_REMOTE_HEADS_ARGUMENTS,
    GIT_CHANGED_COMMITS_ARGUMENTS,
} from '#cli/config/repository/revisions.ts';

// List the remote branch refs, as pairs of the ref name and the branch it points to.
async function listRemoteHeads(root: string, cancelSignal?: AbortSignal): Promise<[string, string][]> {
    const lines = await readGitLines(root, GIT_REMOTE_HEADS_ARGUMENTS, {
        cancelSignal,
    });
    return lines.flatMap((line) => {
        const [name, target] = line.split('\t');
        const isHead = name !== undefined && name.endsWith(HEAD_SUFFIX) && target !== undefined && target !== '';
        return isHead ? [[name, target] as [string, string]] : [];
    });
}
/**
 * Read the upstream or remote default branch.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param cancelSignal stops the Git reads.
 * @returns the branch, or an empty string without one.
 */
export async function readDefaultRef(repositoryRoot: string, cancelSignal?: AbortSignal): Promise<string> {
    const head = await readGitText(repositoryRoot, GIT_HEAD_NAME_ARGUMENTS, { cancelSignal });
    const upstreamText = await readGitText(repositoryRoot, [...GIT_UPSTREAM_ARGUMENTS, head.trim()], {
        cancelSignal,
    });
    const upstream = upstreamText.trim();
    if (upstream !== '') return upstream;
    const heads = await listRemoteHeads(repositoryRoot, cancelSignal);
    const preferred = heads.find(([name]) => name === ORIGIN_HEAD) ?? (heads.length === 1 ? heads[0] : undefined);
    return preferred?.[1] ?? '';
}
/**
 * Read the merge base between a comparison branch and `HEAD`.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param compared the comparison branch.
 * @param cancelSignal stops the Git reads.
 * @returns the shared base commit.
 */
export async function readMergeBase(
    repositoryRoot: string,
    compared: string,
    cancelSignal?: AbortSignal,
): Promise<string> {
    const base = await runGit(repositoryRoot, [...GIT_MERGE_BASE_ARGUMENTS, compared, 'HEAD'], {
        cancelSignal,
    });
    if (base.code === 0) return base.stdout.trim();
    const help = (await isShallow(repositoryRoot, { cancelSignal }))
        ? ' History is cut; run git fetch --unshallow.'
        : '';
    throw new GspotError('git', `Git merge-base failed for ${compared}: ${base.stderr.trim()}.${help}`);
}

/**
 * Read the staged paths, with deletions and both sides of renames, and count paths with unstaged changes.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param cancelSignal stops the Git commands.
 * @returns the staged paths, sorted, and the unstaged count.
 */
export async function readStagedPaths(repositoryRoot: string, cancelSignal?: AbortSignal): Promise<StagedPaths> {
    const cached = await readGitPaths(repositoryRoot, GIT_STAGED_DIFF_ARGUMENTS, {
        cancelSignal,
    });
    const staged = cached.toSorted((a, b) => a.localeCompare(b));
    const dirty = new Set(await readGitPaths(repositoryRoot, GIT_DIFF_NAMES_ARGUMENTS, { cancelSignal }));
    return { staged, unstaged: staged.filter((path) => dirty.has(path)).length };
}

/**
 * Read the files and commits that changed after a ref, for the pull-request form.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param reference the git ref to compare against.
 * @param cancelSignal stops the Git commands.
 * @returns the changed paths, and the commits after the merge base.
 */
export async function readChangedPaths(
    repositoryRoot: string,
    reference: string,
    cancelSignal?: AbortSignal,
): Promise<ChangedPaths> {
    const compared = reference === '' ? await readDefaultRef(repositoryRoot, cancelSignal) : reference;
    if (compared === '') {
        throw new GspotError('git', 'No upstream or default branch is available; use --changed <ref>.');
    }
    const merged = await readMergeBase(repositoryRoot, compared, cancelSignal);
    const committed = await readGitPaths(repositoryRoot, [...GIT_DIFF_NAMES_ARGUMENTS, merged, '--'], { cancelSignal });
    const working = await readGitPaths(repositoryRoot, GIT_DIFF_NAMES_ARGUMENTS, { cancelSignal });
    const commits = await readGitLines(repositoryRoot, [...GIT_CHANGED_COMMITS_ARGUMENTS, `${merged}..HEAD`, '--'], {
        cancelSignal,
    });
    return {
        reference: compared,
        paths: [...new Set([...committed, ...working])].toSorted((a, b) => a.localeCompare(b)),
        commits,
    };
}
