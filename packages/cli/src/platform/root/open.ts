// Filesystem operations confined to one directory: each call checks its path.
// Concurrent hostile directory replacement is outside this contract.
import type { Stats } from 'node:fs';
import { isInside } from '#cli/platform/paths.ts';
import { join, posix, relative } from 'node:path';
import { sameEntry } from '#cli/platform/root/rules.ts';
import { writeLink, acquireLock, replaceEntry } from '#cli/platform/root/writes.ts';
import type { Root, Bounds, FileCopy, PathFormat } from '#cli/types/platform/root.ts';
import { rmSync, chmodSync, lstatSync, mkdirSync, rmdirSync, renameSync, unlinkSync, readdirSync } from 'node:fs';

import {
    boundsOf,
    readEntry,
    checkedPath,
    preparedPath,
    validateRead,
    canonicalPath,
} from '#cli/platform/root/reads.ts';

// The real path of an entry, refusing a resolved destination outside the root.
function sourceOf(bounds: Bounds, path: string): string {
    const target = canonicalPath(join(bounds.canonical, ...bounds.partsOf(path)));
    const local = relative(bounds.canonical, target);
    if (!isInside(local)) throw new Error(`Source link leaves the repository: ${path}`);
    return target;
}

// The sorted names in a directory inside the root, or none when it is absent.
function listOf(bounds: Bounds, path: string | undefined): string[] {
    try {
        const target = path === undefined ? bounds.canonical : checkedPath(bounds, path);
        if (!lstatSync(target).isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path ?? '.'}`);
        return readdirSync(target).toSorted((left, right) => left.localeCompare(right));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}

// The stat of an entry inside the root that is not a link, or undefined when it is absent.
function statOf(bounds: Bounds, path: string): Stats | undefined {
    try {
        const stat = lstatSync(checkedPath(bounds, path));
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
    renameSync(checkedPath(bounds, from), preparedPath(bounds, to));
}

// Deletes a directory that is not a link, with everything in it. A link inside is removed, never followed.
function removeTree(bounds: Bounds, path: string): void {
    const stat = statOf(bounds, path);
    if (stat === undefined) return;
    if (!stat.isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path}`);
    rmSync(checkedPath(bounds, path), { recursive: true, force: true });
}

// Removes a file inside the root after checking that it is still the one the caller last saw.
function removeEntry(bounds: Bounds, path: string, expected: FileCopy): void {
    if (!sameEntry(readEntry(bounds, path, expected.isLink === true), expected))
        throw new Error(`Lifecycle destination changed during removal: ${path}`);
    unlinkSync(checkedPath(bounds, path));
}

// Creates a directory inside the root with the mode, accepting one that already exists.
function makeDirectory(bounds: Bounds, path: string, mode: number): void {
    const target = preparedPath(bounds, path);
    try {
        mkdirSync(target, { mode });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (!lstatSync(target).isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path}`);
    chmodSync(target, mode);
}

// Releases every lock this root still holds, leaving a lock another writer took over. The folders only a lock kept
// go too, so a writer that wrote nothing leaves nothing.
function releaseLocks(bounds: Bounds): void {
    for (const [path, holder] of bounds.locks) {
        if (readEntry(bounds, path, false)?.bytes.toString('utf8') !== holder) continue;
        unlinkSync(checkedPath(bounds, path));
        for (let folder = posix.dirname(path); folder !== '.'; folder = posix.dirname(folder)) {
            if (listOf(bounds, folder).length > 0) break;
            rmdirSync(checkedPath(bounds, folder));
        }
    }
    bounds.locks.clear();
}

/**
 * Opens a reader and writer confined to one folder. Each call checks its path first.
 * @param root the directory containing every relative path.
 * @param pathFormat portable checks names across supported platforms; native checks this platform. Both use forward slashes.
 * @returns the root reader and writer, which the caller disposes, as `using` does.
 */
export function openRoot(root: string, pathFormat: PathFormat = 'portable'): Root {
    const bounds = boundsOf(canonicalPath(root), pathFormat);
    return {
        rmdir: (path) => {
            rmdirSync(checkedPath(bounds, path));
        },
        renameDirectory: (from, to) => {
            renameDirectory(bounds, from, to);
        },
        removeTree: (path) => {
            removeTree(bounds, path);
        },
        realPath: (path) => sourceOf(bounds, path),
        assertInside: (path) => {
            sourceOf(bounds, path);
        },
        list: (path) => listOf(bounds, path),
        stat: (path) => statOf(bounds, path),
        validate: (path, value, proposed) => {
            validateRead(bounds, path, value, proposed);
        },
        read: (path) => readEntry(bounds, path, false),
        readKeepingLinks: (path) => readEntry(bounds, path, true),
        write: (path, value, expected) => {
            replaceEntry(bounds, path, value, expected);
        },
        link: (path, value) => {
            writeLink(preparedPath(bounds, path), value.bytes, value.mode);
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
 * Visits every entry under a folder of a root, and enters each one the visitor says is a folder to walk.
 * @param files the root.
 * @param start the folder, with forward slashes, or '' for the root itself.
 * @param visit called with the path of each entry; returns whether to walk into it.
 */
export function walkRoot(files: Root, start: string, visit: (path: string) => boolean): void {
    const pending = [start];
    for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
        const names = files.list(directory === '' ? undefined : directory);
        const paths = directory === '' ? names : names.map((name) => `${directory}/${name}`);
        pending.push(...paths.filter((path) => visit(path)));
    }
}
