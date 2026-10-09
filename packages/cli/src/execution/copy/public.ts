import { memo } from '#cli/platform/memo.ts';
import { setImmediate } from 'node:timers/promises';
import { toPosix } from '#cli/platform/contracts.ts';
import { GspotError } from '#cli/platform/public.ts';
import { gitText } from '#cli/platform/git/public.ts';
import { openRoot } from '#cli/platform/root/public.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { writeLink } from '#cli/platform/root/writes.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { isInScope } from '#cli/repository/paths/public.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { readPackageManifest } from '#cli/repository/contracts.ts';
import type { Revision } from '#cli/types/repository/revisions.ts';
import type { ScratchFolder } from '#cli/types/platform/scratch.ts';
import { join, posix, dirname, basename, relative } from 'node:path';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { packageWorkspaces } from '#cli/repository/paths/contracts.ts';
import { fileMode, nativeSegments } from '#cli/platform/root/contracts.ts';
import { DIRECTORY_MODE, PERMISSION_BITS } from '#cli/config/platform/modes.ts';
import { getEntries, visitGitBlobs } from '#cli/repository/revisions/public.ts';
import { projectSources, getTsconfigProject } from '#cli/parsers/packages/public.ts';
import { ENTRY_MODES, GITLINK_MODE, SYMLINK_MODE } from '#cli/config/repository/revisions.ts';
import { copyDependencies, copyValePackages, revisionDependencies } from '#cli/execution/copy/contracts.ts';
import type { ScratchCopy, ScratchFile, ScratchSource, DependencyCopy } from '#cli/types/execution/copy.ts';
import { WRITE_BATCH, SCRATCH_EXTRAS, PACKAGE_MANIFESTS, SCRATCH_DIRECTORIES } from '#cli/config/execution/copy.ts';

import {
    statSync,
    chmodSync,
    constants,
    mkdirSync,
    existsSync,
    copyFileSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';

// All scratch destinations share native writes; authored source reads retain the repository boundary.
function writeScratchFile(files: Root, scratch: string, file: ScratchFile): void {
    const target = join(scratch, ...nativeSegments(typeof file === 'string' ? file : file.entry.path));
    mkdirSync(dirname(target), { recursive: true });
    if (typeof file === 'string') {
        const source = files.realPath(file);
        copyFileSync(source, target, constants.COPYFILE_FICLONE);
        chmodSync(target, statSync(source).mode & PERMISSION_BITS);
        return;
    }
    const mode = fileMode({ mode: ENTRY_MODES[file.entry.mode] });
    if (file.entry.mode === SYMLINK_MODE) writeLink(target, file.bytes, mode);
    else {
        writeFileSync(target, file.bytes, { flag: 'wx', mode });
        chmodSync(target, mode);
    }
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

const WORKSPACE_SOURCE_MEMO = { create: () => new Map<string, string[]>() };

/**
 * Copy files, Git blobs, and installed dependencies into an owned scratch root.
 * @param input source root, destination, and files
 */
export async function copyInto(input: ScratchCopy): Promise<void> {
    using files = openRoot(input.root, 'native');
    let written = 0;
    for await (const file of input.files) {
        if (written % WRITE_BATCH === 0) await setImmediate();
        written += 1;
        input.cancelSignal?.throwIfAborted();
        const path = typeof file === 'string' ? file : file.entry.path;
        if (!input.dependencies.some((dependency) => isInScope(path, dependency.path)))
            writeScratchFile(files, input.target, file);
    }
    await copyDependencies(input);
}

/**
 * Own a scratch folder containing only the supplied files and dependency trees.
 * @param input exact source paths and dependency operations
 * @returns the private folder and its disposal
 */
export function copyIntoScratch(input: ScratchSource): Promise<ScratchFolder>;

export function copyIntoScratch(input: CheckInput, extra?: string[]): Promise<ScratchFolder>;

export async function copyIntoScratch(input: ScratchSource | CheckInput, extra: string[] = []): Promise<ScratchFolder> {
    const source =
        'paths' in input
            ? input
            : {
                  ...projectCopyInputs(
                      input.root,
                      [...input.files.map((file) => file.path), ...input.dependencyFiles(), ...extra],
                      input.scopeEntries.map((scope) => scope.path),
                  ),
                  cancelSignal: input.cancelSignal,
              };
    const folder = scratchFolder('gspot-fix-');
    try {
        await copyInto({ ...source, target: folder.path, files: new Set(source.paths) });
        return folder;
    } catch (error) {
        folder[Symbol.dispose]();
        throw error;
    }
}

/**
 * Select scope dependencies and existing configuration extras for a working-tree project copy.
 * @param root the source repository
 * @param paths selected authored files
 * @param scopes the scope paths owning installed dependencies
 * @returns exact paths and cloned dependency trees
 */
export function projectCopyInputs(root: string, paths: string[], scopes: string[]): ScratchSource {
    const projects = paths.flatMap((path) =>
        PACKAGE_MANIFESTS.includes(posix.basename(path)) && posix.basename(posix.dirname(path)) !== DOT_GSPOT
            ? [posix.dirname(path)]
            : [],
    );
    const dependencies = [
        ...new Set(
            [...scopes, ...projects].flatMap((project) => SCRATCH_DIRECTORIES.map((name) => posix.join(project, name))),
        ),
    ]
        .filter((path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined)
        .map((path): DependencyCopy => ({ path, operation: 'clone' }));
    return {
        root,
        paths: [...new Set([...paths, ...SCRATCH_EXTRAS])].filter(
            (path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined,
        ),
        dependencies,
    };
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

/**
 * Select declared workspace sources from this run's repository inventory.
 * @param root the source root
 * @param scope the owning project
 * @param files the source inventory
 * @param reads the metadata cache
 * @returns workspace dependency paths
 */
export function workspaceSourceFiles(root: string, scope: string, files: TrackedFile[], reads: ReadCache): string[] {
    const cache = memo(reads, WORKSPACE_SOURCE_MEMO);
    const project = files
        .map((file) => file.path)
        .filter(
            (path) => basename(path) === 'package.json' && isInScope(scope, posix.relative('.', posix.dirname(path))),
        )
        .toSorted((left, right) => right.length - left.length)[0];
    if (project === undefined) return [];
    const key = JSON.stringify([root, project]);
    const held = cache.get(key);
    if (held !== undefined) return held;
    const projectFolder = posix.relative('.', posix.dirname(project));
    const ordered = [...new Set([projectFolder, ...packageWorkspaces(root)])].toSorted(
        (left, right) => right.length - left.length,
    );
    const packages = new Map(
        ordered.map((path) => [path, readPackageManifest(root, posix.join(path, 'package.json'))]),
    );
    const pending = [projectFolder];
    for (const folder of pending) {
        const manifest = packages.get(folder);
        if (manifest === undefined)
            throw new Error(`Workspace manifest is missing: ${posix.join(folder, 'package.json')}`);
        const names = Object.keys({
            ...manifest.dependencies,
            ...manifest.devDependencies,
            ...manifest.peerDependencies,
            ...manifest.optionalDependencies,
        });
        const project = getTsconfigProject(root, folder, [], reads);
        const sources =
            project === undefined
                ? []
                : projectSources(root, folder, reads, {
                      ...project.config,
                      fileNames: project.config.fileNames.filter((file) =>
                          isInScope(toPosix(relative(root, file)), folder),
                      ),
                  })
                      .map((file) => ordered.find((path) => isInScope(toPosix(relative(root, file.fileName)), path)))
                      .filter((path) => path !== undefined);
        const dependencies = [...packages]
            .filter(([, dependency]) => dependency?.name !== undefined && names.includes(dependency.name))
            .map(([path]) => path);
        pending.push(...[...new Set([...sources, ...dependencies])].filter((path) => !pending.includes(path)));
    }
    const visited = new Set(pending);
    visited.delete(projectFolder);
    const selected = files
        .filter((file) => {
            const owner = ordered.find((entry) => isInScope(file.path, entry));
            return owner !== undefined && visited.has(owner);
        })
        .map((file) => file.path);
    cache.set(key, selected);
    return selected;
}
