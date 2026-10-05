// Materialize Git revision content without replacing authored working-tree files.
import { join, relative } from 'node:path';
import { gitText } from '#cli/platform/git.ts';
import { existsSync, realpathSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { DIRECTORY_MODE } from '#cli/config/platform/modes.ts';
import { WRITE_BATCH } from '#cli/config/execution/snapshot.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import { getBlobs, getEntries } from '#cli/repository/revisions/objects.ts';
import { copyDependencies, copyValePackages } from '#cli/execution/snapshot/installed.ts';
import { ENTRY_MODES, GITLINK_MODE, SYMLINK_MODE } from '#cli/config/repository/revisions.ts';

// Writes one tracked entry into the snapshot: a directory for a gitlink, otherwise the blob with its mode.
function writeEntry(files: Root, entry: GitEntry, objects: Map<string, Buffer>): void {
    if (entry.mode === GITLINK_MODE) {
        files.mkdir(entry.path, DIRECTORY_MODE);
        return;
    }
    const bytes = objects.get(entry.hash);
    if (bytes === undefined) throw new GspotError('selection', ['A requested Git blob was not returned.']);
    const mode = ENTRY_MODES[entry.mode];
    // A tracked link keeps its target, wherever it points, as a Git checkout keeps it.
    if (entry.mode === SYMLINK_MODE) files.link(entry.path, { bytes, mode, isLink: true });
    else files.write(entry.path, { bytes, mode }, undefined);
}

// Two tracked paths that differ only by letter case, or undefined when every path folds to its own spelling.
function caseCollision(entries: GitEntry[]): [string, string] | undefined {
    const seen = new Map<string, string>();
    for (const { path } of entries) {
        const earlier = seen.get(path.toLowerCase());
        if (earlier !== undefined) return [earlier, path];
        seen.set(path.toLowerCase(), path);
    }
    return undefined;
}

async function populateRevision(
    checkout: string,
    entries: GitEntry[],
    objects: Map<string, Buffer>,
    cancelSignal?: AbortSignal,
): Promise<void> {
    const collision = caseCollision(entries);
    // On a file system that folds letter case, the upper-case spelling of the folder names the folder itself.
    const upper = checkout.toUpperCase();
    if (collision !== undefined && upper !== checkout && existsSync(upper))
        throw new GspotError('selection', [
            `Git holds ${collision[0]} and ${collision[1]}, which differ only by letter case, and this file system keeps one of them. Rename or remove one with git mv or git rm --cached, then check again.`,
        ]);
    const files = openRoot(checkout, 'native');
    // Write links last so a tracked link can never redirect another tracked write.
    const ordered = [
        ...entries.filter((entry) => entry.mode !== SYMLINK_MODE),
        ...entries.filter((entry) => entry.mode === SYMLINK_MODE),
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
    action: (checkout: string, tree: string) => Promise<Result>,
    cancelSignal?: AbortSignal,
): Promise<Result> {
    const printed = await gitText(root, ['rev-parse', '--show-toplevel'], { cancelSignal });
    const toplevel = printed.replace(/\n$/u, '');
    const directory = relative(realpathSync(toplevel), realpathSync(root));
    const entries = await getEntries(toplevel, source, cancelSignal);
    const index = entries.map((entry) => `${entry.mode} ${entry.hash} 0\t${entry.path}\0`).join('');
    using checkoutFolder = scratchFolder('gspot-revision-');
    const checkout = checkoutFolder.path;
    await gitText(toplevel, ['clone', '--shared', '--no-checkout', '--quiet', '--', toplevel, checkout], {
        cancelSignal,
    });
    // The clone's object store is shared read-only; its index and working tree belong to the snapshot.
    if (source.kind === 'commit')
        await gitText(checkout, ['update-ref', '--no-deref', 'HEAD', source.hash], { cancelSignal });
    await gitText(checkout, ['read-tree', '--empty'], { cancelSignal });
    await gitText(checkout, ['update-index', '-z', '--index-info'], { cancelSignal, stdin: index });
    const tree = await gitText(checkout, ['write-tree'], { cancelSignal });
    const objects = await getBlobs(
        checkout,
        entries.filter((entry) => entry.mode !== GITLINK_MODE).map((entry) => entry.hash),
        cancelSignal,
    );
    await populateRevision(checkout, entries, objects, cancelSignal);
    copyValePackages(
        toplevel,
        checkout,
        entries.map((entry) => entry.path),
    );
    await copyDependencies(toplevel, checkout, entries, cancelSignal);
    await setImmediate();
    cancelSignal?.throwIfAborted();
    return await action(join(checkout, directory), tree.trim());
}
