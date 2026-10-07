// Write Git revision content without replacing authored working-tree files.
import { join, relative } from 'node:path';
import { gitText } from '#cli/platform/git.ts';
import { setImmediate } from 'node:timers/promises';
import { GspotError } from '#cli/platform/errors.ts';
import { copyInto } from '#cli/execution/copy/files.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { nativeSegments } from '#cli/platform/root/rules.ts';
import { DIRECTORY_MODE } from '#cli/config/platform/modes.ts';
import type { ScratchFile } from '#cli/types/execution/copy.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import { chmodSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { GITLINK_MODE, SYMLINK_MODE } from '#cli/config/repository/revisions.ts';
import { getEntries, visitGitBlobs } from '#cli/repository/revisions/objects.ts';
import { copyValePackages, revisionDependencies } from '#cli/execution/copy/dependencies.ts';

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
    root: string,
    checkout: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<void> {
    const collision = caseCollision(entries);
    const upper = checkout.toUpperCase();
    if (collision !== undefined && upper !== checkout && existsSync(upper))
        throw new GspotError('selection', [
            `Git holds ${collision[0]} and ${collision[1]}, which differ only by letter case, and this file system keeps one of them. Rename or remove one with git mv or git rm --cached, then check again.`,
        ]);
    for (const entry of entries.filter((file) => file.mode === GITLINK_MODE)) {
        const target = join(checkout, ...nativeSegments(entry.path));
        mkdirSync(target, { recursive: true, mode: DIRECTORY_MODE });
        chmodSync(target, DIRECTORY_MODE);
    }
    // Write links last so no authored link can redirect another tracked write.
    for (const linked of [false, true]) {
        const selected = Map.groupBy(
            entries.flatMap((entry) =>
                entry.mode === GITLINK_MODE || (entry.mode === SYMLINK_MODE) !== linked
                    ? []
                    : [{ ...entry, mode: entry.mode }],
            ),
            (entry) => entry.hash,
        );
        await visitGitBlobs(
            checkout,
            [...selected.keys()],
            async (blobs) => {
                async function* files(): AsyncGenerator<ScratchFile> {
                    for await (const [hash, bytes] of blobs) {
                        for (const entry of selected.get(hash) ?? []) yield { entry, bytes };
                    }
                }
                await copyInto({ root, target: checkout, files: files(), dependencies: [], cancelSignal });
            },
            cancelSignal,
        );
    }
}

/**
 * Write Git revision content without checkout filters, stashing, or working-tree writes.
 * @param root repository directory
 * @param source selected revision
 * @param action operation using the disposable copy
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
    // The clone's object store is shared read-only; its index and working tree belong to the copy.
    if (source.kind === 'commit')
        await gitText(checkout, ['update-ref', '--no-deref', 'HEAD', source.hash], { cancelSignal });
    await gitText(checkout, ['read-tree', '--empty'], { cancelSignal });
    await gitText(checkout, ['update-index', '-z', '--index-info'], { cancelSignal, stdin: index });
    const tree = await gitText(checkout, ['write-tree'], { cancelSignal });
    await populateRevision(toplevel, checkout, entries, cancelSignal);
    copyValePackages(
        toplevel,
        checkout,
        entries.map((entry) => entry.path),
    );
    const dependencies = await revisionDependencies(toplevel, checkout, entries, cancelSignal);
    await copyInto({ root: toplevel, target: checkout, files: [], dependencies, cancelSignal });
    await setImmediate();
    cancelSignal?.throwIfAborted();
    return await action(join(checkout, directory), tree.trim());
}
