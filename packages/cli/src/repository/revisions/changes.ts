import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { GIT_UNTRACKED_FILES_ARGUMENTS } from '#cli/config/repository/files.ts';
import type { MergeBase, StagedPaths, ChangedPaths } from '#cli/types/repository.ts';
import { runGit, readGitText, readGitLines, readGitPaths, buildGitError } from '#cli/repository/git/run.ts';

import {
    ORIGIN_HEAD,
    HEAD_SUFFIX,
    COMMIT_SUFFIX,
    EMPTY_BASE_HASH,
    COMMIT_HASH_PATTERN,
    NO_UPSTREAM_MESSAGE,
    HISTORY_CUT_MESSAGE,
    GIT_SHALLOW_ARGUMENTS,
    GIT_UPSTREAM_ARGUMENTS,
    REMOTE_HEAD_FIELD_COUNT,
    GIT_HEAD_NAME_ARGUMENTS,
    GIT_DIFF_NAMES_ARGUMENTS,
    GIT_MERGE_BASE_ARGUMENTS,
    GIT_STAGED_DIFF_ARGUMENTS,
    GIT_HASH_EXISTS_ARGUMENTS,
    GIT_STAGED_QUIET_ARGUMENTS,
    GIT_REMOTE_HEADS_ARGUMENTS,
    GIT_VERIFY_COMMIT_ARGUMENTS,
    GIT_LOCAL_BRANCHES_ARGUMENTS,
    GIT_CHANGED_COMMITS_ARGUMENTS,
} from '#cli/config/repository/git.ts';

/**
List the symbolic `HEAD` of each remote.

@param root the folder where Git runs.
@param cancelSignal stops the Git reads.
@returns each `HEAD` name and the branch that it points to.
*/
export async function listRemoteHeads(root: string, cancelSignal?: AbortSignal): Promise<Array<[string, string]>> {
    const lines = await readGitLines(root, GIT_REMOTE_HEADS_ARGUMENTS, {
        cancelSignal,
    });
    return lines.flatMap((line) => {
        const [name, target] = line.split('\t', REMOTE_HEAD_FIELD_COUNT);
        const isHead = name !== undefined && name.endsWith(HEAD_SUFFIX) && target !== undefined && target !== '';
        return isHead ? [[name, target] as [string, string]] : [];
    });
}

/**
Read the upstream or remote default branch.

@param root the folder where Git runs.
@param cancelSignal stops the Git reads.
@returns an empty string without a branch.
*/
export async function readDefaultRef(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const head = await readGitText(root, GIT_HEAD_NAME_ARGUMENTS, { cancelSignal });
    const upstreamText = await readGitText(root, [...GIT_UPSTREAM_ARGUMENTS, head.trim()], {
        cancelSignal,
    });
    const upstream = upstreamText.trim();
    if (upstream !== '') return upstream;
    const heads = await listRemoteHeads(root, cancelSignal);
    const preferred = heads.find(([name]) => name === ORIGIN_HEAD);
    return preferred?.[1] ?? '';
}

async function explainInvalidBase(root: string, compared: string, cancelSignal?: AbortSignal): Promise<MergeBase> {
    if (COMMIT_HASH_PATTERN.test(compared)) {
        const presence = await runGit(root, [...GIT_HASH_EXISTS_ARGUMENTS, compared], { cancelSignal });
        if (presence.code !== 0) return { note: `Checked every file: base ${compared} is not present in this clone.` };
    }
    const branches = await readGitLines(root, GIT_LOCAL_BRANCHES_ARGUMENTS, { cancelSignal });
    throw new GspotError(
        'arguments',
        `${compared} is not a branch, tag, or commit in this repository. Local branches: ${branches.join(', ') || 'none'}.`,
    );
}

/**
Read the merge base between a comparison branch and `HEAD`.

@param root the folder where Git runs.
@param compared the comparison branch.
@param cancelSignal stops the Git reads.
*/
export async function readMergeBase(root: string, compared: string, cancelSignal?: AbortSignal): Promise<MergeBase> {
    if (EMPTY_BASE_HASH.test(compared))
        return {
            note: `Checked every file: ${compared === '' ? 'the base ref is empty' : 'the base is a new branch'}.`,
        };
    const commit = await runGit(root, [...GIT_VERIFY_COMMIT_ARGUMENTS, `${compared}${COMMIT_SUFFIX}`], {
        cancelSignal,
    });
    if (commit.code !== 0) return explainInvalidBase(root, compared, cancelSignal);
    const base = await runGit(root, [...GIT_MERGE_BASE_ARGUMENTS, commit.stdout.trim(), 'HEAD'], {
        cancelSignal,
    });
    if (base.code === 0) return { hash: base.stdout.trim() };
    const shallow = await readGitText(root, GIT_SHALLOW_ARGUMENTS, { cancelSignal });
    const help = shallow.trim() === 'true' ? HISTORY_CUT_MESSAGE : '';
    throw new GspotError('git', `Git merge-base failed for ${compared}: ${base.stderr.trim()}.${help}`);
}

/**
Read the staged paths, with deletions and both sides of renames, and count paths with unstaged changes.

@param root the folder where Git runs.
@param cancelSignal stops the Git commands.
@returns the staged paths, sorted, and the unstaged count.
*/
export async function readStagedPaths(root: string, cancelSignal?: AbortSignal): Promise<StagedPaths> {
    const cached = await readGitPaths(root, GIT_STAGED_DIFF_ARGUMENTS, { cancelSignal });
    const changed = await readGitPaths(root, GIT_DIFF_NAMES_ARGUMENTS, { cancelSignal });
    const staged = cached.toSorted((a, b) => compareText(a, b));
    const dirty = new Set(changed);
    return { staged, unstaged: staged.filter((path) => dirty.has(path)).length };
}

/**
Check whether the index differs from `HEAD`. A staged name outside UTF-8 counts, though readStagedPaths leaves it out.

@param root the folder where Git runs.
@param cancelSignal stops the Git command.
*/
export async function hasStagedChanges(root: string, cancelSignal?: AbortSignal): Promise<boolean> {
    const result = await runGit(root, GIT_STAGED_QUIET_ARGUMENTS, { cancelSignal });
    if (result.code > 1) throw buildGitError(root, GIT_STAGED_QUIET_ARGUMENTS, result);
    return result.code === 1;
}

/**
Read the files and commits that changed after a ref.

@param root the folder where Git runs.
@param reference the git ref to compare against; absent selects the upstream or the default branch of origin.
@param cancelSignal stops the Git commands.
*/
export async function readChangedPaths(
    root: string,
    reference: string | undefined,
    cancelSignal?: AbortSignal,
): Promise<ChangedPaths> {
    const compared = reference === undefined ? await readDefaultRef(root, cancelSignal) : reference;
    if (reference === undefined && compared === '') {
        throw new GspotError('git', NO_UPSTREAM_MESSAGE);
    }
    const base = await readMergeBase(root, compared, cancelSignal);
    if (base.hash === undefined)
        return { reference: compared, ...(base.note === undefined ? {} : { note: base.note }) };
    const merged = base.hash;
    const committed = await readGitPaths(root, [...GIT_DIFF_NAMES_ARGUMENTS, merged, '--'], { cancelSignal });
    const working = await readGitPaths(root, GIT_DIFF_NAMES_ARGUMENTS, { cancelSignal });
    const untracked = await readGitPaths(root, GIT_UNTRACKED_FILES_ARGUMENTS, { cancelSignal });
    const commits = await readGitLines(root, [...GIT_CHANGED_COMMITS_ARGUMENTS, `${merged}..HEAD`, '--'], {
        cancelSignal,
    });
    return {
        reference: compared,
        paths: [...new Set([...committed, ...working, ...untracked])].toSorted((a, b) => compareText(a, b)),
        commits,
    };
}

/**
Check whether the working tree holds what the index holds, with no untracked file.

@param root the folder where Git runs.
@param cancelSignal stops the Git commands.
*/
export async function isWorkingTreeClean(root: string, cancelSignal?: AbortSignal): Promise<boolean> {
    const changed = await readGitPaths(root, GIT_DIFF_NAMES_ARGUMENTS, { cancelSignal });
    if (changed.length > 0) return false;
    const untracked = await readGitPaths(root, GIT_UNTRACKED_FILES_ARGUMENTS, { cancelSignal });
    return untracked.length === 0;
}
