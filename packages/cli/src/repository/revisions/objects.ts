// Read immutable Git entries and objects for revision copies and checks.
import { GspotError } from '#cli/platform/errors.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { HASH_PATTERN } from '#cli/config/parsers/git.ts';
import { readIndexEntries } from '#cli/repository/tracked.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import { runGit, streamGit, runGitBinary } from '#cli/platform/git.ts';
import { parseGitBlobs, parseGitEntries, parseIndexRevision } from '#cli/parsers/git.ts';

/**
 * Read complete index or tree entries without Git path quoting. Reject unresolved conflicts.
 * @param root repository directory
 * @param source index or commit to inspect
 * @param cancelSignal command cancellation
 * @returns validated entries
 */
export async function getEntries(root: string, source: Revision, cancelSignal?: AbortSignal): Promise<GitEntry[]> {
    if (source.kind === 'index') return parseIndexRevision(await readIndexEntries(root, cancelSignal));
    const read = await runGitBinary(root, ['ls-tree', '-r', '-z', source.hash], { cancelSignal });
    if (read.code !== 0)
        throw new GspotError('selection', [
            `Git could not read the entries of this revision: ${Buffer.from(read.stderr).toString('utf8').trim()}. Resolve Git errors before checking again.`,
        ]);
    return parseGitEntries(read.stdout, source.kind);
}

/**
 * Read raw blobs once, visiting each before the next blob is allocated.
 * @param root repository directory
 * @param requested full blob object IDs
 * @param visit the consumer of one validated object
 * @param cancelSignal command cancellation
 */
export async function visitGitBlobs(
    root: string,
    requested: string[],
    visit: (blobs: AsyncIterable<readonly [string, Buffer]>) => Promise<void>,
    cancelSignal?: AbortSignal,
): Promise<void> {
    const objects = [...new Set(requested)];
    if (objects.length === 0) return;
    if (objects.some((hash) => !HASH_PATTERN.test(hash)))
        throw new GspotError('selection', ['Git blob requests require full object IDs.']);
    const result = await streamGit(
        root,
        ['cat-file', '--batch'],
        async (chunks) => {
            await visit(parseGitBlobs(chunks, objects));
        },
        { stdin: objects.join('\n') + '\n', cancelSignal },
    );
    if (result.code !== 0)
        throw new GspotError('selection', [`Git could not read the objects of this revision: ${result.stderr.trim()}`]);
}

/**
 * Collect the validated blobs required by a consumer that compares multiple objects.
 * @param root repository directory
 * @param requested full blob object IDs
 * @param cancelSignal command cancellation
 * @returns validated object bytes
 */
export async function getBlobs(
    root: string,
    requested: string[],
    cancelSignal?: AbortSignal,
): Promise<Map<string, Buffer>> {
    const blobs = new Map<string, Buffer>();
    await visitGitBlobs(
        root,
        requested,
        async (objects) => {
            for await (const [hash, bytes] of objects) blobs.set(hash, bytes);
        },
        cancelSignal,
    );
    return blobs;
}

/**
 * Resolve committed entries, distinguishing an unborn branch from failed Git reads.
 * @param root repository directory
 * @param cancelSignal command cancellation
 * @returns HEAD entries, or an empty list for an unborn branch
 */
export async function getHeadEntries(root: string, cancelSignal?: AbortSignal): Promise<GitEntry[]> {
    const options = { cancelSignal };
    const head = await runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD'], options);
    if (head.code === 0) return getEntries(root, { kind: 'commit', hash: head.stdout.trim() }, cancelSignal);
    const failure = new GspotError('selection', ['Cannot read committed Git history. Restore HEAD and check again.']);
    if (head.code !== 1) throw failure;
    const symbolic = await runGit(root, ['symbolic-ref', '--quiet', 'HEAD'], options);
    if (symbolic.code !== 0) throw failure;
    const refs = await runGit(root, ['for-each-ref', '--format=%(refname)', '--', symbolic.stdout.trim()], options);
    if (refs.code === 0 && refs.stdout.trim() === '' && refs.stderr.trim() === '') return [];
    throw failure;
}
