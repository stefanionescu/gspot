import {
    ABSENT_HASH,
    COMMIT_SUFFIX,
    DEFAULT_BRANCHES,
    GIT_CHANGED_COMMITS_ARGUMENTS,
    GIT_DIFF_NAMES_ARGUMENTS,
    GIT_HASH_EXISTS_ARGUMENTS,
    GIT_LOCAL_BRANCHES_ARGUMENTS,
    GIT_MERGE_BASE_ARGUMENTS,
    GIT_REF_NAME_ARGUMENTS,
    GIT_REMOTE_HEADS_ARGUMENTS,
    GIT_UPSTREAM_ARGUMENTS,
    GIT_VERIFY_COMMIT_ARGUMENTS,
    HASH_PATTERN,
    ORIGIN_REMOTE,
    REMOTE_HEAD_FIELD_COUNT,
    REMOTES_PREFIX,
} from '#cli/config/repository/git.ts';
import { decodeGitPath } from '#cli/repository/git/output.ts';
import {
    buildGitError,
    readGitLines,
    readGitPaths,
    readGitText,
    runGit,
    runGitBytes,
} from '#cli/repository/git/run.ts';
import { isShallowClone } from '#cli/repository/revisions/files.ts';
import { GspotError } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text.ts';
import type { ChangedPaths, MergeBase, TreeStatus } from '#cli/types/repository.ts';

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

const SHALLOW_CLONE_HELP =
    ' This clone is shallow and lacks older commits. Fetch the full history with git fetch --unshallow, or set the fetch depth of the checkout to 0.';

const STATUS_PATH_START = 3;

const UNCHANGED_STATUS = ' ';

const UNTRACKED_STATUS = '?';

const REMOTE_HEAD = 'origin/HEAD';

const REMOTE_HEAD_HELP =
    ' A clone sets origin/HEAD, and git remote add does not, so run git remote set-head origin --auto. Before the first push to an empty remote, that command fails, so run gspot check --only push.';

async function explainInvalidBase(root: string, compared: string, cancelSignal?: AbortSignal): Promise<MergeBase> {
    if (HASH_PATTERN.test(compared)) {
        const presence = await runGit(root, [...GIT_HASH_EXISTS_ARGUMENTS, compared], { cancelSignal });
        if (presence.code !== 0) return { note: `Checked every file: base ${compared} is not present in this clone.` };
    }
    const branches = await readGitLines(root, GIT_LOCAL_BRANCHES_ARGUMENTS, { cancelSignal });
    const help = (await isShallowClone(root, cancelSignal)) ? SHALLOW_CLONE_HELP : '';
    throw new GspotError(
        'arguments',
        `${compared} is not a branch, tag, or commit in this repository. Local branches: ${branches.join(', ') || 'none'}.${compared === REMOTE_HEAD ? REMOTE_HEAD_HELP : ''}${help}`,
    );
}

export async function listRemoteRefs(root: string, cancelSignal?: AbortSignal): Promise<ReadonlyMap<string, string>> {
    const lines = await readGitLines(root, GIT_REMOTE_HEADS_ARGUMENTS, { cancelSignal });
    return new Map(
        lines.map((line): [string, string] => {
            const [name = '', target = ''] = line.split('\t', REMOTE_HEAD_FIELD_COUNT);
            return [name, target];
        }),
    );
}

export function findRemoteDefaultBranch(remoteRefs: ReadonlyMap<string, string>, remote: string): string | undefined {
    const prefix = `${REMOTES_PREFIX}${remote}/`;
    const target = remoteRefs.get(`${prefix}HEAD`);
    if (target?.startsWith(prefix) === true) return target.slice(prefix.length);
    return DEFAULT_BRANCHES.find((branch) => remoteRefs.has(`${prefix}${branch}`));
}

/**
Name the ref that `ref` compares with: its upstream, or else the default branch of `origin`. A `ref` that names no
branch of this clone, such as a commit hash or the local name on a pre-push line that Git did not write, has no
upstream.
*/
export async function readDefaultRef(
    root: string,
    ref: string,
    cancelSignal?: AbortSignal,
    remoteRefs?: ReadonlyMap<string, string>,
): Promise<string> {
    const name = await runGit(root, [...GIT_REF_NAME_ARGUMENTS, ref], { cancelSignal });
    if (name.code > 1) throw buildGitError(GIT_REF_NAME_ARGUMENTS, name);
    const upstreamText = await readGitText(root, [...GIT_UPSTREAM_ARGUMENTS, name.stdout.trim()], {
        cancelSignal,
    });
    const upstream = upstreamText.trim();
    if (upstream !== '') return upstream;
    const branch = findRemoteDefaultBranch(remoteRefs ?? (await listRemoteRefs(root, cancelSignal)), ORIGIN_REMOTE);
    return branch === undefined ? '' : `${REMOTES_PREFIX}${ORIGIN_REMOTE}/${branch}`;
}

/**
Read the newest commit that `compared` and `head` share. The result holds a note and no hash when the caller must
check every file, which includes two histories that share no commit.
*/
export async function readMergeBase(
    root: string,
    compared: string,
    head: string,
    cancelSignal?: AbortSignal,
): Promise<MergeBase> {
    if (compared === '') return { note: 'Checked every file: the base ref is empty.' };
    if (ABSENT_HASH.test(compared)) return { note: 'Checked every file: the base is a new branch.' };
    const commit = await runGit(root, [...GIT_VERIFY_COMMIT_ARGUMENTS, `${compared}${COMMIT_SUFFIX}`], {
        cancelSignal,
    });
    if (commit.code !== 0) return explainInvalidBase(root, compared, cancelSignal);
    const base = await runGit(root, [...GIT_MERGE_BASE_ARGUMENTS, commit.stdout.trim(), head], {
        cancelSignal,
    });
    if (base.code === 0) return { hash: base.stdout.trim() };
    if (base.code === 1 && base.stderr.trim() === '')
        return { note: `Checked every file: ${compared} and ${head} share no commit.` };
    const help = (await isShallowClone(root, cancelSignal)) ? SHALLOW_CLONE_HELP : '';
    throw new GspotError('git', `Git merge-base failed for ${compared}: ${base.stderr.trim()}.${help}`);
}

/**
Read the state of the index and the working tree with one `git status` that takes no lock, so a check beside the
user's `git add` or `git commit` never holds or waits for `.git/index.lock`.
*/
export async function readTreeStatus(root: string, cancelSignal?: AbortSignal): Promise<TreeStatus> {
    const result = await runGitBytes(root, GIT_STATUS_ARGUMENTS, { cancelSignal, env: GIT_NO_OPTIONAL_LOCKS });
    if (result.code !== 0) throw buildGitError(GIT_STATUS_ARGUMENTS, result);
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
    const untracked = records
        .filter((record) => record.startsWith(UNTRACKED_STATUS))
        .map((record) => decodeGitPath(record.slice(STATUS_PATH_START), unreadablePaths))
        .filter((path) => path !== undefined);
    return {
        staged: listPaths(0).toSorted((a, b) => compareText(a, b)),
        unstaged: listPaths(1),
        untracked: { paths: untracked, unreadablePaths },
        hasStagedChanges: tracked.some((record) => record[0] !== UNCHANGED_STATUS),
    };
}

export async function readChangedPaths(
    root: string,
    compared: string,
    cancelSignal?: AbortSignal,
): Promise<ChangedPaths> {
    const base = await readMergeBase(root, compared, 'HEAD', cancelSignal);
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
