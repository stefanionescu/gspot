// Staged and changed paths, unstaged overlap, and the base of an upstream push.

// The revisions a push sends, resolved from the ref and object pairs Git hands the pre-push hook.
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/platform/public.ts';
import { HASH_PATTERN } from '#cli/config/parsers/git.ts';
import { gitText, gitLines, gitPaths, isShallow } from '#cli/platform/git/public.ts';
import { LOG_ARGV, ABSENT_HASH, COMMIT_DIFF_ARGV } from '#cli/config/repository/revisions.ts';
import type { PushLine, Comparison, PushSearch, PushRevision, PushSelection } from '#cli/types/repository/revisions.ts';

// Whether a pre-push field pair holds two object ids of the same hash length.
function isHashPair(localHash: string, remoteHash: string): boolean {
    if (!HASH_PATTERN.test(localHash) || !HASH_PATTERN.test(remoteHash)) return false;
    return localHash.length === remoteHash.length;
}

// One line of pre-push input: two refs and two objects of the same hash length.
function parseLine(line: string): PushLine {
    const [localRef, localHash, remoteRef, remoteHash, ...verbatim] = line.trim().split(/\s+/u);
    const hasRefs = verbatim.length === 0 && localRef !== undefined && remoteRef !== undefined;
    if (!hasRefs || localHash === undefined || remoteHash === undefined || !isHashPair(localHash, remoteHash))
        throw new GspotError('selection', [
            'Invalid Git pre-push input. Supply every local and remote ref/object pair.',
        ]);
    return { localRef, localHash, remoteRef, remoteHash };
}

// Peel every live local and comparison object in one Git operation, including annotated tags.
async function peelCommits(
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
    const responses = await gitLines(root, ['cat-file', '--batch-check=%(objectname) %(objecttype)'], {
        cancelSignal,
        stdin: hashes.map((hash) => `${hash}^{}`).join('\n') + '\n',
    });
    if (responses.length !== hashes.length)
        throw new GspotError('selection', 'Git did not resolve every pushed object.');
    return new Map(
        responses.flatMap((line, index): [string, string | undefined][] => {
            const [hash, type] = line.split(' ');
            const requested = hashes[index];
            if (requested === undefined) throw new GspotError('selection', 'Git returned an unrequested object.');
            if (hash === undefined || type === undefined)
                throw new GspotError('selection', `Cannot resolve pushed object ${requested}. Fetch the remote again.`);
            return type === 'missing' ? [] : [[requested, type === 'commit' ? hash : undefined]];
        }),
    );
}

// The commits a shallow clone's history stops at.
async function getShallowBoundaries(root: string, cancelSignal?: AbortSignal): Promise<Set<string>> {
    const path = await gitText(root, ['rev-parse', '--git-path', 'shallow'], { cancelSignal });
    const text = await readFile(resolve(root, path.trim()), 'utf8');
    return new Set(text.trim().split('\n'));
}

// Compare an update with its previous commit, or a new ref with Git's remote-tracking namespace.
async function comparison(context: PushSearch, hash: string, remoteHash: string): Promise<Comparison> {
    const { root, cancelSignal } = context;
    if (!ABSENT_HASH.test(remoteHash)) {
        if (!context.commits.has(remoteHash))
            throw new GspotError('selection', `Cannot resolve pushed object ${remoteHash}. Fetch the remote again.`);
        const previous = context.commits.get(remoteHash);
        if (previous === undefined) return { changed: undefined, range: [hash] };
        const changed = await gitPaths(root, [...COMMIT_DIFF_ARGV, previous, hash, '--'], { cancelSignal });
        return { changed, range: [hash, `^${previous}`] };
    }
    const range = [hash, '--not', context.remote === undefined ? '--remotes' : `--remotes=${context.remote}`];
    const changed = await gitPaths(root, [...LOG_ARGV, ...range, '--'], { cancelSignal });
    return { changed, range };
}

// The revision a pushed commit forms: its history back to the comparison, its tree, and its changed paths.
async function buildRevision(context: PushSearch, line: PushLine, hash: string): Promise<PushRevision> {
    const { root, cancelSignal, boundaries } = context;
    const { changed, range } = await comparison(context, hash, line.remoteHash);
    const history = await gitLines(root, ['rev-list', ...range, '--'], { cancelSignal });
    const tree = await gitText(root, ['rev-parse', '--verify', `${hash}^{tree}`], { cancelSignal });
    const selected = changed === undefined ? undefined : [...new Set(changed)].toSorted((a, b) => a.localeCompare(b));
    return {
        object: hash,
        tree: tree.trim(),
        refs: [line.localRef],
        commits: history,
        historyComplete: !history.some((commit) => boundaries.has(commit)),
        ...(selected === undefined ? {} : { paths: selected }),
    };
}

// Records a revision, merging it into one already recorded with the same tree and paths.
function recordRevision(result: PushSelection, revision: PushRevision): void {
    const duplicate = result.revisions.find(
        (entry) => entry.tree === revision.tree && isDeepStrictEqual(entry.paths, revision.paths),
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
        result.skipped.push({ ref: line.remoteRef, object: line.localHash, reason: 'deleted ref' });
        return;
    }
    if (!context.commits.has(line.localHash))
        throw new GspotError('selection', `Cannot resolve pushed object ${line.localHash}. Fetch the remote again.`);
    const commit = context.commits.get(line.localHash);
    if (commit === undefined) {
        result.skipped.push({ ref: line.localRef, object: line.localHash, reason: 'non-commit object' });
        return;
    }
    recordRevision(result, await buildRevision(context, line, commit));
}

/**
 * Resolve the exact objects supplied by Git's pre-push protocol before running source checks.
 * @param root the repository root.
 * @param input the lines Git hands the pre-push hook on standard input.
 * @param remote the remote name or address supplied to the hook.
 * @param cancelSignal cancellation for the Git commands.
 * @returns the pushed revisions with their commits, and the updates no check applies to.
 */
export async function selectPush(
    root: string,
    input: string,
    remote?: string,
    cancelSignal?: AbortSignal,
): Promise<PushSelection> {
    const lines = input
        .split('\n')
        .filter((row) => row.trim() !== '')
        .map((line) => parseLine(line));
    const shallow = await isShallow(root, { cancelSignal });
    const remotes = remote === undefined ? [] : await gitLines(root, ['remote'], { cancelSignal });
    const context: PushSearch = {
        root,
        cancelSignal,
        commits: await peelCommits(root, lines, cancelSignal),
        remote: remotes.find((name) => name === remote),
        boundaries: shallow ? await getShallowBoundaries(root, cancelSignal) : new Set<string>(),
    };
    const result: PushSelection = { revisions: [], skipped: [] };
    for (const line of lines) await selectLine(context, result, line);
    return result;
}
