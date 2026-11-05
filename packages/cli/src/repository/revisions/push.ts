import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { WHITESPACE_RUN } from '#cli/config/parsers.ts';
import {
    ABSENT_HASH,
    BRANCHES_PREFIX,
    DEFAULT_BRANCHES,
    DELETED_REF_REASON,
    FORCE_PUSH_MESSAGE,
    GIT_DIFF_NAMES_ARGUMENTS,
    GIT_IS_ANCESTOR_ARGUMENTS,
    GIT_LOG_ARGUMENTS,
    GIT_PEEL_ARGUMENTS,
    GIT_REMOTE_ARGUMENTS,
    GIT_REV_LIST_ARGUMENTS,
    GIT_ROOT_COMMITS_ARGUMENTS,
    GIT_SHALLOW_ARGUMENTS,
    GIT_SHALLOW_FILE_ARGUMENTS,
    GIT_TREE_ARGUMENTS,
    HASH_PATTERN,
    INVALID_PUSH_INPUT_MESSAGE,
    MISSING_PUSH_REVISION_MESSAGE,
    NON_COMMIT_REASON,
    NOT_FLAG,
    PEEL_FAILURE_MESSAGE,
    PEEL_SUFFIX,
    REMOTES_FLAG,
    TREE_SUFFIX,
    UNFETCHED_PUSH_MESSAGE,
} from '#cli/config/repository/git.ts';
import { readGitLines, readGitPaths, readGitText, runGit } from '#cli/repository/git/run.ts';
import {
    findRemoteDefaultBranch,
    listRemoteRefs,
    readDefaultRef,
    readMergeBase,
} from '#cli/repository/revisions/changes.ts';
import { readHead } from '#cli/repository/revisions/files.ts';
import { GspotError } from '#cli/system/errors.ts';
import { compareText } from '#cli/system/text.ts';
import type { Comparison, PushedRevisions, PushLine, PushRevision, PushSearch } from '#cli/types/repository.ts';

function parsePushLine(line: string): PushLine {
    const [localRef, localHash, remoteRef, remoteHash, ...verbatim] = line.trim().split(WHITESPACE_RUN);
    const hasRefs = verbatim.length === 0 && localRef !== undefined && remoteRef !== undefined;
    if (
        !hasRefs ||
        localHash === undefined ||
        remoteHash === undefined ||
        [localHash, remoteHash].some((hash) => !HASH_PATTERN.test(hash)) ||
        localHash.length !== remoteHash.length
    )
        throw new GspotError('git', INVALID_PUSH_INPUT_MESSAGE);
    return { localRef, localHash, remoteRef, remoteHash };
}

function assertCommitPresent(commits: PushSearch['commits'], hash: string): void {
    if (!commits.has(hash))
        throw new GspotError(
            'git',
            MISSING_PUSH_REVISION_MESSAGE.replace('{hash}', () => hash),
        );
}

async function readPeeledCommits(
    root: string,
    lines: PushLine[],
    cancelSignal?: AbortSignal,
): Promise<Map<string, string | undefined>> {
    const hashes = [
        ...new Set(
            lines
                .filter((line) => !ABSENT_HASH.test(line.localHash))
                .flatMap((line) => [line.localHash, line.remoteHash].filter((hash) => !ABSENT_HASH.test(hash))),
        ),
    ];
    if (hashes.length === 0) return new Map();
    const responses = await readGitLines(root, GIT_PEEL_ARGUMENTS, {
        cancelSignal,
        stdin: hashes.map((hash) => `${hash}${PEEL_SUFFIX}`).join('\n') + '\n',
    });
    if (responses.length !== hashes.length) throw new GspotError('git', PEEL_FAILURE_MESSAGE);
    return new Map(
        hashes.flatMap((requested, index): Array<[string, string | undefined]> => {
            const [hash, type] = (responses[index] as string).split(' ') as [string, string];
            return type === 'missing' ? [] : [[requested, type === 'commit' ? hash : undefined]];
        }),
    );
}

async function readShallowBoundaries(root: string, cancelSignal?: AbortSignal): Promise<Set<string>> {
    const path = await readGitText(root, GIT_SHALLOW_FILE_ARGUMENTS, { cancelSignal });
    const text = readFileSync(resolve(root, path.trim()), 'utf8');
    return new Set(text.trim().split('\n'));
}

async function readComparison(search: PushSearch, hash: string, remoteHash: string): Promise<Comparison> {
    const { root, cancelSignal, remoteRefs } = search;
    if (!ABSENT_HASH.test(remoteHash) && search.commits.has(remoteHash)) {
        const previous = search.commits.get(remoteHash);
        if (previous === undefined)
            return { base: await readPushBase(root, cancelSignal, remoteRefs), changed: undefined, range: [hash] };
        const changed = await readGitPaths(root, [...GIT_DIFF_NAMES_ARGUMENTS, previous, hash, '--'], { cancelSignal });
        return { base: previous, changed, range: [hash, `^${previous}`] };
    }
    const range = [hash, NOT_FLAG, search.remote === undefined ? REMOTES_FLAG : `${REMOTES_FLAG}=${search.remote}`];
    const changed = await readGitPaths(root, [...GIT_LOG_ARGUMENTS, ...range, '--'], { cancelSignal });
    return { base: await readPushBase(root, cancelSignal, remoteRefs), changed, range };
}

async function buildRevision(search: PushSearch, line: PushLine, hash: string): Promise<PushRevision> {
    const { root, cancelSignal, boundaries } = search;
    const { base, changed, range } = await readComparison(search, hash, line.remoteHash);
    const history = await readGitLines(root, [...GIT_REV_LIST_ARGUMENTS, ...range, '--'], { cancelSignal });
    const tree = await readGitText(root, [...GIT_TREE_ARGUMENTS, `${hash}${TREE_SUFFIX}`], { cancelSignal });
    const selected = changed === undefined ? undefined : [...new Set(changed)].toSorted((a, b) => compareText(a, b));
    return {
        base,
        hash,
        tree: tree.trim(),
        refs: [line.localRef],
        commits: history,
        range,
        shallow: history.some((commit) => boundaries.has(commit)),
        ...(selected !== undefined && { paths: selected }),
    };
}

function addRevision(pushed: PushedRevisions, revision: PushRevision): void {
    const duplicate = pushed.revisions.find(
        (each) =>
            each.hash === revision.hash && each.base === revision.base && isDeepStrictEqual(each.paths, revision.paths),
    );
    if (duplicate === undefined) {
        pushed.revisions.push(revision);
        return;
    }
    duplicate.refs.push(...revision.refs);
    duplicate.shallow ||= revision.shallow;
    duplicate.commits = [...new Set([...duplicate.commits, ...revision.commits])];
}

function listDefaultBranches(remoteRefs: ReadonlyMap<string, string>, remote: string | undefined): string[] {
    const branch = remote === undefined ? undefined : findRemoteDefaultBranch(remoteRefs, remote);
    return (branch === undefined ? DEFAULT_BRANCHES : [branch]).map((name) => `${BRANCHES_PREFIX}${name}`);
}

async function assertFastForward(search: PushSearch, line: PushLine): Promise<void> {
    if (ABSENT_HASH.test(line.remoteHash)) return;
    const fill = (message: string): string =>
        message.replace('{ref}', () => line.remoteRef).replace('{hash}', () => line.remoteHash);
    if (!search.commits.has(line.remoteHash)) throw new GspotError('git', fill(UNFETCHED_PUSH_MESSAGE));
    const ancestry = await runGit(search.root, [...GIT_IS_ANCESTOR_ARGUMENTS, line.remoteHash, line.localHash], {
        cancelSignal: search.cancelSignal,
    });
    if (ancestry.code !== 0) throw new GspotError('git', fill(FORCE_PUSH_MESSAGE));
}

async function addPushLine(search: PushSearch, pushed: PushedRevisions, line: PushLine): Promise<void> {
    if (ABSENT_HASH.test(line.localHash)) {
        pushed.skipped.push({ ref: line.remoteRef, hash: line.localHash, reason: DELETED_REF_REASON });
        return;
    }
    assertCommitPresent(search.commits, line.localHash);
    if (search.defaultBranches.includes(line.remoteRef)) await assertFastForward(search, line);
    const commit = search.commits.get(line.localHash);
    if (commit === undefined) {
        pushed.skipped.push({ ref: line.localRef, hash: line.localHash, reason: NON_COMMIT_REASON });
        return;
    }
    addRevision(pushed, await buildRevision(search, line, commit));
}

async function readPushBase(
    root: string,
    cancelSignal?: AbortSignal,
    remoteRefs?: ReadonlyMap<string, string>,
): Promise<string> {
    const compared = await readDefaultRef(root, cancelSignal, remoteRefs);
    if (compared !== '') {
        const base = await readMergeBase(root, compared, cancelSignal);
        if (base.hash !== undefined) return base.hash;
    }
    const roots = await readGitLines(root, GIT_ROOT_COMMITS_ARGUMENTS, { cancelSignal });
    return roots.at(-1) as string;
}

/**
Resolve the exact objects that the Git pre-push input names.

@param root the folder where Git runs.
@param input the lines that Git writes to the pre-push hook.
@param remote the name or address that the hook gets.
@param cancelSignal stops the Git commands.
*/
export async function readPushedRevisions(
    root: string,
    input: string,
    remote?: string,
    cancelSignal?: AbortSignal,
): Promise<PushedRevisions> {
    const lines = input
        .split('\n')
        .filter((row) => row.trim() !== '')
        .map((line) => parsePushLine(line));
    const shallowAnswer = await readGitText(root, GIT_SHALLOW_ARGUMENTS, { cancelSignal });
    const isShallow = shallowAnswer.trim() === 'true';
    const remotes = remote === undefined ? [] : await readGitLines(root, GIT_REMOTE_ARGUMENTS, { cancelSignal });
    const remoteName = remotes.find((name) => name === remote);
    const remoteRefs = await listRemoteRefs(root, cancelSignal);
    const context: PushSearch = {
        root: root,
        cancelSignal,
        commits: await readPeeledCommits(root, lines, cancelSignal),
        remote: remoteName,
        remoteRefs,
        defaultBranches: listDefaultBranches(remoteRefs, remoteName),
        boundaries: isShallow ? await readShallowBoundaries(root, cancelSignal) : new Set<string>(),
    };
    const result: PushedRevisions = { revisions: [], skipped: [] };
    for (const line of lines) await addPushLine(context, result, line);
    return result;
}

/**
Read the commits after the push base.

@param root the folder where Git runs.
@param cancelSignal stops the Git commands.
*/
export async function readPushedCommits(root: string, cancelSignal?: AbortSignal): Promise<string[]> {
    if ((await readHead(root, cancelSignal)) === undefined) return [];
    const base = await readPushBase(root, cancelSignal);
    const listed = await runGit(root, [...GIT_REV_LIST_ARGUMENTS, `${base}..HEAD`, '--'], {
        cancelSignal,
    });
    if (listed.code !== 0) throw new GspotError('git', `Cannot select commit messages: ${listed.stderr.trim()}`);
    return listed.stdout.split('\n').filter(Boolean);
}

/**
Read the revision range for checks of outgoing commits.

@param root the Git repository.
@param cancelSignal cancellation for Git reads.
@returns the revision arguments, or no arguments without a current commit.
*/
export async function readPushedRange(root: string, cancelSignal?: AbortSignal): Promise<string[]> {
    if ((await readHead(root, cancelSignal)) === undefined) return [];
    const base = await readPushBase(root, cancelSignal);
    return [`${base}..HEAD`];
}
