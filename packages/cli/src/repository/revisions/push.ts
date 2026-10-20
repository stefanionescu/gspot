// Select pushed revisions and the commit ranges their checks read.
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import { HASH_PATTERN } from '#cli/config/parsers/git.ts';
import { readHead } from '#cli/repository/revisions/tree-entries.ts';
import { readMergeBase, readDefaultRef } from '#cli/repository/revisions/changes.ts';
import { runGit, isShallow, readGitText, readGitLines, readGitPaths } from '#cli/system/git.ts';

import {
    type PushLine,
    type Comparison,
    type PushSearch,
    type PushRevision,
    type PushSelection,
    type CommitSelection,
} from '#cli/types/repository/revisions.ts';
import {
    ABSENT_HASH,
    PEEL_SUFFIX,
    TREE_SUFFIX,
    LOG_ARGUMENTS,
    PEEL_ARGUMENTS,
    TREE_ARGUMENTS,
    REMOTES_OPTION,
    REMOTE_ARGUMENTS,
    REV_LIST_ARGUMENTS,
    DIFF_NAMES_ARGUMENTS,
    SHALLOW_FILE_ARGUMENTS,
    ROOT_COMMITS_ARGUMENTS,
    MISSING_PUSH_REVISION_MESSAGE,
} from '#cli/config/repository/revisions.ts';

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
    const responses = await readGitLines(root, PEEL_ARGUMENTS, {
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
    const path = await readGitText(root, SHALLOW_FILE_ARGUMENTS, { cancelSignal });
    const text = await readFile(resolve(root, path.trim()), 'utf8');
    return new Set(text.trim().split('\n'));
}

// Compare an update with its previous commit, or a new ref with the Git remote-tracking namespace.
async function readComparison(context: PushSearch, hash: string, remoteHash: string): Promise<Comparison> {
    const { root, cancelSignal } = context;
    if (!ABSENT_HASH.test(remoteHash)) {
        if (!context.commits.has(remoteHash))
            throw new GspotError('git', MISSING_PUSH_REVISION_MESSAGE.replace('{hash}', remoteHash));
        const previous = context.commits.get(remoteHash);
        if (previous === undefined)
            return { base: await readPushBase(root, cancelSignal), changed: undefined, range: [hash] };
        const changed = await readGitPaths(root, [...DIFF_NAMES_ARGUMENTS, previous, hash, '--'], { cancelSignal });
        return { base: previous, changed, range: [hash, `^${previous}`] };
    }
    const range = [
        hash,
        '--not',
        context.remote === undefined ? REMOTES_OPTION : `${REMOTES_OPTION}=${context.remote}`,
    ];
    const changed = await readGitPaths(root, [...LOG_ARGUMENTS, ...range, '--'], { cancelSignal });
    return { base: await readPushBase(root, cancelSignal), changed, range };
}

// Build the revision that a pushed commit forms: its history back to the comparison, its tree, and its changed paths.
async function buildRevision(context: PushSearch, line: PushLine, hash: string): Promise<PushRevision> {
    const { root, cancelSignal, boundaries } = context;
    const { base, changed, range } = await readComparison(context, hash, line.remoteHash);
    const history = await readGitLines(root, [...REV_LIST_ARGUMENTS, ...range, '--'], { cancelSignal });
    const tree = await readGitText(root, [...TREE_ARGUMENTS, `${hash}${TREE_SUFFIX}`], { cancelSignal });
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
function recordRevision(result: PushSelection, revision: PushRevision): void {
    const duplicate = result.revisions.find(
        (entry) =>
            entry.hash === revision.hash &&
            entry.base === revision.base &&
            isDeepStrictEqual(entry.paths, revision.paths),
    );
    if (duplicate === undefined) {
        result.revisions.push(revision);
        return;
    }
    duplicate.refs.push(...revision.refs);
    duplicate.historyComplete &&= revision.historyComplete;
    duplicate.commits = [...new Set([...duplicate.commits, ...revision.commits])];
}

// Records what one pre-push line pushes: a deleted ref, a non-commit object, or a revision.
async function selectLine(context: PushSearch, result: PushSelection, line: PushLine): Promise<void> {
    if (ABSENT_HASH.test(line.localHash)) {
        result.skipped.push({ ref: line.remoteRef, hash: line.localHash, reason: 'deleted ref' });
        return;
    }
    if (!context.commits.has(line.localHash))
        throw new GspotError('git', MISSING_PUSH_REVISION_MESSAGE.replace('{hash}', line.localHash));
    const commit = context.commits.get(line.localHash);
    if (commit === undefined) {
        result.skipped.push({ ref: line.localRef, hash: line.localHash, reason: 'non-commit object' });
        return;
    }
    recordRevision(result, await buildRevision(context, line, commit));
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
): Promise<PushSelection> {
    const lines = input
        .split('\n')
        .filter((row) => row.trim() !== '')
        .map((line) => parseLine(line));
    const shallow = await isShallow(repositoryRoot, { cancelSignal });
    const remotes = remote === undefined ? [] : await readGitLines(repositoryRoot, REMOTE_ARGUMENTS, { cancelSignal });
    const context: PushSearch = {
        root: repositoryRoot,
        cancelSignal,
        commits: await readPeeledCommits(repositoryRoot, lines, cancelSignal),
        remote: remotes.find((name) => name === remote),
        boundaries: shallow ? await readShallowBoundaries(repositoryRoot, cancelSignal) : new Set<string>(),
    };
    const result: PushSelection = { revisions: [], skipped: [] };
    for (const line of lines) await selectLine(context, result, line);
    return result;
}

/**
 * Compare a push with its upstream or remote default. Without either, start at the root commit.
 *
 * @param repositoryRoot the folder where Git runs.
 * @param cancelSignal stops the Git commands.
 * @returns the commit the pushed range starts after.
 */
export async function readPushBase(repositoryRoot: string, cancelSignal?: AbortSignal): Promise<string> {
    const compared = await readDefaultRef(repositoryRoot, cancelSignal);
    if (compared !== '') return readMergeBase(repositoryRoot, compared, cancelSignal);
    const roots = await readGitLines(repositoryRoot, ROOT_COMMITS_ARGUMENTS, { cancelSignal });
    return roots.at(-1) as string;
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
): Promise<CommitSelection> {
    if (commits !== undefined) return commits;
    if ((await readHead(repositoryRoot, cancelSignal)) === undefined) return [];
    const base = await readPushBase(repositoryRoot, cancelSignal);
    const listed = await runGit(repositoryRoot, [...REV_LIST_ARGUMENTS, `${base}..HEAD`, '--'], {
        cancelSignal,
    });
    if (listed.code !== 0) return { error: `Cannot select commit messages: ${listed.stderr.trim()}` };
    return listed.stdout.split('\n').filter(Boolean);
}
