// A reader and writer files to one directory: every path is checked before each operation.
// Concurrent hostile directory replacement is outside this contract.
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { isInside } from '#cli/platform/paths.ts';
import { decodedText } from '#cli/platform/text.ts';
import { sameEntry } from '#cli/platform/safe-paths.ts';
import { afterWrite, acquireLock } from '#cli/platform/root/writes.ts';
import { boundsOf, readEntry, parentPath, validateRead } from '#cli/platform/root/reads.ts';
import type { Read, Root, Bounds, PathFormat, ScratchFolder } from '#cli/types/platform/platform.ts';

import {
    rmSync,
    chmodSync,
    lstatSync,
    mkdirSync,
    rmdirSync,
    renameSync,
    type Stats,
    unlinkSync,
    mkdtempSync,
    readdirSync,
    realpathSync,
} from 'node:fs';

// The real path of a files entry, refusing one whose link chain leaves the root.
function sourceOf(bounds: Bounds, path: string): string {
    const target = realpathSync(parentPath(bounds, path));
    const local = relative(bounds.canonical, target);
    if (!isInside(local)) throw new Error(`Source link leaves the repository: ${path}`);
    return target;
}

// The sorted names in a files directory, or none when it is absent.
function listOf(bounds: Bounds, path: string | undefined): string[] {
    try {
        const target = path === undefined ? bounds.canonical : parentPath(bounds, path);
        if (!lstatSync(target).isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path ?? '.'}`);
        return readdirSync(target).toSorted((left, right) => left.localeCompare(right));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}

// The stat of a files entry that is not a link, or undefined when it is absent.
function statOf(bounds: Bounds, path: string): Stats | undefined {
    try {
        const stat = lstatSync(parentPath(bounds, path));
        if (stat.isSymbolicLink()) throw new Error(`Unsafe lifecycle destination: ${path}`);
        return stat;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

// Moves a directory that is not a link to a path of the same root where nothing is yet.
function renameDirectory(bounds: Bounds, from: string, to: string): void {
    if (statOf(bounds, from)?.isDirectory() !== true) throw new Error(`Unsafe lifecycle directory: ${from}`);
    if (statOf(bounds, to) !== undefined) throw new Error(`Lifecycle destination exists: ${to}`);
    renameSync(parentPath(bounds, from), parentPath(bounds, to, true));
}

// Deletes a directory that is not a link, with everything in it. A link inside is removed, never followed.
function removeTree(bounds: Bounds, path: string): void {
    const stat = statOf(bounds, path);
    if (stat === undefined) return;
    if (!stat.isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path}`);
    rmSync(parentPath(bounds, path), { recursive: true, force: true });
}

// Removes a files file after checking that it is still the one the caller last saw.
function removeEntry(bounds: Bounds, path: string, expected: Read): void {
    if (!sameEntry(readEntry(bounds, path, expected.isLink === true), expected))
        throw new Error(`Lifecycle destination changed during removal: ${path}`);
    unlinkSync(parentPath(bounds, path));
}

// Creates a files directory with the mode, accepting one that already exists.
function makeDirectory(bounds: Bounds, path: string, mode: number): void {
    const target = parentPath(bounds, path, true);
    try {
        mkdirSync(target, { mode });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (!lstatSync(target).isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path}`);
    chmodSync(target, mode);
}

// Releases every lock this root still holds, leaving a lock another writer took over.
function releaseLocks(bounds: Bounds): void {
    for (const [path, holder] of bounds.locks)
        if (readEntry(bounds, path, false)?.bytes.toString('utf8') === holder) unlinkSync(parentPath(bounds, path));
    bounds.locks.clear();
}

// The paths of the entries in one folder of a root.
function childPaths(files: Root, directory: string): string[] {
    if (directory === '') return files.list();
    return files.list(directory).map((name) => `${directory}/${name}`);
}

/**
 * Check paths before each operation. Concurrent hostile directory replacement is outside this contract.
 * @param root the directory every path is files to
 * @param pathFormat whether paths use forward slashes or the platform's own spelling
 * @returns the files reader and writer, which the caller disposes, as `using` does
 */
export function openRoot(root: string, pathFormat: PathFormat = 'portable'): Root {
    const bounds = boundsOf(realpathSync(root), pathFormat);
    return {
        rmdir: (path) => {
            rmdirSync(parentPath(bounds, path));
        },
        rename: (from, to) => {
            renameDirectory(bounds, from, to);
        },
        removeTree: (path) => {
            removeTree(bounds, path);
        },
        source: (path) => sourceOf(bounds, path),
        list: (path) => listOf(bounds, path),
        stat: (path) => statOf(bounds, path),
        validate: (path, value, proposed) => {
            validateRead(bounds, path, value, proposed);
        },
        read: (path) => readEntry(bounds, path, false),
        readEntry: (path) => readEntry(bounds, path, true),
        write: (path, value, expected) => {
            afterWrite(bounds, path, value, expected);
        },
        remove: (path, expected) => {
            removeEntry(bounds, path, expected);
        },
        mkdir: (path, mode) => {
            makeDirectory(bounds, path, mode);
        },
        lock: (path) => {
            acquireLock(bounds, path);
        },
        close: () => {
            releaseLocks(bounds);
        },
        [Symbol.dispose]: () => {
            releaseLocks(bounds);
        },
    };
}

/**
 * Makes an empty folder under the system temporary folder that removes itself, with everything in it, when disposed.
 * Its path is the native real path, which on Windows expands short folder names, as the paths tools report do.
 * @param prefix the start of the folder name
 * @returns the folder, which the caller disposes, as `using` does
 */
export function scratchFolder(prefix: string): ScratchFolder {
    const path = realpathSync.native(mkdtempSync(join(tmpdir(), prefix)));
    return {
        path,
        [Symbol.dispose]: () => {
            rmSync(path, { recursive: true, force: true });
        },
    };
}

/**
 * Reads one file under a directory as UTF-8 text.
 * @param root the directory the path is relative to
 * @param path the file, with forward slashes
 * @returns the text, or undefined when the file does not exist
 * @throws when the file is not UTF-8 text
 */
export function readText(root: string, path: string): string | undefined {
    using files = openRoot(root);
    const read = files.read(path);
    if (read === undefined) return undefined;
    const text = decodedText(read.bytes);
    if (text === undefined) throw new Error(`${path} is not UTF-8 text.`);
    return text;
}

/**
 * Visits every entry under a folder of a root, and enters each one the visitor says is a folder to walk.
 * @param files the root
 * @param start the folder, with forward slashes, or '' for the root itself
 * @param visit called with the path of each entry; returns whether to walk into it
 */
export function walkRoot(files: Root, start: string, visit: (path: string) => boolean): void {
    const pending = [start];
    for (let directory = pending.pop(); directory !== undefined; directory = pending.pop())
        pending.push(...childPaths(files, directory).filter((path) => visit(path)));
}
