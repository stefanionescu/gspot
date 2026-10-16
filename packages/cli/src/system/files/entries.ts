// Reads, compares, and replaces one contained file or link.
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { type FileCopy, type FilesState } from '#cli/types/system/files.ts';
import { TEMPORARY_FILE_PREFIX, TEMPORARY_FILE_SUFFIX } from '#cli/config/system/files.ts';

import {
    MODE_BITS,
    PRIVATE_FILE,
    WRITABLE_FILE,
    READ_ONLY_FILE,
    OWNER_WRITE_BIT,
    PERMISSION_BITS,
} from '#cli/config/system/modes.ts';
import {
    openSync,
    lstatSync,
    mkdirSync,
    closeSync,
    fsyncSync,
    type Stats,
    unlinkSync,
    fchmodSync,
    renameSync,
    readFileSync,
    readlinkSync,
    writeFileSync,
} from 'node:fs';

// Create a missing parent. A competing creator may finish first.
function prepareParentFolder(folder: string): Stats {
    try {
        return lstatSync(folder);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    try {
        mkdirSync(folder);
    } catch (creationError) {
        if ((creationError as NodeJS.ErrnoException).code !== 'EEXIST') throw creationError;
    }
    return lstatSync(folder);
}

// The copy of a symbolic link: its target text and its own mode.
function readSymbolicLink(target: string, stat: Stats): FileCopy {
    const bytes = Buffer.from(readlinkSync(target));
    const mode = normalizeFileMode({ mode: stat.mode & MODE_BITS, isLink: true });
    return { bytes, mode, isLink: true };
}

// The bytes and mode of a private regular file.
function readRegularFile(target: string, stat: Stats, path: string): FileCopy {
    if (!stat.isFile() || stat.nlink !== 1)
        throw new Error(`${path} is not a regular file with one link. Use a regular file without extra hard links.`);
    const bytes = readFileSync(target);
    return { bytes, mode: normalizeFileMode({ mode: stat.mode & MODE_BITS }) };
}

// Check the same parent directories before a read or a prepared write.
function walkParentFolders(bounds: FilesState, path: string, statParent: (path: string) => Stats): string {
    const parts = splitSystemPath(path);
    let folder = bounds.root;
    for (const part of parts.slice(0, -1)) {
        folder = join(folder, part);
        const stat = statParent(folder);
        if (!stat.isDirectory() || stat.isSymbolicLink())
            throw new Error(`A parent of ${path} is a link or is not a directory. Choose a directory without links.`);
    }
    return join(bounds.root, ...parts);
}

// A synchronous replacement must finish its flush before the caller continues.
function writeStagedFile(temporary: string, value: FileCopy): void {
    const file = openSync(temporary, 'wx', PRIVATE_FILE);
    try {
        writeFileSync(file, value.bytes);
        fchmodSync(file, value.mode);
        fsyncSync(file);
    } catch (error) {
        closeSync(file);
        unlinkSync(temporary);
        throw error;
    }
    closeSync(file);
}

// Windows cannot rename over a read-only file, so it goes first. The owner's recovery treats an absent target of an
// interrupted replacement as not written.
function isRenameBlocked(expected: FileCopy | undefined): boolean {
    if (process.platform !== 'win32' || expected === undefined || expected.isLink === true) return false;
    return (expected.mode & OWNER_WRITE_BIT) === 0;
}

/**
 * Compare only permissions represented by the host filesystem API. Windows exposes a read-only flag.
 * @param file the copy's mode and whether it holds a link.
 * @returns the mode the system can represent.
 */
export function normalizeFileMode(file: Pick<FileCopy, 'mode' | 'isLink'>): number {
    if (file.isLink) return PERMISSION_BITS;
    if (process.platform !== 'win32') return file.mode;
    if ((file.mode & OWNER_WRITE_BIT) !== 0) return WRITABLE_FILE;
    return READ_ONLY_FILE;
}

/**
 * Whether two copies hold the same bytes and the same mode as the host can represent it.
 * @param found the copy read from disk.
 * @param expected the copy the caller expects there.
 * @returns true when both do not exist or both match.
 */
export function isSameContents(found: FileCopy | undefined, expected: FileCopy | undefined): boolean {
    if (found === undefined || expected === undefined) return found === expected;
    const read = { ...found, mode: normalizeFileMode(found) };
    const requested = { ...expected, mode: normalizeFileMode(expected) };
    return isDeepStrictEqual(read, requested);
}

/**
 * The absolute path of an entry, after checking that all parents denote real directories without links.
 * @param bounds the root.
 * @param path the root-relative path.
 * @returns the absolute path.
 */
export function verifyPath(bounds: FilesState, path: string): string {
    return walkParentFolders(bounds, path, lstatSync);
}

/**
 * The absolute path of an entry, creating missing parents and refusing linked or non-directory parents.
 * @param bounds the root.
 * @param path the root-relative path.
 * @returns the absolute path after preparing its parents.
 */
export function preparePath(bounds: FilesState, path: string): string {
    return walkParentFolders(bounds, path, prepareParentFolder);
}

/**
 * Read a regular file with no other hard link, or return undefined when absent.
 * @param bounds the root.
 * @param path the root-relative path.
 * @returns the file copy.
 */
export function readEntry(bounds: FilesState, path: string): FileCopy | undefined {
    try {
        const target = verifyPath(bounds, path);
        return readRegularFile(target, lstatSync(target), path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Read a file or symbolic link without following the link, or return undefined when absent.
 * @param bounds the root.
 * @param path the root-relative path.
 * @returns the entry copy.
 */
export function readEntryKeepingLinks(bounds: FilesState, path: string): FileCopy | undefined {
    try {
        const target = verifyPath(bounds, path);
        const stat = lstatSync(target);
        return stat.isSymbolicLink() ? readSymbolicLink(target, stat) : readRegularFile(target, stat, path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Replaces the entry at a path with the copy, through a staged file renamed into place.
 * @param bounds the root.
 * @param path the root-relative path.
 * @param value the copy to write.
 * @param expected the copy the caller last saw there, or undefined for a new file.
 */
export function replaceEntry(bounds: FilesState, path: string, value: FileCopy, expected: FileCopy | undefined): void {
    const target = preparePath(bounds, path);
    const temporary = join(dirname(target), `${TEMPORARY_FILE_PREFIX}${randomUUID()}${TEMPORARY_FILE_SUFFIX}`);
    let staged = false;
    try {
        writeStagedFile(temporary, value);
        staged = true;
        if (!isSameContents(readEntry(bounds, path), expected))
            throw new Error(`Destination changed during the operation: ${path}`);
        if (isRenameBlocked(expected)) unlinkSync(target);
        renameSync(temporary, target);
        staged = false;
    } finally {
        if (staged) unlinkSync(temporary);
    }
}
