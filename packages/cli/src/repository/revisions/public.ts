// Staged and changed paths, unstaged overlap, and the base of an upstream push.

// The revisions a push sends, resolved from the ref and object pairs Git hands the pre-push hook.

import { GspotError } from '#cli/platform/public.ts';
import { HASH_PATTERN } from '#cli/config/parsers/git.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { readIndexEntries } from '#cli/repository/contracts.ts';
import { WORKTREE_DIFF_ARGV } from '#cli/config/repository/revisions.ts';
import { parseGitBlobs, parseGitEntries, parseIndexRevision } from '#cli/parsers/contracts.ts';
import type { Revision, StagedPaths, ChangedPaths, CommitSelection } from '#cli/types/repository/revisions.ts';
import { runGit, gitText, gitLines, gitPaths, isShallow, streamGit, runGitBinary } from '#cli/platform/git/public.ts';

// The remote HEAD symrefs, as pairs of the ref name and the branch it points to.
async function getRemoteHeads(root: string, cancelSignal?: AbortSignal): Promise<[string, string][]> {
    const lines = await gitLines(root, ['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes'], {
        cancelSignal,
    });
    return lines.flatMap((line) => {
        const [name, target] = line.split('\t');
        const isHead = name !== undefined && name.endsWith('/HEAD') && target !== undefined && target !== '';
        return isHead ? [[name, target] as [string, string]] : [];
    });
}

// The upstream or remote default branch, or an empty string when neither exists.
async function getDefaultRef(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const head = await gitText(root, ['rev-parse', '--symbolic-full-name', 'HEAD'], { cancelSignal });
    const upstreamText = await gitText(root, ['for-each-ref', '--format=%(upstream)', '--', head.trim()], {
        cancelSignal,
    });
    const upstream = upstreamText.trim();
    if (upstream !== '') return upstream;
    const heads = await getRemoteHeads(root, cancelSignal);
    const preferred =
        heads.find(([name]) => name === 'refs/remotes/origin/HEAD') ?? (heads.length === 1 ? heads[0] : undefined);
    return preferred?.[1] ?? '';
}

// The merge base of a ref and HEAD, with a note about cut history when the repository is shallow.
async function getMergeBase(root: string, compared: string, cancelSignal?: AbortSignal): Promise<string> {
    const base = await runGit(root, ['merge-base', '--', compared, 'HEAD'], {
        cancelSignal,
    });
    if (base.code === 0) return base.stdout.trim();
    const help = (await isShallow(root, { cancelSignal })) ? ' History is cut; run git fetch --unshallow.' : '';
    throw new GspotError('selection', [`Git merge-base failed for ${compared}: ${base.stderr.trim()}.${help}`]);
}

/**
 * Staged paths include deletions and both sides of renames. Count paths with unstaged changes.
 * @param root the repository root
 * @param cancelSignal cancellation for the Git commands
 * @returns the staged paths, sorted, and the unstaged count
 */
export async function getStaged(root: string, cancelSignal?: AbortSignal): Promise<StagedPaths> {
    const cached = await gitPaths(root, ['diff', '--relative', '--cached', '--name-only', '--no-renames', '-z'], {
        cancelSignal,
    });
    const staged = cached.toSorted((a, b) => a.localeCompare(b));
    const dirty = new Set(await gitPaths(root, WORKTREE_DIFF_ARGV, { cancelSignal }));
    return { staged, unstaged: staged.filter((path) => dirty.has(path)).length };
}

/**
 * Files and commits changed relative to a ref, for the pull-request form.
 * @param root the repository root
 * @param reference the git ref to compare against
 * @param cancelSignal cancellation for the Git commands
 * @returns the selected reference, the sorted paths, and the commits after the merge base, oldest first
 */
export async function getChanged(root: string, reference: string, cancelSignal?: AbortSignal): Promise<ChangedPaths> {
    const compared = reference === '' ? await getDefaultRef(root, cancelSignal) : reference;
    if (compared === '') {
        throw new GspotError('selection', ['No upstream or default branch is available; use --changed --base <ref>.']);
    }
    const merged = await getMergeBase(root, compared, cancelSignal);
    const committed = await gitPaths(root, [...WORKTREE_DIFF_ARGV, merged, '--'], { cancelSignal });
    const working = await gitPaths(root, WORKTREE_DIFF_ARGV, { cancelSignal });
    const commits = await gitLines(root, ['rev-list', '--reverse', `${merged}..HEAD`, '--'], {
        cancelSignal,
    });
    return {
        reference: compared,
        paths: [...new Set([...committed, ...working])].toSorted((a, b) => a.localeCompare(b)),
        commits,
    };
}

/**
 * Compare a push with its upstream or remote default. Without either, start at the root commit.
 * @param root the repository root
 * @param cancelSignal cancellation for the Git commands
 * @returns the commit the pushed range starts after
 */
export async function getPushBase(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const compared = await getDefaultRef(root, cancelSignal);
    if (compared !== '') return getMergeBase(root, compared, cancelSignal);
    const roots = await gitLines(root, ['rev-list', '--max-parents=0', 'HEAD'], { cancelSignal });
    const first = roots.at(-1);
    if (first === undefined || first === '') throw new Error('Git did not return a root commit for HEAD.');
    return first;
}

// Read immutable Git entries and objects for revision copies and checks.

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

/**
 * The supplied pushed commits, or the commits after the native push base.
 * @param root the repository root
 * @param commits the explicit selection when supplied
 * @param cancelSignal cancellation for the Git commands
 * @returns the exact selected commits or the Git selection error
 */
export async function pushedCommits(
    root: string,
    commits: string[] | undefined,
    cancelSignal?: AbortSignal,
): Promise<CommitSelection> {
    if (commits !== undefined) return commits;
    const base = await getPushBase(root, cancelSignal);
    const listed = await runGit(root, ['rev-list', `${base}..HEAD`, '--'], {
        cancelSignal,
    });
    if (listed.code !== 0) return { error: `Cannot select commit messages: ${listed.stderr.trim()}` };
    return listed.stdout.split('\n').filter(Boolean);
}
