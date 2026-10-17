// Reads committed Git entries and blob contents.
import { GspotError } from '#cli/system/errors.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { runGit, runGitForBytes } from '#cli/system/git.ts';
import { readIndexEntries } from '#cli/repository/tracked.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import { parseGitBlobs, parseTreeEntries, stripIndexStages } from '#cli/parsers/git.ts';

import {
    HEAD_ARGUMENTS,
    BLOBS_ARGUMENTS,
    TREE_ENTRIES_ARGUMENTS,
    SYMBOLIC_HEAD_ARGUMENTS,
} from '#cli/config/repository/revisions.ts';

/**
 * Read complete index or tree entries without Git path quoting. Reject unresolved conflicts.
 * @param repositoryRoot the folder where Git runs.
 * @param source index or commit to inspect.
 * @param cancelSignal stops the command.
 * @returns validated entries.
 */
export async function listRevisionEntries(
    repositoryRoot: string,
    source: Revision,
    cancelSignal?: AbortSignal,
): Promise<GitEntry[]> {
    if (source.kind === 'index') return stripIndexStages(await readIndexEntries(repositoryRoot, cancelSignal));
    const read = await runGitForBytes(repositoryRoot, [...TREE_ENTRIES_ARGUMENTS, source.hash], { cancelSignal });
    if (read.code !== 0)
        throw new GspotError(
            'git',
            `Git could not read the entries of this revision: ${read.stderr.trim()}. Resolve Git errors before checking again.`,
        );
    return parseTreeEntries(read.stdout);
}

/**
 * Read each raw blob once, and visit it before the next blob loads.
 * @param repositoryRoot the folder where Git runs.
 * @param requested full blob object IDs.
 * @param visit reads one validated object.
 * @param cancelSignal stops the command.
 */
export async function visitGitBlobs(
    repositoryRoot: string,
    requested: string[],
    visit: (blobs: AsyncIterable<readonly [string, Buffer]>) => Promise<void>,
    cancelSignal?: AbortSignal,
): Promise<void> {
    const blobs = [...new Set(requested)];
    if (blobs.length === 0) return;
    const result = await runGit(
        repositoryRoot,
        BLOBS_ARGUMENTS,
        {
            stdin: blobs.join('\n') + '\n',
            cancelSignal,
        },
        async (chunks) => {
            await visit(parseGitBlobs(chunks, blobs));
        },
    );
    if (result.code !== 0)
        throw new GspotError('git', `Git could not read the objects of this revision: ${result.stderr.trim()}`);
}

/**
 * Collect the validated blobs for a caller that compares several objects.
 * @param repositoryRoot the folder where Git runs.
 * @param requested full blob object IDs.
 * @param cancelSignal stops the command.
 * @returns validated object bytes.
 */
export async function readBlobs(
    repositoryRoot: string,
    requested: string[],
    cancelSignal?: AbortSignal,
): Promise<Buffer[]> {
    const blobs = new Map<string, Buffer>();
    await visitGitBlobs(
        repositoryRoot,
        requested,
        async (entries) => {
            for await (const [hash, bytes] of entries) blobs.set(hash, bytes);
        },
        cancelSignal,
    );
    return requested.map((hash) => blobs.get(hash) as Buffer);
}

/**
 * Read the current commit, distinguishing an unborn branch from failed Git reads.
 * @param repositoryRoot the folder where Git runs.
 * @param cancelSignal stops the command.
 * @returns current commit hash, or undefined for an unborn branch.
 */
export async function readHead(repositoryRoot: string, cancelSignal?: AbortSignal): Promise<string | undefined> {
    const options = { cancelSignal };
    const head = await runGit(repositoryRoot, HEAD_ARGUMENTS, options);
    if (head.code === 0) return head.stdout.trim();
    const failure = new GspotError('git', 'Cannot read committed Git history. Restore HEAD and check again.');
    if (head.code !== 1) throw failure;
    const symbolic = await runGit(repositoryRoot, SYMBOLIC_HEAD_ARGUMENTS, options);
    if (symbolic.code !== 0) throw failure;
    return undefined;
}

/**
 * Resolve committed entries, distinguishing an unborn branch from failed Git reads.
 * @param repositoryRoot the folder where Git runs.
 * @param cancelSignal stops the command.
 * @returns current commit entries, or an empty list for an unborn branch.
 */
export async function listHeadEntries(repositoryRoot: string, cancelSignal?: AbortSignal): Promise<GitEntry[]> {
    const head = await readHead(repositoryRoot, cancelSignal);
    return head === undefined ? [] : listRevisionEntries(repositoryRoot, { kind: 'commit', hash: head }, cancelSignal);
}
