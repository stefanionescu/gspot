import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { run, runBinary } from '#cli/platform/spawn.ts';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { SelectionError } from '#cli/configurations/select.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { SourceObservations } from '#cli/repository/tracked.ts';
import { copyDependencies, copyProsePackages } from '#cli/repository/snapshot-dependencies.ts';

const entryObservations = new WeakMap<SourceObservations, Map<string, Promise<GitEntry[]>>>();

const MATERIALIZATION_BATCH_SIZE = 64;
const NEWLINE = 10;
const EXECUTABLE_MODE = 0o755;
const FILE_MODE = 0o644;
const LINK_MODE = 0o777;
const ENTRY_MODES: Record<string, number> = { '100644': FILE_MODE, '100755': EXECUTABLE_MODE, '120000': LINK_MODE };
async function gitOutput(root: string, args: string[], cancelSignal?: AbortSignal, stdin?: string): Promise<string> {
    const result = await run(['git', ...args], {
        cwd: root,
        timeoutMs: 30_000,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
        ...(stdin === undefined ? {} : { stdin }),
    });
    if (result.code !== 0)
        throw new SelectionError([
            `Cannot prepare the revision snapshot: git ${args.join(' ')} failed. ${result.stderr.trim()}`,
        ]);
    return result.stdout;
}

async function materialize(
    snapshot: string,
    entries: GitEntry[],
    objects: Map<string, Buffer>,
    cancelSignal?: AbortSignal,
): Promise<void> {
    const confined = openConfinedRoot(snapshot, 'native');
    // Write links last so a tracked link can never redirect another tracked write.
    const ordered = [
        ...entries.filter((entry) => entry.mode !== '120000'),
        ...entries.filter((entry) => entry.mode === '120000'),
    ];
    try {
        for (const [index, entry] of ordered.entries()) {
            if (index % MATERIALIZATION_BATCH_SIZE === 0) {
                await Bun.sleep(0);
                cancelSignal?.throwIfAborted();
            }
            if (entry.mode === '160000') {
                confined.mkdir(entry.path, EXECUTABLE_MODE);
                continue;
            }
            const bytes = objects.get(entry.object);
            if (bytes === undefined) throw new SelectionError(['A requested Git blob was not returned.']);
            const isLink = entry.mode === '120000';
            const mode = ENTRY_MODES[entry.mode] ?? FILE_MODE;
            const content = isLink ? { bytes, mode, isLink: true as const } : { bytes, mode };
            confined.write(entry.path, content, undefined);
        }
    } finally {
        confined.close();
    }
}

function blobFrame(output: Buffer, cursor: number, object: string): { end: number; size: number } {
    const end = output.indexOf(NEWLINE, cursor);
    const header = output.subarray(cursor, end).toString('ascii');
    const match = /^([a-f0-9]{40}|[a-f0-9]{64}) blob (\d+)$/u.exec(header);
    const size = Number(match?.[2]);
    if (
        end < cursor ||
        match?.[1] !== object ||
        !Number.isSafeInteger(size) ||
        end + size + 1 >= output.length ||
        output[end + size + 1] !== NEWLINE
    )
        throw new SelectionError(['The Git object stream is incomplete or invalid.']);
    return { end, size };
}

function parseEntry(line: string, kind: SnapshotSource['kind']): GitEntry {
    const pattern =
        kind === 'index'
            ? /^(100644|100755|120000|160000) ([a-f0-9]{40}|[a-f0-9]{64}) 0\t([\s\S]+)$/u
            : /^(100644|100755|120000|160000) (?:blob|commit) ([a-f0-9]{40}|[a-f0-9]{64})\t([\s\S]+)$/u;
    const [, mode = '', object = '', path = ''] = pattern.exec(line) ?? [];
    if ([mode, object, path].includes(''))
        throw new SelectionError([
            'The Git entry is unsupported or conflicted. Resolve index conflicts before checking staged content.',
        ]);
    return { mode, object, path };
}

/**
 * Read raw blob bytes once, validating framing and every returned identity.
 * @param root repository directory
 * @param requested full blob object IDs
 * @param cancelSignal command cancellation
 * @returns validated object bytes
 */
export async function gitBlobs(
    root: string,
    requested: string[],
    cancelSignal?: AbortSignal,
): Promise<Map<string, Buffer>> {
    const objects = [...new Set(requested)];
    if (objects.length === 0) return new Map();
    if (objects.some((object) => !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(object)))
        throw new SelectionError(['Git blob requests require full object IDs.']);
    const result = await runBinary(['git', 'cat-file', '--batch'], {
        cwd: root,
        stdin: objects.join('\n') + '\n',
        timeoutMs: 30_000,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (result.code !== 0)
        throw new SelectionError([
            'Cannot read Git objects. Restore missing objects or resolve cancellation before checking.',
        ]);
    const output = Buffer.from(result.stdout);
    const blobs = new Map<string, Buffer>();
    let cursor = 0;
    for (const object of objects) {
        const { end, size } = blobFrame(output, cursor, object);
        blobs.set(object, output.subarray(end + 1, end + size + 1));
        cursor = end + size + 2;
    }
    if (cursor !== output.length) throw new SelectionError(['The Git object stream contains unexpected data.']);
    return blobs;
}

/**
 * Read complete index or tree entries without Git path quoting. Reject unresolved conflicts.
 * @param root repository directory
 * @param source index or commit to inspect
 * @param cancelSignal command cancellation
 * @returns validated entries
 */
async function readEntries(root: string, source: SnapshotSource, cancelSignal?: AbortSignal): Promise<GitEntry[]> {
    const command =
        source.kind === 'index' ? ['git', 'ls-files', '--stage', '-z'] : ['git', 'ls-tree', '-r', '-z', source.object];
    const observed = await runBinary(command, {
        cwd: root,
        timeoutMs: 30_000,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (observed.code !== 0)
        throw new SelectionError(['Cannot read the Git index. Resolve Git errors before checking staged content.']);
    const bytes = Buffer.from(observed.stdout);
    const text = bytes.toString('utf8');
    if (!Buffer.from(text).equals(bytes)) throw new SelectionError(['Revision paths must be valid UTF-8.']);
    if (text !== '' && !text.endsWith('\0')) throw new SelectionError(['The Git entry stream is incomplete.']);
    return text
        .split('\0')
        .filter(Boolean)
        .map((line) => parseEntry(line, source.kind));
}

/**
 * Share an immutable Git entry observation between checks in the same run.
 * @param root repository directory
 * @param source index or full commit object to inspect
 * @param cancelSignal command cancellation
 * @param observations optional run-owned observations, absent during snapshot preparation
 * @returns validated index or tree entries
 */
export function gitEntries(
    root: string,
    source: SnapshotSource,
    cancelSignal?: AbortSignal,
    observations?: SourceObservations,
): Promise<GitEntry[]> {
    if (observations === undefined) return readEntries(root, source, cancelSignal);
    let entries = entryObservations.get(observations);
    if (entries === undefined) {
        entries = new Map();
        entryObservations.set(observations, entries);
    }
    const key = JSON.stringify([root, source]);
    let observed = entries.get(key);
    if (observed === undefined) {
        observed = readEntries(root, source, cancelSignal);
        entries.set(key, observed);
    }
    return observed;
}

/**
 * Resolve committed entries, distinguishing an unborn branch from failed Git reads.
 * @param root repository directory
 * @param cancelSignal command cancellation
 * @returns HEAD entries, or an empty list for an unborn branch
 */
export async function committedEntries(root: string, cancelSignal?: AbortSignal): Promise<GitEntry[]> {
    const options = { cwd: root, timeoutMs: 30_000, ...(cancelSignal === undefined ? {} : { cancelSignal }) };
    const head = await run(['git', 'rev-parse', '--verify', '--quiet', 'HEAD'], options);
    if (head.code === 0) return gitEntries(root, { kind: 'commit', object: head.stdout.trim() }, cancelSignal);
    const failure = new SelectionError(['Cannot read committed Git history. Restore HEAD before checking migrations.']);
    if (head.code !== 1) throw failure;
    const symbolic = await run(['git', 'symbolic-ref', '--quiet', 'HEAD'], options);
    if (symbolic.code !== 0) throw failure;
    const refs = await run(['git', 'for-each-ref', '--format=%(refname)', '--', symbolic.stdout.trim()], options);
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
export async function withRevisionSnapshot<Result>(
    root: string,
    source: SnapshotSource,
    action: (snapshot: string, tree: string) => Promise<Result>,
    cancelSignal?: AbortSignal,
): Promise<Result> {
    const gitRoot = (await gitOutput(root, ['rev-parse', '--show-toplevel'], cancelSignal)).replace(/\n$/u, '');
    const directory = relative(realpathSync(gitRoot), realpathSync(root));
    const entries = await gitEntries(gitRoot, source, cancelSignal);
    const index = entries.map((entry) => `${entry.mode} ${entry.object} 0\t${entry.path}\0`).join('');
    const snapshot = realpathSync(mkdtempSync(join(tmpdir(), 'gspot-revision-')));
    try {
        await gitOutput(
            gitRoot,
            ['clone', '--shared', '--no-checkout', '--quiet', '--', gitRoot, snapshot],
            cancelSignal,
        );
        // The clone's object store is shared read-only; its index and working tree belong to the snapshot.
        if (source.kind === 'commit')
            await gitOutput(snapshot, ['update-ref', '--no-deref', 'HEAD', source.object], cancelSignal);
        await gitOutput(snapshot, ['read-tree', '--empty'], cancelSignal);
        await gitOutput(snapshot, ['update-index', '-z', '--index-info'], cancelSignal, index);
        const tree = await gitOutput(snapshot, ['write-tree'], cancelSignal);
        const objects = await gitBlobs(
            snapshot,
            entries.filter((entry) => entry.mode !== '160000').map((entry) => entry.object),
            cancelSignal,
        );
        await materialize(snapshot, entries, objects, cancelSignal);
        copyProsePackages(
            gitRoot,
            snapshot,
            entries.map((entry) => entry.path),
        );
        await copyDependencies(
            gitRoot,
            snapshot,
            entries.map((entry) => entry.path),
            cancelSignal,
        );
        await Bun.sleep(0);
        cancelSignal?.throwIfAborted();
        return await action(join(snapshot, directory), tree.trim());
    } finally {
        rmSync(snapshot, { recursive: true, force: true });
    }
}

export type SnapshotSource = { kind: 'index' } | { kind: 'commit'; object: string };

export type PushRevision = {
    object: string;
    tree: string;
    refs: string[];
    commits: string[];
    historyComplete: boolean;
    paths?: string[];
};

export type PushSelection = {
    revisions: PushRevision[];
    notApplicable: { ref: string; object: string; reason: 'deleted ref' | 'non-commit object' }[];
};

export type GitEntry = { mode: string; object: string; path: string };
