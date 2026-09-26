// The compiler directory a Swift build reuses between runs: locked, free of links, and holding only the sources wanted.
import { join, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { readSource } from '#cli/repository/tracked.ts';
import { cacheHome } from '#cli/platform/environment.ts';
import type { Pruning } from '#cli/types/checks/swift.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { lstatSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import type { ConfinedRoot, FileSnapshot } from '#cli/types/platform.ts';
import { MODE_BITS, PRIVATE_DIRECTORY } from '#cli/constants/platform.ts';

// Checks one folder of the compiler directory: a link is refused, and each folder inside is queued.
function inspectFolder(folder: string, files: ConfinedRoot, directory: string, pending: string[]): void {
    const path = directory === '' ? folder : files.source(directory);
    for (const entry of readdirSync(path, { withFileTypes: true })) {
        const local = directory === '' ? entry.name : `${directory}/${entry.name}`;
        if (entry.isSymbolicLink()) files.source(local);
        else if (entry.isDirectory()) pending.push(local);
    }
}

// Refuses a compiler directory that holds a symbolic link anywhere, walking every folder in it.
function assertNoLinks(folder: string, files: ConfinedRoot): void {
    const pending = [''];
    for (let directory = pending.pop(); directory !== undefined; directory = pending.pop())
        inspectFolder(folder, files, directory, pending);
}

// The sources to build, each as the snapshot it must have under source/ in the compiler directory.
function desiredSources(root: string, paths: string[]): Map<string, FileSnapshot> {
    const source = openConfinedRoot(root, 'native');
    const desired = new Map<string, FileSnapshot>();
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

// Every folder a desired path sits in, including its ancestors.
function wantedDirectories(desired: Map<string, FileSnapshot>): Set<string> {
    return new Set(
        [...desired.keys()].flatMap((path) => {
            const parts = path.split('/');
            return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join('/'));
        }),
    );
}

// Removes a file or link the build no longer wants, when it is still there.
function removeStale(files: ConfinedRoot, path: string, isLink: boolean): void {
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
function pruneSources(folder: string, files: ConfinedRoot, desired: Map<string, FileSnapshot>): void {
    const pruning: Pruning = { folder, files, desired, wanted: wantedDirectories(desired) };
    const directories = ['source'];
    const empty: string[] = [];
    for (let directory = directories.pop(); directory !== undefined; directory = directories.pop())
        for (const name of files.list(directory)) pruneEntry(pruning, `${directory}/${name}`, directories, empty);
    for (const directory of empty.toSorted((left, right) => right.length - left.length)) files.rmdir(directory);
}

/**
 * Prepare and lock one compiler directory without following existing output links.
 * @param folder the compiler directory
 * @returns the confined directory, which the caller closes
 */
export function openBuildCache(folder: string): ConfinedRoot {
    const home = cacheHome();
    mkdirSync(home, { recursive: true });
    const boundary = openConfinedRoot(home);
    try {
        boundary.mkdir(relative(home, folder).replaceAll('\\', '/'), PRIVATE_DIRECTORY);
    } finally {
        boundary.close();
    }
    const files = openConfinedRoot(folder, 'native');
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
 * @param files the confined compiler directory
 * @returns the source directory inside the compiler directory
 */
export function prepareBuildSources(root: string, paths: string[], folder: string, files: ConfinedRoot): string {
    const desired = desiredSources(root, paths);
    pruneSources(folder, files, desired);
    files.mkdir('source', PRIVATE_DIRECTORY);
    for (const [path, next] of desired) {
        const current = files.read(path);
        if (!isDeepStrictEqual(current, next)) files.write(path, next, current);
    }
    return join(folder, 'source');
}
