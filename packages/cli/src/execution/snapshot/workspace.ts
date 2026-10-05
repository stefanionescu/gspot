// Temporary copies of selected files for commands that must not read the working tree.
import type { Dirent } from 'node:fs';
import { cp, readdir } from 'node:fs/promises';
import { isInside } from '#cli/platform/paths.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { isInScope } from '#cli/repository/selectors.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { PERMISSION_BITS } from '#cli/config/platform/modes.ts';
import { sep, join, posix, dirname, relative } from 'node:path';
import type { ScratchFolder } from '#cli/types/platform/scratch.ts';
import type { TreeCopy, WorktreeCopy, FileWorkspace } from '#cli/types/execution/snapshot.ts';

import {
    CLONE_OPTIONS,
    SCRATCH_EXTRAS,
    PROJECT_MANIFESTS,
    SCRATCH_DIRECTORIES,
} from '#cli/config/execution/snapshot.ts';
import {
    statSync,
    constants,
    mkdirSync,
    unlinkSync,
    symlinkSync,
    readFileSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';

// Copies each selected file that exists, resolving it through the root boundary.
async function copySelected(context: WorktreeCopy, paths: string[], dependencies: string[]): Promise<void> {
    const copied = new Set(
        [...paths, ...SCRATCH_EXTRAS].filter((path) => !dependencies.some((folder) => isInScope(path, folder))),
    );
    for (const path of copied) {
        if (statSync(join(context.root, path), { throwIfNoEntry: false }) === undefined) continue;
        const resolved = context.files.realPath(path);
        mkdirSync(dirname(join(context.scratch, path)), { recursive: true });
        await cp(resolved, join(context.scratch, path), { dereference: true });
    }
}

// Clones each installed dependency folder that exists, and queues it for link repair.
async function copyDependencies(context: WorktreeCopy, dependencies: string[]): Promise<void> {
    for (const folder of dependencies) {
        if (statSync(join(context.root, folder), { throwIfNoEntry: false }) === undefined) continue;
        const source = realpathSync(join(context.root, folder));
        const target = join(context.scratch, folder);
        context.copies.set(source, target);
        await cp(source, target, { ...CLONE_OPTIONS, mode: constants.COPYFILE_FICLONE });
        context.pending.push({ source, target });
    }
}

// Where a path inside a copied tree lives in the scratch copy, or undefined when no copy holds it.
function relocated(copies: Map<string, string>, source: string): string | undefined {
    for (const [original, copied] of [...copies].toSorted(([left], [right]) => right.length - left.length)) {
        const local = relative(original, source);
        if (isInside(local)) return join(copied, local);
    }
    return undefined;
}

// Repairs a directory link inside a copied tree: pointed at the copy of its target, or replaced by a clone of it.
async function relinkDirectory(context: WorktreeCopy, original: string, target: string): Promise<void> {
    const destination = relocated(context.copies, original);
    unlinkSync(target);
    if (destination !== undefined && statSync(destination, { throwIfNoEntry: false }) !== undefined) {
        symlinkSync(relative(dirname(target), destination), target, 'dir');
        return;
    }
    context.copies.set(original, target);
    await cp(original, target, { ...CLONE_OPTIONS, mode: constants.COPYFILE_FICLONE });
    context.pending.push({ source: original, target });
}

// The entries of a folder, links ordered by how deep their targets lie, whatever order the filesystem lists them in.
// A link into a tree that another link of the folder copies is then repaired after that copy, and points at it.
async function outerTargetsFirst(source: string): Promise<Dirent[]> {
    const entries = await readdir(source, { withFileTypes: true });
    const depths = new Map(
        entries.map((entry) => [
            entry,
            entry.isSymbolicLink() && statSync(join(source, entry.name), { throwIfNoEntry: false }) !== undefined
                ? realpathSync(join(source, entry.name)).split(sep).length
                : 0,
        ]),
    );
    return entries.toSorted((left, right) => (depths.get(left) ?? 0) - (depths.get(right) ?? 0));
}

// Handles one entry of a copied tree: folders are queued, file links deferred, directory links repaired now.
async function visitEntry(context: WorktreeCopy, directory: TreeCopy, entry: Dirent): Promise<void> {
    const source = join(directory.source, entry.name);
    const target = join(directory.target, entry.name);
    if (entry.isDirectory()) {
        context.pending.push({ source, target });
        return;
    }
    if (!entry.isSymbolicLink()) return;
    // A link that points at nothing stays as it was copied.
    if (statSync(source, { throwIfNoEntry: false }) === undefined) return;
    const original = realpathSync(source);
    if (statSync(original).isFile()) context.fileLinks.push({ source: original, target });
    else await relinkDirectory(context, original, target);
}

// Repairs every file link once every tree is copied, so its target's copy is known to exist or not.
async function relinkFiles(context: WorktreeCopy): Promise<void> {
    for (const { source, target } of context.fileLinks) {
        const destination = relocated(context.copies, source);
        unlinkSync(target);
        if (destination !== undefined && statSync(destination, { throwIfNoEntry: false }) !== undefined)
            symlinkSync(relative(dirname(target), destination), target, 'file');
        else await cp(source, target);
    }
}

/**
 * Copy the given files into a temporary folder so the tool sees only them and no config files from ancestor folders.
 * @param root the repository root
 * @param paths the files to copy
 * @returns the workspace root, the original bytes by path, and its disposal
 */
export function createFileWorkspace(root: string, paths: string[]): FileWorkspace {
    const folder = scratchFolder('gspot-files-');
    const originals = new Map<string, Buffer>();
    try {
        using files = openRoot(root, 'native');
        for (const path of new Set(paths)) {
            const source = files.realPath(path);
            const bytes = readFileSync(source);
            originals.set(path, bytes);
            const target = join(folder.path, path);
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, bytes, { mode: statSync(source).mode & PERMISSION_BITS });
        }
        return { root: folder.path, originals, [Symbol.dispose]: folder[Symbol.dispose] };
    } catch (error) {
        folder[Symbol.dispose]();
        throw error;
    }
}

/**
 * Copies selected source and configuration files for commands run outside the working tree. Under pnpm and the Bun
 * isolated linker, a workspace member keeps its own dependency folder. Every project among the paths brings that
 * folder, whether or not it is a scope.
 * @param root the repository root
 * @param paths the source paths relative to the repository root
 * @param scopePaths the scopes whose installed dependencies the command needs
 * @returns the temporary folder, which the caller disposes
 */
export async function scratchCopy(root: string, paths: string[], scopePaths: string[]): Promise<ScratchFolder> {
    const folder = scratchFolder('gspot-fix-');
    const scratch = folder.path;
    using files = openRoot(root, 'native');
    const context: WorktreeCopy = {
        root,
        scratch,
        files,
        copies: new Map([[realpathSync(root), scratch]]),
        pending: [],
        fileLinks: [],
    };
    try {
        // The private tools of gspot run in place, so their folders stay out of the copy.
        const projects = paths.flatMap((path) =>
            PROJECT_MANIFESTS.includes(posix.basename(path)) && posix.basename(posix.dirname(path)) !== DOT_GSPOT
                ? [posix.dirname(path)]
                : [],
        );
        const dependencies = [
            ...new Set(
                [...scopePaths, ...projects].flatMap((project) =>
                    SCRATCH_DIRECTORIES.map((name) => posix.join(project, name)),
                ),
            ),
        ];
        await copySelected(context, paths, dependencies);
        await copyDependencies(context, dependencies);
        for (let directory = context.pending.pop(); directory !== undefined; directory = context.pending.pop())
            for (const entry of await outerTargetsFirst(directory.source)) await visitEntry(context, directory, entry);
        await relinkFiles(context);
        return folder;
    } catch (error) {
        folder[Symbol.dispose]();
        throw error;
    }
}
