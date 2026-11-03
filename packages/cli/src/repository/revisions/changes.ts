import { compareText } from '#cli/system/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { decodeGitPaths } from '#cli/repository/git/output.ts';
import type { MergeBase, TreeStatus, ChangedPaths } from '#cli/types/repository.ts';

import {
    runGit,
    readGitText,
    runGitBytes,
    readGitLines,
    readGitPaths,
    buildGitError,
} from '#cli/repository/git/run.ts';
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
    GIT_HASH_EXISTS_ARGUMENTS,
    GIT_REMOTE_HEADS_ARGUMENTS,
    GIT_VERIFY_COMMIT_ARGUMENTS,
    GIT_LOCAL_BRANCHES_ARGUMENTS,
    GIT_CHANGED_COMMITS_ARGUMENTS,
} from '#cli/config/repository/git.ts';

// Git opens a submodule only to find dirty content, which no check reads, and that step fails on a gitlink path that
// is a link. The recorded commit of a submodule still counts.
const GIT_STATUS_ARGUMENTS = [
    'status',
    '--porcelain=v1',
    '-z',
    '--no-renames',
    '--untracked-files=all',
    '--ignore-submodules=dirty',
] as const;

const GIT_NO_OPTIONAL_LOCKS = { GIT_OPTIONAL_LOCKS: '0' } as const;

const STATUS_PATH_START = 3;

const UNCHANGED_STATUS = ' ';

const UNTRACKED_STATUS = '?';

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
List the symbolic `HEAD` of each remote.

@param root the folder where Git runs.
@param cancelSignal stops the Git reads.
@returns each `HEAD` name and the branch that it points to.
*/
export async function listRemoteHeads(root: string, cancelSignal?: AbortSignal): Promise<Array<[string, string]>> {
    const lines = await readGitLines(root, GIT_REMOTE_HEADS_ARGUMENTS, {
        cancelSignal,
    });
    return lines.flatMap((line): Array<[string, string]> => {
        const [name, target] = line.split('\t', REMOTE_HEAD_FIELD_COUNT);
        const isHead = name !== undefined && name.endsWith(HEAD_SUFFIX) && target !== undefined && target !== '';
        return isHead ? [[name, target]] : [];
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
Read the state of the index and the working tree with one `git status` that takes no lock, so a check beside the
user's `git add` or `git commit` never holds or waits for `.git/index.lock`.

@param root the top folder of the working tree; Git prints status paths relative to it.
@param cancelSignal stops the Git command.
@returns the UTF-8 staged, unstaged, and untracked paths, and whether any entry, of any name, is staged.
*/
export async function readTreeStatus(root: string, cancelSignal?: AbortSignal): Promise<TreeStatus> {
    const result = await runGitBytes(root, GIT_STATUS_ARGUMENTS, { cancelSignal, env: GIT_NO_OPTIONAL_LOCKS });
    if (result.code !== 0) throw buildGitError(root, GIT_STATUS_ARGUMENTS, result);
    const records = Buffer.from(result.stdout)
        .toString('latin1')
        .split('\0')
        .filter((record) => record !== '');
    const tracked = records.filter((record) => !record.startsWith(UNTRACKED_STATUS));
    const listPaths = (column: number): string[] =>
        tracked
            .filter((record) => record[column] !== UNCHANGED_STATUS)
            .map((record) => decodeUtf8(Buffer.from(record.slice(STATUS_PATH_START), 'latin1')))
            .filter((path) => path !== undefined);
    const unreadablePaths: string[] = [];
    const untracked = decodeGitPaths(
        Buffer.from(
            records
                .filter((record) => record.startsWith(UNTRACKED_STATUS))
                .map((record) => record.slice(STATUS_PATH_START))
                .join('\0'),
            'latin1',
        ),
        unreadablePaths,
    );
    return {
        staged: listPaths(0).toSorted((a, b) => compareText(a, b)),
        unstaged: listPaths(1),
        untracked: { paths: untracked.split('\0').filter((path) => path !== ''), unreadablePaths },
        hasStagedChanges: tracked.some((record) => record[0] !== UNCHANGED_STATUS),
    };
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
    const compared = reference ?? (await readDefaultRef(root, cancelSignal));
    if (reference === undefined && compared === '') {
        throw new GspotError('git', NO_UPSTREAM_MESSAGE);
    }
    const base = await readMergeBase(root, compared, cancelSignal);
    if (base.hash === undefined) return { reference: compared, ...(base.note !== undefined && { note: base.note }) };
    const merged = base.hash;
    const committed = await readGitPaths(root, [...GIT_DIFF_NAMES_ARGUMENTS, merged, 'HEAD', '--'], { cancelSignal });
    const { staged, unstaged, untracked } = await readTreeStatus(root, cancelSignal);
    const commits = await readGitLines(root, [...GIT_CHANGED_COMMITS_ARGUMENTS, `${merged}..HEAD`, '--'], {
        cancelSignal,
    });
    return {
        reference: compared,
        paths: [...new Set([...committed, ...staged, ...unstaged, ...untracked.paths])].toSorted((a, b) =>
            compareText(a, b),
        ),
        commits,
    };
}
