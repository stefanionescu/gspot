// Reads committed Git entries and blob contents.
import { GspotError } from '#cli/system/errors.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { runGit, runGitForBytes } from '#cli/system/git.ts';
import { readIndexEntries } from '#cli/repository/tracked.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import { parseGitBlobs, parseTreeEntries, parseIndexRevision } from '#cli/parsers/git.ts';

import {
    HEAD_ARGUMENTS,
    BLOBS_ARGUMENTS,
    TREE_ENTRIES_ARGUMENTS,
    SYMBOLIC_HEAD_ARGUMENTS,
} from '#cli/config/repository/revisions.ts';

/**
 * Read complete index or tree entries without Git path quoting. Reject unresolved conflicts.
 * @param root repository directory.
 * @param source index or commit to inspect.
 * @param cancelSignal command cancellation.
 * @returns validated entries.
 */
export async function listRevisionEntries(
    root: string,
    source: Revision,
    cancelSignal?: AbortSignal,
): Promise<GitEntry[]> {
    if (source.kind === 'index') return parseIndexRevision(await readIndexEntries(root, cancelSignal));
    const read = await runGitForBytes(root, [...TREE_ENTRIES_ARGUMENTS, source.hash], { cancelSignal });
    if (read.code !== 0)
        throw new GspotError(
            'git',
            `Git could not read the entries of this revision: ${read.stderr.trim()}. Resolve Git errors before checking again.`,
        );
    return parseTreeEntries(read.stdout);
}

/**
 * Read raw blobs once, visiting each before allocating the next blob.
 * @param root repository directory.
 * @param requested full blob object IDs.
 * @param visit the consumer of one validated object.
 * @param cancelSignal command cancellation.
 */
export async function visitGitBlobs(
    root: string,
    requested: string[],
    visit: (blobs: AsyncIterable<readonly [string, Buffer]>) => Promise<void>,
    cancelSignal?: AbortSignal,
): Promise<void> {
    const objects = [...new Set(requested)];
    if (objects.length === 0) return;
    const result = await runGit(
        root,
        [...BLOBS_ARGUMENTS],
        {
            stdin: objects.join('\n') + '\n',
            cancelSignal,
        },
        async (chunks) => {
            await visit(parseGitBlobs(chunks, objects));
        },
    );
    if (result.code !== 0)
        throw new GspotError('git', `Git could not read the objects of this revision: ${result.stderr.trim()}`);
}

/**
 * Collect the validated blobs required by a consumer that compares multiple objects.
 * @param root repository directory.
 * @param requested full blob object IDs.
 * @param cancelSignal command cancellation.
 * @returns validated object bytes.
 */
export async function readBlobs(root: string, requested: string[], cancelSignal?: AbortSignal): Promise<Buffer[]> {
    const blobs = new Map<string, Buffer>();
    await visitGitBlobs(
        root,
        requested,
        async (objects) => {
            for await (const [hash, bytes] of objects) blobs.set(hash, bytes);
        },
        cancelSignal,
    );
    return requested.map((hash) => blobs.get(hash) as Buffer);
}

/**
 * Read the current commit, distinguishing an unborn branch from failed Git reads.
 * @param root repository directory.
 * @param cancelSignal command cancellation.
 * @returns current commit hash, or undefined for an unborn branch.
 */
export async function readHead(root: string, cancelSignal?: AbortSignal): Promise<string | undefined> {
    const options = { cancelSignal };
    const head = await runGit(root, [...HEAD_ARGUMENTS], options);
    if (head.code === 0) return head.stdout.trim();
    const failure = new GspotError('git', 'Cannot read committed Git history. Restore HEAD and check again.');
    if (head.code !== 1) throw failure;
    const symbolic = await runGit(root, [...SYMBOLIC_HEAD_ARGUMENTS], options);
    if (symbolic.code !== 0) throw failure;
    return undefined;
}

/**
 * Resolve committed entries, distinguishing an unborn branch from failed Git reads.
 * @param root repository directory.
 * @param cancelSignal command cancellation.
 * @returns current commit entries, or an empty list for an unborn branch.
 */
export async function listHeadEntries(root: string, cancelSignal?: AbortSignal): Promise<GitEntry[]> {
    const head = await readHead(root, cancelSignal);
    return head === undefined ? [] : listRevisionEntries(root, { kind: 'commit', hash: head }, cancelSignal);
}
