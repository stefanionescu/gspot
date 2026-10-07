// Read immutable Git entries and objects for revision copies and checks.
import { memo } from '#cli/platform/memo.ts';
import { GspotError } from '#cli/platform/errors.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { HASH_PATTERN } from '#cli/config/parsers/git.ts';
import { runGit, runGitBinary } from '#cli/platform/git.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import { parseGitBlobs, parseGitEntries } from '#cli/parsers/git.ts';

const ENTRY_MEMO = { create: () => new Map<string, Promise<GitEntry[]>>() };

/**
 * Read complete index or tree entries without Git path quoting. Reject unresolved conflicts.
 * @param root repository directory
 * @param source index or commit to inspect
 * @param cancelSignal command cancellation
 * @returns validated entries
 */
export async function getEntries(root: string, source: Revision, cancelSignal?: AbortSignal): Promise<GitEntry[]> {
    const argv = source.kind === 'index' ? ['ls-files', '--stage', '-z'] : ['ls-tree', '-r', '-z', source.hash];
    const read = await runGitBinary(root, argv, { cancelSignal });
    if (read.code !== 0)
        throw new GspotError('selection', [
            `Git could not read the entries of this revision: ${Buffer.from(read.stderr).toString('utf8').trim()}. Resolve Git errors before checking again.`,
        ]);
    return parseGitEntries(read.stdout, source.kind);
}

/**
 * Read raw blob bytes once. Validate framing and every returned identity.
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
    const objects = [...new Set(requested)];
    if (objects.length === 0) return new Map();
    if (objects.some((hash) => !HASH_PATTERN.test(hash)))
        throw new GspotError('selection', ['Git blob requests require full object IDs.']);
    const result = await runGitBinary(root, ['cat-file', '--batch'], {
        stdin: objects.join('\n') + '\n',
        cancelSignal,
    });
    if (result.code !== 0)
        throw new GspotError('selection', [
            `Git could not read the objects of this revision: ${Buffer.from(result.stderr).toString('utf8').trim()}`,
        ]);
    return parseGitBlobs(Buffer.from(result.stdout), objects);
}

/**
 * Share an immutable Git entry read between checks in the same run.
 * @param root repository directory
 * @param source index or full commit object to inspect
 * @param reads the run-owned cache
 * @param cancelSignal command cancellation
 * @returns validated index or tree entries
 */
export function getCachedEntries(
    root: string,
    source: Revision,
    reads: ReadCache,
    cancelSignal?: AbortSignal,
): Promise<GitEntry[]> {
    const entries = memo(reads, ENTRY_MEMO);
    const key = JSON.stringify([root, source]);
    let read = entries.get(key);
    if (read === undefined) {
        read = getEntries(root, source, cancelSignal);
        entries.set(key, read);
    }
    return read;
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
