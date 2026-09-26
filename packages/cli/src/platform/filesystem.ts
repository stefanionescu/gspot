// A reader and writer confined to one directory: every path is checked before each operation.
// Concurrent hostile directory replacement is outside this contract.
import { isAbsolute, relative, sep } from 'node:path';
import { sameSnapshot } from '#cli/platform/safe-paths.ts';
import type { FileSnapshot } from '#cli/platform/safe-paths.ts';
import { acquireLock, writeSnapshot } from '#cli/platform/confined-writes.ts';
import { chmodSync, lstatSync, mkdirSync, readdirSync, realpathSync, rmdirSync, type Stats, unlinkSync } from 'node:fs';

import {
    type Confinement,
    confinementOf,
    type PathFormat,
    readEntry,
    resolveParent,
    validateSnapshot,
} from '#cli/platform/confined-reads.ts';

// The real path of a confined entry, refusing one whose link chain leaves the root.
function sourceOf(confinement: Confinement, path: string): string {
    const target = realpathSync(resolveParent(confinement, path));
    const local = relative(confinement.canonical, target);
    if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`))
        throw new Error(`Source link leaves the repository: ${path}`);
    return target;
}

// The sorted names in a confined directory, or none when it is absent.
function listOf(confinement: Confinement, path: string | undefined): string[] {
    try {
        const target = path === undefined ? confinement.canonical : resolveParent(confinement, path);
        if (!lstatSync(target).isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path ?? '.'}`);
        return readdirSync(target).toSorted((left, right) => left.localeCompare(right));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw error;
    }
}

// The stat of a confined entry that is not a link, or undefined when it is absent.
function statOf(confinement: Confinement, path: string): Stats | undefined {
    try {
        const stat = lstatSync(resolveParent(confinement, path));
        if (stat.isSymbolicLink()) throw new Error(`Unsafe lifecycle destination: ${path}`);
        return stat;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

// Removes a confined file after checking that it is still the one the caller last saw.
function removeEntry(confinement: Confinement, path: string, expected: FileSnapshot): void {
    if (!sameSnapshot(readEntry(confinement, path, expected.isLink === true), expected))
        throw new Error(`Lifecycle destination changed during removal: ${path}`);
    unlinkSync(resolveParent(confinement, path));
}

// Creates a confined directory with the mode, accepting one that already exists.
function makeDirectory(confinement: Confinement, path: string, mode: number): void {
    const target = resolveParent(confinement, path, true);
    try {
        mkdirSync(target, { mode });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (!lstatSync(target).isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path}`);
    chmodSync(target, mode);
}

// Releases every lock this root still holds, leaving a lock another writer took over.
function releaseLocks(confinement: Confinement): void {
    for (const [path, holder] of confinement.locks)
        if (readEntry(confinement, path, false)?.bytes.toString('utf8') === holder)
            unlinkSync(resolveParent(confinement, path));
    confinement.locks.clear();
}

/**
 * Check paths before each operation. Concurrent hostile directory replacement is outside this contract.
 * @param root the directory every path is confined to
 * @param pathFormat whether paths use forward slashes or the platform's own spelling
 * @returns the confined reader and writer, which the caller closes
 */
export function openConfinedRoot(root: string, pathFormat: PathFormat = 'portable'): ConfinedRoot {
    const confinement = confinementOf(realpathSync(root), pathFormat);
    return {
        rmdir: (path) => { rmdirSync(resolveParent(confinement, path)); },
        source: (path) => sourceOf(confinement, path),
        list: (path) => listOf(confinement, path),
        stat: (path) => statOf(confinement, path),
        validate: (path, value, proposed) => void validateSnapshot(confinement, path, value, proposed),
        read: (path) => readEntry(confinement, path, false),
        readEntry: (path) => readEntry(confinement, path, true),
        write: (path, value, expected) => { writeSnapshot(confinement, path, value, expected); },
        remove: (path, expected) => { removeEntry(confinement, path, expected); },
        mkdir: (path, mode) => { makeDirectory(confinement, path, mode); },
        lock: (path) => { acquireLock(confinement, path); },
        close: () => { releaseLocks(confinement); },
    };
}

export type ConfinedRoot = {
    source(path: string): string;
    list(path?: string): string[];
    stat(path: string): Stats | undefined;
    validate(path: string, value: FileSnapshot, proposed?: ReadonlyMap<string, FileSnapshot | undefined>): void;
    readEntry(path: string): FileSnapshot | undefined;
    read(path: string): FileSnapshot | undefined;
    write(path: string, value: FileSnapshot, expected: FileSnapshot | undefined): void;
    remove(path: string, expected: FileSnapshot): void;
    mkdir(path: string, mode: number): void;
    rmdir(path: string): void;
    lock(path: string): void;
    close(): void;
};
