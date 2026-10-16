// Opens a safe folder with confined reads and writes.
// The sorted names in a directory inside the root, or none when the entry does not exist.

import type { Stats } from 'node:fs';
import { replaceEntry } from '#cli/system/safe-folder/writes.ts';
import { takeLock, releaseLocks } from '#cli/system/safe-folder/lock.ts';
import { systemSegments, portableSegments } from '#cli/system/safe-folder/names.ts';
import { rmSync, chmodSync, lstatSync, mkdirSync, rmdirSync, unlinkSync, readdirSync } from 'node:fs';
import type { FileCopy, PathFormat, SafeFolder, SafeFolderState } from '#cli/types/system/safe-folder.ts';

import {
    realPath,
    readEntry,
    sameEntry,
    sourcePath,
    checkedPath,
    preparedPath,
    validateCopy,
} from '#cli/system/safe-folder/reads.ts';

// The stat of an entry inside the root excluding links, or undefined when the entry does not exist.
function statOf(bounds: SafeFolderState, path: string): Stats | undefined {
    try {
        const stat = lstatSync(checkedPath(bounds, path));
        if (stat.isSymbolicLink()) throw new Error(`${path} is a link. gspot does not write through links.`);
        return stat;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

// Delete a directory and its contents without following links. Remove links without following them.
function removeTree(bounds: SafeFolderState, path: string): void {
    const stat = statOf(bounds, path);
    if (stat === undefined) return;
    if (!stat.isDirectory()) throw new Error(`${path} is not a directory. Choose a directory.`);
    rmSync(checkedPath(bounds, path), { recursive: true, force: true });
}

// Removes a file inside the root after confirming that it matches the last copy the caller saw.
function removeEntry(bounds: SafeFolderState, path: string, expected: FileCopy): void {
    if (!sameEntry(readEntry(bounds, path, expected.isLink === true), expected))
        throw new Error(`${path} changed before removal. Run the command again.`);
    unlinkSync(checkedPath(bounds, path));
}

// Creates a directory inside the root with the mode, accepting one that already exists.
function makeDirectory(bounds: SafeFolderState, path: string, mode: number): void {
    const target = preparedPath(bounds, path);
    try {
        mkdirSync(target, { mode });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (!lstatSync(target).isDirectory()) throw new Error(`${path} is not a directory. Choose a directory.`);
    chmodSync(target, mode);
}

/**
 * List entries under a safe path without following directory links.
 * @param bounds the directory and its safe path rules.
 * @param path the repository-relative file path.
 * @returns the sorted directory entries.
 */
function listOf(bounds: SafeFolderState, path: string | undefined): string[] {
    try {
        const target = path === undefined ? bounds.root : checkedPath(bounds, path);
        if (!lstatSync(target).isDirectory()) throw new Error(`${path ?? '.'} is not a directory. Choose a directory.`);
        return readdirSync(target).toSorted((left, right) => left.localeCompare(right));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}

/**
 * Opens a reader and writer confined to one folder. Each call checks its path first.
 * @param root the directory containing every relative path.
 * @param pathFormat portable checks names across supported systems; system checks this system. Both use forward slashes.
 * @returns the root reader and writer, which the caller disposes, as `using` does.
 */
export function openSafeFolder(root: string, pathFormat: PathFormat = 'portable'): SafeFolder {
    const bounds: SafeFolderState = {
        root: realPath(root),
        partsOf: pathFormat === 'portable' ? portableSegments : systemSegments,
        locks: new Map(),
    };
    return {
        rmdir: (path) => {
            rmdirSync(checkedPath(bounds, path));
        },
        removeTree: (path) => {
            removeTree(bounds, path);
        },
        realPath: (path) => sourcePath(bounds.root, path, bounds.partsOf),
        list: (path) => listOf(bounds, path),
        stat: (path) => statOf(bounds, path),
        validate: (path, value, plannedFiles) => {
            validateCopy(bounds, path, value, plannedFiles);
        },
        read: (path) => readEntry(bounds, path, false),
        readKeepingLinks: (path) => readEntry(bounds, path, true),
        write: (path, value, expected) => {
            replaceEntry(bounds, path, value, expected);
        },
        remove: (path, expected) => {
            removeEntry(bounds, path, expected);
        },
        mkdir: (path, mode) => {
            makeDirectory(bounds, path, mode);
        },
        claim: (path) => {
            takeLock(bounds, path);
        },
        [Symbol.dispose]: () => {
            releaseLocks(bounds);
        },
    };
}

/**
 * Visits every entry under a folder of a root, and enters each one the visitor selects for traversal.
 * @param files the root.
 * @param start the folder, with forward slashes, or '' for the root itself.
 * @param visit called with the path of each entry; returns whether to walk into it.
 */
export function walkSafeFolder(files: SafeFolder, start: string, visit: (path: string) => boolean): void {
    const pending = [start];
    for (let directory = pending.pop(); directory !== undefined; directory = pending.pop()) {
        const names = files.list(directory === '' ? undefined : directory);
        const paths = directory === '' ? names : names.map((name) => `${directory}/${name}`);
        pending.push(...paths.filter((path) => visit(path)));
    }
}
