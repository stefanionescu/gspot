// Select pushed revisions and the commit ranges their checks read.
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import { readHead } from '#cli/repository/revisions/files.ts';
import { readMergeBase, readDefaultRef } from '#cli/repository/revisions/changes.ts';
import { runGit, readGitText, readGitLines, readGitPaths } from '#cli/system/git.ts';
import { GIT_SHALLOW_ARGUMENTS, GIT_DIFF_NAMES_ARGUMENTS } from '#cli/config/repository/revisions/changes.ts';

import {
    type PushLine,
    type Comparison,
    type PushSearch,
    type PushRevision,
    type PushedRevisions,
} from '#cli/types/repository/revisions.ts';
import {
    TREE_SUFFIX,
    PEEL_SUFFIX,
    ABSENT_HASH,
    HASH_PATTERN,
    REMOTES_OPTION,
    GIT_LOG_ARGUMENTS,
    GIT_TREE_ARGUMENTS,
    GIT_PEEL_ARGUMENTS,
    GIT_REMOTE_ARGUMENTS,
    GIT_REV_LIST_ARGUMENTS,
    GIT_ROOT_COMMITS_ARGUMENTS,
    GIT_SHALLOW_FILE_ARGUMENTS,
    MISSING_PUSH_REVISION_MESSAGE,
} from '#cli/config/repository/revisions/push.ts';

// Check whether a pre-push field pair holds two object IDs of the same hash length.
function isHashPair(localHash: string, remoteHash: string): boolean {
    if (!HASH_PATTERN.test(localHash) || !HASH_PATTERN.test(remoteHash)) return false;
    return localHash.length === remoteHash.length;
}

// Parse one line of pre-push input: two refs and two objects of the same hash length.
function parseLine(line: string): PushLine {
    const [localRef, localHash, remoteRef, remoteHash, ...verbatim] = line.trim().split(/\s+/u);
    const hasRefs = verbatim.length === 0 && localRef !== undefined && remoteRef !== undefined;
    if (!hasRefs || localHash === undefined || remoteHash === undefined || !isHashPair(localHash, remoteHash))
        throw new GspotError('git', 'Invalid Git pre-push input. Supply every local and remote ref/object pair.');
    return { localRef, localHash, remoteRef, remoteHash };
}

// Peel every live local and comparison object in one Git operation, including annotated tags.
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
    if (responses.length !== hashes.length) throw new GspotError('git', 'Git did not resolve every pushed object.');
    return new Map(
        hashes.flatMap((requested, index): [string, string | undefined][] => {
            const [hash, type] = (responses[index] as string).split(' ') as [string, string];
            return type === 'missing' ? [] : [[requested, type === 'commit' ? hash : undefined]];
        }),
    );
}

// Read the commits where the history of a shallow clone stops.
async function readShallowBoundaries(root: string, cancelSignal?: AbortSignal): Promise<Set<string>> {
    const path = await readGitText(root, GIT_SHALLOW_FILE_ARGUMENTS, { cancelSignal });
    const text = await readFile(resolve(root, path.trim()), 'utf8');
    return new Set(text.trim().split('\n'));
}

// Compare an update with its previous commit, or a new ref with the Git remote-tracking namespace.
async function readComparison(search: PushSearch, hash: string, remoteHash: string): Promise<Comparison> {
    const { root, cancelSignal } = search;
    if (!ABSENT_HASH.test(remoteHash)) {
        if (!search.commits.has(remoteHash))
            throw new GspotError('git', MISSING_PUSH_REVISION_MESSAGE.replace('{hash}', remoteHash));
        const previous = search.commits.get(remoteHash);
        if (previous === undefined)
            return { base: await readPushBase(root, cancelSignal), changed: undefined, range: [hash] };
        const changed = await readGitPaths(root, [...GIT_DIFF_NAMES_ARGUMENTS, previous, hash, '--'], { cancelSignal });
        return { base: previous, changed, range: [hash, `^${previous}`] };
    }
    const range = [hash, '--not', search.remote === undefined ? REMOTES_OPTION : `${REMOTES_OPTION}=${search.remote}`];
    const changed = await readGitPaths(root, [...GIT_LOG_ARGUMENTS, ...range, '--'], { cancelSignal });
    return { base: await readPushBase(root, cancelSignal), changed, range };
}

// Build the revision that a pushed commit forms: its history back to the comparison, its tree, and its changed paths.
async function buildRevision(search: PushSearch, line: PushLine, hash: string): Promise<PushRevision> {
    const { root, cancelSignal, boundaries } = search;
    const { base, changed, range } = await readComparison(search, hash, line.remoteHash);
    const history = await readGitLines(root, [...GIT_REV_LIST_ARGUMENTS, ...range, '--'], { cancelSignal });
    const tree = await readGitText(root, [...GIT_TREE_ARGUMENTS, `${hash}${TREE_SUFFIX}`], { cancelSignal });
    const selected = changed === undefined ? undefined : [...new Set(changed)].toSorted((a, b) => a.localeCompare(b));
    return {
        base,
        hash,
        tree: tree.trim(),
        refs: [line.localRef],
        commits: history,
        historyComplete: !history.some((commit) => boundaries.has(commit)),
        ...(selected === undefined ? {} : { paths: selected }),
    };
}

// Share a check only for matching commits, comparison bases, and changed paths.
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
    duplicate.historyComplete &&= revision.historyComplete;
    duplicate.commits = [...new Set([...duplicate.commits, ...revision.commits])];
}

// Records what one pre-push line pushes: a deleted ref, a non-commit object, or a revision.
async function selectLine(search: PushSearch, pushed: PushedRevisions, line: PushLine): Promise<void> {
    if (ABSENT_HASH.test(line.localHash)) {
        pushed.skipped.push({ ref: line.remoteRef, hash: line.localHash, reason: 'deleted ref' });
        return;
    }
    if (!search.commits.has(line.localHash))
        throw new GspotError('git', MISSING_PUSH_REVISION_MESSAGE.replace('{hash}', line.localHash));
    const commit = search.commits.get(line.localHash);
    if (commit === undefined) {
        pushed.skipped.push({ ref: line.localRef, hash: line.localHash, reason: 'non-commit object' });
        return;
    }
    addRevision(pushed, await buildRevision(search, line, commit));
}

/**
 * Compare a push with its upstream or remote default. Without either, start at the root commit.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param cancelSignal stops the Git commands.
 * @returns the commit the pushed range starts after.
 */
async function readPushBase(repositoryRoot: string, cancelSignal?: AbortSignal): Promise<string> {
    const compared = await readDefaultRef(repositoryRoot, cancelSignal);
    if (compared !== '') return readMergeBase(repositoryRoot, compared, cancelSignal);
    const roots = await readGitLines(repositoryRoot, GIT_ROOT_COMMITS_ARGUMENTS, { cancelSignal });
    return roots.at(-1) as string;
}

/**
 * Resolve the exact objects that the Git pre-push input names, before source checks run.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param input the lines that Git writes to the pre-push hook.
 * @param remote the name or address that the hook gets.
 * @param cancelSignal stops the Git commands.
 * @returns the pushed revisions with their commits, and the updates no check applies to.
 */
export async function selectPush(
    repositoryRoot: string,
    input: string,
    remote?: string,
    cancelSignal?: AbortSignal,
): Promise<PushedRevisions> {
    const lines = input
        .split('\n')
        .filter((row) => row.trim() !== '')
        .map((line) => parseLine(line));
    const shallowAnswer = await readGitText(repositoryRoot, GIT_SHALLOW_ARGUMENTS, { cancelSignal });
    const shallow = shallowAnswer.trim() === 'true';
    const remotes =
        remote === undefined ? [] : await readGitLines(repositoryRoot, GIT_REMOTE_ARGUMENTS, { cancelSignal });
    const context: PushSearch = {
        root: repositoryRoot,
        cancelSignal,
        commits: await readPeeledCommits(repositoryRoot, lines, cancelSignal),
        remote: remotes.find((name) => name === remote),
        boundaries: shallow ? await readShallowBoundaries(repositoryRoot, cancelSignal) : new Set<string>(),
    };
    const result: PushedRevisions = { revisions: [], skipped: [] };
    for (const line of lines) await selectLine(context, result, line);
    return result;
}

/**
 * Read the commits after the push base, unless the caller names the pushed commits.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param commits the pushed revisions, if known.
 * @param cancelSignal stops the Git commands.
 * @returns the commits, or the Git error.
 */
export async function readPushedCommits(
    repositoryRoot: string,
    commits: string[] | undefined,
    cancelSignal?: AbortSignal,
): Promise<string[] | { error: string }> {
    if (commits !== undefined) return commits;
    if ((await readHead(repositoryRoot, cancelSignal)) === undefined) return [];
    const base = await readPushBase(repositoryRoot, cancelSignal);
    const listed = await runGit(repositoryRoot, [...GIT_REV_LIST_ARGUMENTS, `${base}..HEAD`, '--'], {
        cancelSignal,
    });
    if (listed.code !== 0) return { error: `Cannot select commit messages: ${listed.stderr.trim()}` };
    return listed.stdout.split('\n').filter(Boolean);
}
