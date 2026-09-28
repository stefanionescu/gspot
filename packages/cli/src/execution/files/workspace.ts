// Temporary copies of selected files for commands that must not read the working tree.
import { tmpdir } from 'node:os';
import { cp, readdir, rm } from 'node:fs/promises';
import { PERMISSION_BITS } from '#cli/constants/platform.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import type { Copy, Scratch } from '#cli/types/execution/execution.ts';
import { SCRATCH_DIRECTORIES, SCRATCH_EXTRAS } from '#cli/constants/execution/execution.ts';

import {
    constants,
    type Dirent,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    statSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';

const CLONE_OPTIONS = { recursive: true, verbatimSymlinks: true, mode: constants.COPYFILE_FICLONE } as const;

// Whether a path exists, without following the repository's confinement rules.
function exists(path: string): boolean {
    return statSync(path, { throwIfNoEntry: false }) !== undefined;
}

// Copies each selected file that exists, resolving it through the confined root.
async function copySelected(context: Scratch, paths: string[], dependencies: string[]): Promise<void> {
    const copied = new Set(
        [...paths, ...SCRATCH_EXTRAS].filter(
            (path) => !dependencies.some((dir) => path === dir || path.startsWith(`${dir}/`)),
        ),
    );
    for (const path of copied) {
        if (!exists(join(context.root, path))) continue;
        const resolved = context.files.source(path);
        mkdirSync(dirname(join(context.scratch, path)), { recursive: true });
        await cp(resolved, join(context.scratch, path), { dereference: true });
    }
}

// Clones each installed dependency folder that exists, and queues it for link repair.
async function copyDependencies(context: Scratch, dependencies: string[]): Promise<void> {
    for (const dir of dependencies) {
        if (!exists(join(context.root, dir))) continue;
        const source = realpathSync(join(context.root, dir));
        const target = join(context.scratch, dir);
        context.copies.set(source, target);
        await cp(source, target, CLONE_OPTIONS);
        context.pending.push({ source, target });
    }
}

// Where a path inside a copied tree lives in the scratch copy, or undefined when no copy holds it.
function relocated(copies: Map<string, string>, source: string): string | undefined {
    for (const [original, copied] of [...copies].toSorted(([left], [right]) => right.length - left.length)) {
        const local = relative(original, source);
        if (!isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`)) return join(copied, local);
    }
    return undefined;
}

// Repairs a directory link inside a copied tree: pointed at the copy of its target, or replaced by a clone of it.
async function relinkDirectory(context: Scratch, original: string, target: string): Promise<void> {
    const destination = relocated(context.copies, original);
    unlinkSync(target);
    if (destination !== undefined && exists(destination)) {
        symlinkSync(relative(dirname(target), destination), target, 'dir');
        return;
    }
    context.copies.set(original, target);
    await cp(original, target, CLONE_OPTIONS);
    context.pending.push({ source: original, target });
}

// Handles one entry of a copied tree: folders are queued, file links deferred, directory links repaired now.
async function visitEntry(context: Scratch, directory: Copy, entry: Dirent): Promise<void> {
    const source = join(directory.source, entry.name);
    const target = join(directory.target, entry.name);
    if (entry.isDirectory()) {
        context.pending.push({ source, target });
        return;
    }
    if (!entry.isSymbolicLink()) return;
    const original = realpathSync(source);
    if (statSync(original).isFile()) context.fileLinks.push({ source: original, target });
    else await relinkDirectory(context, original, target);
}

// Repairs every file link once every tree is copied, so its target's copy is known to exist or not.
async function relinkFiles(context: Scratch): Promise<void> {
    for (const { source, target } of context.fileLinks) {
        const destination = relocated(context.copies, source);
        unlinkSync(target);
        if (destination !== undefined && exists(destination))
            symlinkSync(relative(dirname(target), destination), target, 'file');
        else await cp(source, target);
    }
}

/**
 * Copy selected files and declared configurations without native discovery inputs.
 * @param root the repository root
 * @param paths the files to copy
 * @returns the workspace root, the original bytes by path, and its disposal
 */
export function createFileWorkspace(
    root: string,
    paths: string[],
): {
    root: string;
    originals: Map<string, Buffer>;
    [Symbol.dispose]: () => void;
} {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), 'gspot-files-')));
    const originals = new Map<string, Buffer>();
    try {
        const files = openConfinedRoot(root, 'native');
        try {
            for (const path of new Set(paths)) {
                const source = files.source(path);
                const bytes = readFileSync(source);
                originals.set(path, bytes);
                const target = join(directory, path);
                mkdirSync(dirname(target), { recursive: true });
                writeFileSync(target, bytes, { mode: statSync(source).mode & PERMISSION_BITS });
            }
        } finally {
            files.close();
        }
        return {
            root: directory,
            originals,
            [Symbol.dispose]: () => {
                rmSync(directory, { recursive: true, force: true });
            },
        };
    } catch (error) {
        rmSync(directory, { recursive: true, force: true });
        throw error;
    }
}

/**
 * Copies selected source and configuration files for commands run outside the working tree.
 * @param root the repository root
 * @param paths the source paths relative to the repository root
 * @param scopePaths the scopes whose installed dependencies the command needs
 * @returns the temporary directory, which the caller must remove
 */
export async function scratchCopy(root: string, paths: string[], scopePaths: string[]): Promise<string> {
    const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'gspot-fix-')));
    const files = openConfinedRoot(root, 'native');
    const context: Scratch = {
        root,
        scratch,
        files,
        copies: new Map([[realpathSync(root), scratch]]),
        pending: [],
        fileLinks: [],
    };
    try {
        const dependencies = [
            ...new Set(scopePaths.flatMap((scope) => SCRATCH_DIRECTORIES.map((name) => join(scope, name)))),
        ];
        await copySelected(context, paths, dependencies);
        await copyDependencies(context, dependencies);
        for (let directory = context.pending.pop(); directory !== undefined; directory = context.pending.pop())
            for (const entry of await readdir(directory.source, { withFileTypes: true }))
                await visitEntry(context, directory, entry);
        await relinkFiles(context);
        return scratch;
    } catch (error) {
        await rm(scratch, { recursive: true, force: true });
        throw error;
    } finally {
        files.close();
    }
}
