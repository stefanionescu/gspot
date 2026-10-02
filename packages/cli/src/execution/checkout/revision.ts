import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { decodedText } from '#cli/platform/text.ts';
import { setImmediate } from 'node:timers/promises';
import { GspotError } from '#cli/platform/errors.ts';
import { runGit, runGitBinary } from '#cli/platform/git.ts';
import { openRoot, scratchFolder } from '#cli/platform/filesystem.ts';
import type { Root, ReadCache } from '#cli/types/platform/platform.ts';
import type { GitEntry, Revision } from '#cli/types/execution/checkout.ts';
import { NEWLINE, ENTRY_MODES, WRITE_BATCH } from '#cli/config/execution/checkout.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/platform/platform.ts';
import { copyDependencies, copyValePackages } from '#cli/execution/checkout/installed.ts';

// A frame ends its header line and its blob with a newline each.
const FRAME_NEWLINES = 2;

const entryReads = new WeakMap<ReadCache, Map<string, Promise<GitEntry[]>>>();

async function gitText(root: string, args: string[], cancelSignal?: AbortSignal, stdin?: string): Promise<string> {
    const result = await runGit(root, [...args], {
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
        ...(stdin === undefined ? {} : { stdin }),
    });
    if (result.code !== 0)
        throw new GspotError('selection', [
            `Cannot prepare the revision snapshot: git ${args.join(' ')} failed. ${result.stderr.trim()}`,
        ]);
    return result.stdout;
}

// Writes one tracked entry into the snapshot: a directory for a gitlink, otherwise the blob with its mode.
function writeEntry(files: Root, entry: GitEntry, objects: Map<string, Buffer>): void {
    if (entry.mode === '160000') {
        files.mkdir(entry.path, EXECUTABLE_FILE);
        return;
    }
    const bytes = objects.get(entry.hash);
    if (bytes === undefined) throw new GspotError('selection', ['A requested Git blob was not returned.']);
    const mode = ENTRY_MODES[entry.mode] ?? OWNER_WRITABLE_FILE;
    const content = entry.mode === '120000' ? { bytes, mode, isLink: true as const } : { bytes, mode };
    files.write(entry.path, content, undefined);
}

async function populateRevision(
    revisionRoot: string,
    entries: GitEntry[],
    objects: Map<string, Buffer>,
    cancelSignal?: AbortSignal,
): Promise<void> {
    const files = openRoot(revisionRoot, 'native');
    // Write links last so a tracked link can never redirect another tracked write.
    const ordered = [
        ...entries.filter((entry) => entry.mode !== '120000'),
        ...entries.filter((entry) => entry.mode === '120000'),
    ];
    try {
        for (const [index, entry] of ordered.entries()) {
            if (index % WRITE_BATCH === 0) {
                await setImmediate();
                cancelSignal?.throwIfAborted();
            }
            writeEntry(files, entry, objects);
        }
    } finally {
        files.close();
    }
}

function parseFrame(output: Buffer, cursor: number, gitHash: string): { end: number; size: number } {
    const end = output.indexOf(NEWLINE, cursor);
    const header = output.subarray(cursor, end).toString('ascii');
    const match = /^([a-f0-9]{40}|[a-f0-9]{64}) blob (\d+)$/u.exec(header);
    const size = Number(match?.[2]);
    if (
        end < cursor ||
        match?.[1] !== gitHash ||
        !Number.isSafeInteger(size) ||
        end + size + 1 >= output.length ||
        output[end + size + 1] !== NEWLINE
    )
        throw new GspotError('selection', ['The Git object stream is incomplete or invalid.']);
    return { end, size };
}

function parseEntry(line: string, kind: Revision['kind']): GitEntry {
    const pattern =
        kind === 'index'
            ? /^(100644|100755|120000|160000) ([a-f0-9]{40}|[a-f0-9]{64}) 0\t([\s\S]+)$/u
            : /^(100644|100755|120000|160000) (?:blob|commit) ([a-f0-9]{40}|[a-f0-9]{64})\t([\s\S]+)$/u;
    const [, mode = '', gitHash = '', path = ''] = pattern.exec(line) ?? [];
    if ([mode, gitHash, path].includes(''))
        throw new GspotError('selection', [
            'The Git entry is unsupported or conflicted. Resolve index conflicts before checking staged content.',
        ]);
    return { mode, hash: gitHash, path };
}

/**
 * Read complete index or tree entries without Git path quoting. Reject unresolved conflicts.
 * @param root repository directory
 * @param source index or commit to inspect
 * @param cancelSignal command cancellation
 * @returns validated entries
 */
async function getEntries(root: string, source: Revision, cancelSignal?: AbortSignal): Promise<GitEntry[]> {
    const argv = source.kind === 'index' ? ['ls-files', '--stage', '-z'] : ['ls-tree', '-r', '-z', source.hash];
    const read = await runGitBinary(root, argv, { ...(cancelSignal === undefined ? {} : { cancelSignal }) });
    if (read.code !== 0)
        throw new GspotError('selection', [
            'Cannot read the Git index. Resolve Git errors before checking staged content.',
        ]);
    const text = decodedText(read.stdout);
    if (text === undefined) throw new GspotError('selection', ['Revision paths must be valid UTF-8.']);
    if (text !== '' && !text.endsWith('\0')) throw new GspotError('selection', ['The Git entry stream is incomplete.']);
    return text
        .split('\0')
        .filter(Boolean)
        .map((line) => parseEntry(line, source.kind));
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
    if (objects.some((gitHash) => !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(gitHash)))
        throw new GspotError('selection', ['Git blob requests require full object IDs.']);
    const result = await runGitBinary(root, ['cat-file', '--batch'], {
        stdin: objects.join('\n') + '\n',
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (result.code !== 0)
        throw new GspotError('selection', [
            'Cannot read Git objects. Restore missing objects or resolve cancellation before checking.',
        ]);
    const output = Buffer.from(result.stdout);
    const blobs = new Map<string, Buffer>();
    let cursor = 0;
    for (const gitHash of objects) {
        const { end, size } = parseFrame(output, cursor, gitHash);
        blobs.set(gitHash, output.subarray(end + 1, end + size + 1));
        cursor = end + size + FRAME_NEWLINES;
    }
    if (cursor !== output.length)
        throw new GspotError('selection', ['The Git object stream contains unexpected data.']);
    return blobs;
}

/**
 * Share an immutable Git entry read between checks in the same run.
 * @param root repository directory
 * @param source index or full commit object to inspect
 * @param cancelSignal command cancellation
 * @param reads optional run-owned reads, absent during snapshot preparation
 * @returns validated index or tree entries
 */
export function getCachedEntries(
    root: string,
    source: Revision,
    cancelSignal?: AbortSignal,
    reads?: ReadCache,
): Promise<GitEntry[]> {
    if (reads === undefined) return getEntries(root, source, cancelSignal);
    let entries = entryReads.get(reads);
    if (entries === undefined) {
        entries = new Map();
        entryReads.set(reads, entries);
    }
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
    const options = { cwd: root, timeoutMs: 30_000, ...(cancelSignal === undefined ? {} : { cancelSignal }) };
    const head = await runGit(options.cwd, ['rev-parse', '--verify', '--quiet', 'HEAD'], options);
    if (head.code === 0) return getCachedEntries(root, { kind: 'commit', hash: head.stdout.trim() }, cancelSignal);
    const failure = new GspotError('selection', [
        'Cannot read committed Git history. Restore HEAD before checking migrations.',
    ]);
    if (head.code !== 1) throw failure;
    const symbolic = await runGit(options.cwd, ['symbolic-ref', '--quiet', 'HEAD'], options);
    if (symbolic.code !== 0) throw failure;
    const refs = await runGit(
        options.cwd,
        ['for-each-ref', '--format=%(refname)', '--', symbolic.stdout.trim()],
        options,
    );
    if (refs.code === 0 && refs.stdout.trim() === '' && refs.stderr.trim() === '') return [];
    throw failure;
}

/**
 * Materialize revision objects without checkout filters, stashing, or working-tree writes.
 * @param root repository directory
 * @param source selected revision
 * @param action operation using the disposable snapshot
 * @param cancelSignal command cancellation
 * @returns the operation result
 */
export async function checkOutRevision<Result>(
    root: string,
    source: Revision,
    action: (revisionRoot: string, tree: string) => Promise<Result>,
    cancelSignal?: AbortSignal,
): Promise<Result> {
    const printedRoot = await gitText(root, ['rev-parse', '--show-toplevel'], cancelSignal);
    const gitRoot = printedRoot.replace(/\n$/u, '');
    const directory = relative(realpathSync(gitRoot), realpathSync(root));
    const entries = await getCachedEntries(gitRoot, source, cancelSignal);
    const index = entries.map((entry) => `${entry.mode} ${entry.hash} 0\t${entry.path}\0`).join('');
    using revisionRootFolder = scratchFolder('gspot-revision-');
    const revisionRoot = revisionRootFolder.path;
    await gitText(
        gitRoot,
        ['clone', '--shared', '--no-checkout', '--quiet', '--', gitRoot, revisionRoot],
        cancelSignal,
    );
    // The clone's object store is shared read-only; its index and working tree belong to the snapshot.
    if (source.kind === 'commit')
        await gitText(revisionRoot, ['update-ref', '--no-deref', 'HEAD', source.hash], cancelSignal);
    await gitText(revisionRoot, ['read-tree', '--empty'], cancelSignal);
    await gitText(revisionRoot, ['update-index', '-z', '--index-info'], cancelSignal, index);
    const tree = await gitText(revisionRoot, ['write-tree'], cancelSignal);
    const objects = await getBlobs(
        revisionRoot,
        entries.filter((entry) => entry.mode !== '160000').map((entry) => entry.hash),
        cancelSignal,
    );
    await populateRevision(revisionRoot, entries, objects, cancelSignal);
    copyValePackages(
        gitRoot,
        revisionRoot,
        entries.map((entry) => entry.path),
    );
    await copyDependencies(gitRoot, revisionRoot, entries, cancelSignal);
    await setImmediate();
    cancelSignal?.throwIfAborted();
    return await action(join(revisionRoot, directory), tree.trim());
}
