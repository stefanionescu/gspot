// The compiler directory a Swift build reuses between runs: locked, free of links, and holding only the sources wanted.
import { join, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { toPosix } from '#cli/platform/paths.ts';
import { readSource } from '#cli/repository/sources.ts';
import { MODE_BITS } from '#cli/config/platform/root.ts';
import { cacheHome } from '#cli/platform/environment.ts';
import { statSync, lstatSync, mkdirSync } from 'node:fs';
import { openRoot, walkRoot } from '#cli/platform/filesystem.ts';
import type { Read, Root } from '#cli/types/platform/platform.ts';
import type { Pruning } from '#cli/types/checks/language/swift.ts';
import { PRIVATE_DIRECTORY } from '#cli/config/execution/checkout.ts';

// Refuses a compiler directory that holds a symbolic link anywhere, walking every folder in it.
function assertNoLinks(folder: string, files: Root): void {
    walkRoot(files, '', (path) => {
        const entry = lstatSync(join(folder, path));
        // The confined path refuses a link.
        if (entry.isSymbolicLink()) files.source(path);
        return entry.isDirectory();
    });
}

// The sources to build, each as the snapshot it must have under source/ in the compiler directory.
function desiredSources(root: string, paths: string[]): Map<string, Read> {
    using source = openRoot(root, 'native');
    const desired = new Map<string, Read>();
    for (const file of paths) {
        const mode = statSync(source.source(file)).mode & MODE_BITS;
        desired.set(`source/${file}`, { bytes: readSource(root, file), mode });
    }
    return desired;
}

// Removes an existing file or link absent from the build inputs.
function removeStale(files: Root, path: string, isLink: boolean): void {
    const current = isLink ? files.readEntry(path) : files.read(path);
    if (current !== undefined) files.remove(path, current);
}

// Handles one entry under source/: a folder is queued and noted when unwanted, anything else unwanted is removed.
function pruneEntry(pruning: Pruning, path: string, empty: string[]): boolean {
    const { folder, files, desired, wanted } = pruning;
    if (lstatSync(join(folder, path)).isSymbolicLink()) {
        removeStale(files, path, true);
        return false;
    }
    if (files.stat(path)?.isDirectory() === true) {
        if (!wanted.has(path)) empty.push(path);
        return true;
    }
    if (!desired.has(path)) removeStale(files, path, false);
    return false;
}

// Removes every entry under source/ the build does not want, then the folders left empty, deepest first.
function pruneSources(folder: string, files: Root, desired: Map<string, Read>): void {
    const pruning: Pruning = {
        folder,
        files,
        desired,
        wanted: new Set(
            [...desired.keys()].flatMap((path) => {
                const parts = path.split('/');
                return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join('/'));
            }),
        ),
    };
    const empty: string[] = [];
    walkRoot(files, 'source', (path) => pruneEntry(pruning, path, empty));
    for (const directory of empty.toSorted((left, right) => right.length - left.length)) files.rmdir(directory);
}

/**
 * Prepare and lock one compiler directory without following existing output links.
 * @param folder the compiler directory
 * @returns the files directory, which the caller closes
 */
export function openBuildCache(folder: string): Root {
    const home = cacheHome();
    mkdirSync(home, { recursive: true });
    using boundary = openRoot(home);
    boundary.mkdir(toPosix(relative(home, folder)), PRIVATE_DIRECTORY);
    const files = openRoot(folder, 'native');
    try {
        files.lock('build.lock');
        assertNoLinks(folder, files);
        return files;
    } catch (error) {
        files.close();
        throw error;
    }
}

/**
 * Restore selected sources in a stable compiler directory while retaining unchanged timestamps.
 * @param root the repository root
 * @param paths the source files to build
 * @param folder the compiler directory
 * @param files the files compiler directory
 * @returns the source directory inside the compiler directory
 */
export function prepareBuildSources(root: string, paths: string[], folder: string, files: Root): string {
    const desired = desiredSources(root, paths);
    pruneSources(folder, files, desired);
    files.mkdir('source', PRIVATE_DIRECTORY);
    for (const [path, next] of desired) {
        const current = files.read(path);
        if (!isDeepStrictEqual(current, next)) files.write(path, next, current);
    }
    return join(folder, 'source');
}
