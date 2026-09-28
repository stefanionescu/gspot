// A reader and writer files to one directory: every path is checked before each operation.
// Concurrent hostile directory replacement is outside this contract.
import { sep, relative, isAbsolute } from 'node:path';
import { sameEntry } from '#cli/platform/safe-paths.ts';
import { afterWrite, acquireLock } from '#cli/platform/root/writes.ts';
import type { Read, Root, Bounds, PathFormat } from '#cli/types/platform.ts';
import { boundsOf, readEntry, parentPath, validateRead } from '#cli/platform/root/reads.ts';
import { chmodSync, lstatSync, mkdirSync, rmdirSync, type Stats, unlinkSync, readdirSync, realpathSync } from 'node:fs';

// The real path of a files entry, refusing one whose link chain leaves the root.
function sourceOf(bounds: Bounds, path: string): string {
    const target = realpathSync(parentPath(bounds, path));
    const local = relative(bounds.canonical, target);
    if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`))
        throw new Error(`Source link leaves the repository: ${path}`);
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

/**
 * Check paths before each operation. Concurrent hostile directory replacement is outside this contract.
 * @param root the directory every path is files to
 * @param pathFormat whether paths use forward slashes or the platform's own spelling
 * @returns the files reader and writer, which the caller closes
 */
export function openRoot(root: string, pathFormat: PathFormat = 'portable'): Root {
    const bounds = boundsOf(realpathSync(root), pathFormat);
    return {
        rmdir: (path) => {
            rmdirSync(parentPath(bounds, path));
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
    };
}
