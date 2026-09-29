// The compiler directory a Swift build reuses between runs: locked, free of links, and holding only the sources wanted.
import { join, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { toPosix } from '#cli/platform/paths.ts';
import type { Pruning } from '#cli/types/checks.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { Read, Root } from '#cli/types/platform.ts';
import { cacheHome } from '#cli/platform/environment.ts';
import { statSync, lstatSync, mkdirSync, readdirSync } from 'node:fs';
import { MODE_BITS, PRIVATE_DIRECTORY } from '#cli/config/platform.ts';

// Checks one folder of the compiler directory: a link is refused, and each folder inside is queued.
function inspectFolder(folder: string, files: Root, directory: string, pending: string[]): void {
    const path = directory === '' ? folder : files.source(directory);
    for (const entry of readdirSync(path, { withFileTypes: true })) {
        const local = directory === '' ? entry.name : `${directory}/${entry.name}`;
        if (entry.isSymbolicLink()) files.source(local);
        else if (entry.isDirectory()) pending.push(local);
    }
}

// Refuses a compiler directory that holds a symbolic link anywhere, walking every folder in it.
function assertNoLinks(folder: string, files: Root): void {
    const pending = [''];
    for (let directory = pending.pop(); directory !== undefined; directory = pending.pop())
        inspectFolder(folder, files, directory, pending);
}

// The sources to build, each as the snapshot it must have under source/ in the compiler directory.
function desiredSources(root: string, paths: string[]): Map<string, Read> {
    const source = openRoot(root, 'native');
    const desired = new Map<string, Read>();
    try {
        for (const file of paths) {
            const mode = statSync(source.source(file)).mode & MODE_BITS;
            desired.set(`source/${file}`, { bytes: readSource(root, file), mode });
        }
    } finally {
        source.close();
    }
    return desired;
}

// Removes an existing file or link absent from the build inputs.
function removeStale(files: Root, path: string, isLink: boolean): void {
    const current = isLink ? files.readEntry(path) : files.read(path);
    if (current !== undefined) files.remove(path, current);
}

// Handles one entry under source/: a folder is queued and noted when unwanted, anything else unwanted is removed.
function pruneEntry(pruning: Pruning, path: string, directories: string[], empty: string[]): void {
    const { folder, files, desired, wanted } = pruning;
    if (lstatSync(join(folder, path)).isSymbolicLink()) {
        removeStale(files, path, true);
        return;
    }
    if (files.stat(path)?.isDirectory() === true) {
        directories.push(path);
        if (!wanted.has(path)) empty.push(path);
        return;
    }
    if (!desired.has(path)) removeStale(files, path, false);
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
    const directories = ['source'];
    const empty: string[] = [];
    for (let directory = directories.pop(); directory !== undefined; directory = directories.pop())
        for (const name of files.list(directory)) pruneEntry(pruning, `${directory}/${name}`, directories, empty);
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
    const boundary = openRoot(home);
    try {
        boundary.mkdir(toPosix(relative(home, folder)), PRIVATE_DIRECTORY);
    } finally {
        boundary.close();
    }
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
