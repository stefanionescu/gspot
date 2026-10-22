// Reads, compares, and replaces one contained file or link.
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { type FileBounds, type FileContents } from '#cli/types/system/files.ts';
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
        if (!hasErrorCode(error, 'ENOENT')) throw error;
    }
    try {
        mkdirSync(folder);
    } catch (creationError) {
        if (!hasErrorCode(creationError, 'EEXIST')) throw creationError;
    }
    return lstatSync(folder);
}

// Read the bytes and mode of a regular file with one link.
function readRegularFile(absolutePath: string, stat: Stats, path: string): FileContents {
    if (!stat.isFile() || stat.nlink !== 1)
        throw new GspotError(
            'filesystem',
            `${path} is not a regular file with one link. Use a regular file without extra hard links.`,
        );
    const bytes = readFileSync(absolutePath);
    return { bytes, mode: normalizeFileMode({ mode: stat.mode & MODE_BITS }) };
}

// Check the same parent folders before a read or a prepared write.
function walkParentFolders(bounds: FileBounds, path: string, statParent: (path: string) => Stats): string {
    const parts = splitSystemPath(path);
    let folder = bounds.root;
    for (const part of parts.slice(0, -1)) {
        folder = join(folder, part);
        const stat = statParent(folder);
        if (!stat.isDirectory() || stat.isSymbolicLink())
            throw new GspotError(
                'filesystem',
                `A parent of ${path} is a link or is not a folder. Choose a folder without links.`,
            );
    }
    return join(bounds.root, ...parts);
}

// A synchronous replacement must finish its flush before the caller continues.
function writeStagedFile(temporary: string, contents: FileContents): void {
    const file = openSync(temporary, 'wx', PRIVATE_FILE);
    try {
        writeFileSync(file, contents.bytes);
        fchmodSync(file, contents.mode);
        fsyncSync(file);
    } catch (error) {
        closeSync(file);
        unlinkSync(temporary);
        throw error;
    }
    closeSync(file);
}

// Windows cannot rename over a read-only file, so that file goes first. Recovery after an interrupted replacement
// treats an absent destination as not written.
function isRenameBlocked(expected: FileContents | undefined): boolean {
    if (process.platform !== 'win32' || expected === undefined || expected.isLink === true) return false;
    return (expected.mode & OWNER_WRITE_BIT) === 0;
}

/**
 * Keep only the permissions that the system file API shows. Windows shows a read-only flag.
 *
 * @param file the mode, and whether it holds a link.
 * @returns the mode the system can represent.
 */
export function normalizeFileMode(file: Pick<FileContents, 'mode' | 'isLink'>): number {
    if (file.isLink) return PERMISSION_BITS;
    if (process.platform !== 'win32') return file.mode;
    if ((file.mode & OWNER_WRITE_BIT) !== 0) return WRITABLE_FILE;
    return READ_ONLY_FILE;
}

/**
 * Check whether two file contents hold the same bytes and the same mode, as far as the system can show it.
 *
 * @param found the file contents on disk.
 * @param expected the file contents that the caller expects.
 * @returns true when neither exists or both match.
 */
export function isSameContents(found: FileContents | undefined, expected: FileContents | undefined): boolean {
    if (found === undefined || expected === undefined) return found === expected;
    const read = { ...found, mode: normalizeFileMode(found) };
    const requested = { ...expected, mode: normalizeFileMode(expected) };
    return isDeepStrictEqual(read, requested);
}

/**
 * Build the absolute path of a file after a check that every parent names a real folder, not a link.
 *
 * @param bounds the root.
 * @param path the root-relative file.
 * @returns the absolute path.
 */
export function buildContainedPath(bounds: FileBounds, path: string): string {
    return walkParentFolders(bounds, path, lstatSync);
}

/**
 * Build the absolute path of a file, create missing parents, and refuse parents that link or name no folder.
 *
 * @param bounds the root.
 * @param path the root-relative file.
 * @returns the absolute path after preparing its parents.
 */
export function preparePath(bounds: FileBounds, path: string): string {
    return walkParentFolders(bounds, path, prepareParentFolder);
}

/**
 * Read a regular file with no other hard link, or return undefined when absent.
 *
 * @param bounds the root.
 * @param path the root-relative file.
 * @returns the file contents.
 */
export function readEntry(bounds: FileBounds, path: string): FileContents | undefined {
    try {
        const target = buildContainedPath(bounds, path);
        return readRegularFile(target, lstatSync(target), path);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
}

/**
 * Read a file or symbolic link without following the link, or return undefined when absent.
 *
 * @param bounds the root.
 * @param path the root-relative file.
 * @returns the file contents.
 */
export function readEntryKeepingLinks(bounds: FileBounds, path: string): FileContents | undefined {
    try {
        const target = buildContainedPath(bounds, path);
        const stat = lstatSync(target);
        // Read the file contents of a symbolic link: the path it points to, and its own mode.
        return stat.isSymbolicLink()
            ? { bytes: Buffer.from(readlinkSync(target)), mode: PERMISSION_BITS, isLink: true }
            : readRegularFile(target, stat, path);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
}

/**
 * Replace the file at a path with new file contents, through a staged file that moves into place.
 *
 * @param bounds the root.
 * @param path the root-relative file.
 * @param contents the file contents to write.
 * @param expected the file contents that the caller last saw, or undefined for a new file.
 */
export function replaceEntry(
    bounds: FileBounds,
    path: string,
    contents: FileContents,
    expected: FileContents | undefined,
): void {
    const target = preparePath(bounds, path);
    const temporary = join(dirname(target), `${TEMPORARY_FILE_PREFIX}${randomUUID()}${TEMPORARY_FILE_SUFFIX}`);
    let staged = false;
    try {
        writeStagedFile(temporary, contents);
        staged = true;
        if (!isSameContents(readEntry(bounds, path), expected))
            throw new GspotError('filesystem', `${path} changed while gspot wrote it. Run the command again.`);
        if (isRenameBlocked(expected)) unlinkSync(target);
        renameSync(temporary, target);
        staged = false;
    } finally {
        if (staged) unlinkSync(temporary);
    }
}
