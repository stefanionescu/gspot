// The revisions a push sends, resolved from the ref and object pairs Git hands the pre-push hook.
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { GspotError } from '#cli/platform/errors.ts';
import { fetchedRevisions } from '#cli/repository/revisions/refspecs.ts';
import { GIT_HASH, LOG_PATHS, DIFF_PATHS, ABSENT_HASH } from '#cli/config/repository/revisions.ts';
import { gitLines, gitPaths, gitValue, isShallow } from '#cli/repository/revisions/git-queries.ts';
import type { PushLine, Comparison, PushSearch, PushRevision, PushSelection } from '#cli/types/repository/revisions.ts';

// Whether a pre-push field pair holds two object ids of the same hash length.
function isHashPair(localHash: string | undefined, remoteHash: string | undefined): boolean {
    if (localHash === undefined || remoteHash === undefined) return false;
    if (!GIT_HASH.test(localHash) || !GIT_HASH.test(remoteHash)) return false;
    return localHash.length === remoteHash.length;
}

// One line of pre-push input: two refs and two objects of the same hash length.
function parsePushLine(line: string): PushLine {
    const [localRef, localHash, remoteRef, remoteHash, ...extra] = line.trim().split(/\s+/u);
    const hasRefs = extra.length === 0 && localRef !== undefined && remoteRef !== undefined;
    if (!hasRefs || localHash === undefined || remoteHash === undefined || !isHashPair(localHash, remoteHash))
        throw new GspotError('selection', [
            'Invalid Git pre-push input. Supply every local and remote ref/object pair.',
        ]);
    return { localRef, localHash, remoteRef, remoteHash };
}

// The commit an object peels to, or undefined for an object that is not a commit, remembered per object.
async function commitOf(context: PushSearch, gitHash: string): Promise<string | undefined> {
    if (context.commits.has(gitHash)) return context.commits.get(gitHash);
    const { root, cancelSignal } = context;
    const peeled = await gitValue(root, ['rev-parse', '--verify', `${gitHash}^{}`], cancelSignal);
    const type = await gitValue(root, ['cat-file', '-t', peeled], cancelSignal);
    const commit = type === 'commit' ? peeled : undefined;
    context.commits.set(gitHash, commit);
    return commit;
}

// The commits a shallow clone's history stops at.
async function shallowBoundaries(root: string, cancelSignal?: AbortSignal): Promise<Set<string>> {
    const path = await gitValue(root, ['rev-parse', '--git-path', 'shallow'], cancelSignal);
    const text = await readFile(resolve(root, path), 'utf8');
    return new Set(text.trim().split('\n'));
}

// The commits the fetched objects name, in the order the mappings listed them.
async function fetchedCommits(context: PushSearch, remote: string | undefined): Promise<string[]> {
    const fetched: string[] = [];
    for (const stored of await fetchedRevisions(context.root, remote, context.cancelSignal)) {
        const commit = await commitOf(context, stored);
        if (commit !== undefined) fetched.push(commit);
    }
    return fetched;
}

// What a pushed commit is compared against: the remote's commit, or every fetched commit for a new ref.
async function comparison(context: PushSearch, gitHash: string, remoteHash: string): Promise<Comparison> {
    const { root, cancelSignal, fetched, shallow } = context;
    if (!ABSENT_HASH.test(remoteHash)) {
        const previous = await commitOf(context, remoteHash);
        if (previous === undefined) return { changed: undefined, excluded: [] };
        const changed = await gitPaths(root, [...DIFF_PATHS, previous, gitHash, '--'], cancelSignal);
        return { changed, excluded: [previous] };
    }
    if (fetched.length === 0 || shallow) return { changed: undefined, excluded: [] };
    const excluded = [...new Set(fetched)];
    const changed = await gitPaths(root, [...LOG_PATHS, gitHash, '--not', ...excluded, '--'], cancelSignal);
    return { changed, excluded };
}

// The revision a pushed commit forms: its history back to the comparison, its tree, and its changed paths.
async function revisionOf(context: PushSearch, line: PushLine, gitHash: string): Promise<PushRevision> {
    const { root, cancelSignal, boundaries } = context;
    const { changed, excluded } = await comparison(context, gitHash, line.remoteHash);
    const exclusion = excluded.length === 0 ? [] : ['--not', ...excluded];
    const history = await gitLines(root, ['rev-list', gitHash, ...exclusion, '--'], cancelSignal);
    const tree = await gitValue(root, ['rev-parse', '--verify', `${gitHash}^{tree}`], cancelSignal);
    const selected = changed === undefined ? undefined : [...new Set(changed)].toSorted((a, b) => a.localeCompare(b));
    return {
        object: gitHash,
        tree,
        refs: [line.localRef],
        commits: history,
        historyComplete: !history.some((commit) => boundaries.has(commit)),
        ...(selected === undefined ? {} : { paths: selected }),
    };
}

// Records a revision, merging it into one already recorded with the same tree and paths.
function recordRevision(result: PushSelection, revision: PushRevision): void {
    const paths = JSON.stringify(revision.paths);
    const duplicate = result.revisions.find(
        (entry) => entry.tree === revision.tree && JSON.stringify(entry.paths) === paths,
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
        result.notApplicable.push({ ref: line.remoteRef, object: line.localHash, reason: 'deleted ref' });
        return;
    }
    const gitHash = await commitOf(context, line.localHash);
    if (gitHash === undefined) {
        result.notApplicable.push({ ref: line.localRef, object: line.localHash, reason: 'non-commit object' });
        return;
    }
    recordRevision(result, await revisionOf(context, line, gitHash));
}

/**
 * Resolve the exact objects supplied by Git's pre-push protocol before running source checks.
 * @param root the repository root.
 * @param input the lines Git hands the pre-push hook on standard input.
 * @param remote the remote name, when Git gave one.
 * @param cancelSignal cancellation for the Git commands.
 * @returns the pushed revisions with their commits, and the updates no check applies to.
 */
export async function pushedRevisions(
    root: string,
    input: string,
    remote?: string,
    cancelSignal?: AbortSignal,
): Promise<PushSelection> {
    const shallow = await isShallow(root, cancelSignal);
    const context: PushSearch = {
        root,
        cancelSignal,
        commits: new Map(),
        fetched: [],
        shallow,
        boundaries: shallow ? await shallowBoundaries(root, cancelSignal) : new Set<string>(),
    };
    context.fetched = await fetchedCommits(context, remote);
    const result: PushSelection = { revisions: [], notApplicable: [] };
    for (const line of input.split('\n').filter((row) => row.trim() !== ''))
        await selectLine(context, result, parsePushLine(line));
    return result;
}
