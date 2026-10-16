// Reads, compares, and replaces one contained file or link.
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { join, posix, dirname } from 'node:path';
import { assertOutsideStateFolder } from '#cli/system/files/names.ts';
import { TEMPORARY_FILE_PREFIX, TEMPORARY_FILE_SUFFIX } from '#cli/config/system/files.ts';
import { type FileCopy, type PlannedFiles, type SafeFolderState } from '#cli/types/system/safe-folder.ts';

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
    symlinkSync,
    readFileSync,
    readlinkSync,
    writeFileSync,
} from 'node:fs';

// Create a missing parent. A competing creator may finish first.
function preparedDirectory(directory: string): Stats {
    try {
        return lstatSync(directory);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    try {
        mkdirSync(directory);
    } catch (creationError) {
        if ((creationError as NodeJS.ErrnoException).code !== 'EEXIST') throw creationError;
    }
    return lstatSync(directory);
}

// The copy of a symbolic link: its target text and its own mode.
function linkRead(target: string, stat: Stats): FileCopy {
    const bytes = Buffer.from(readlinkSync(target));
    const mode = fileMode({ mode: stat.mode & MODE_BITS, isLink: true });
    return { bytes, mode, isLink: true };
}

// The bytes and mode of a private regular file.
function fileRead(target: string, stat: Stats, path: string): FileCopy {
    if (!stat.isFile() || stat.nlink !== 1)
        throw new Error(`${path} is not a regular file with one link. Use a regular file without extra hard links.`);
    const bytes = readFileSync(target);
    return { bytes, mode: fileMode({ mode: stat.mode & MODE_BITS }) };
}

// Whether gspot refuses a link's target text: not valid UTF-8, empty, or absolute.
function isUnsafeLinkTarget(value: FileCopy, target: string): boolean {
    return !Buffer.from(target).equals(value.bytes) || target === '' || target.startsWith('/');
}

// Refuses a link with a missing destination or another link as its destination, reading proposed files before the disk.
function assertLinkDestination(
    bounds: SafeFolderState,
    path: string,
    destination: string,
    plannedFiles?: PlannedFiles,
): void {
    const targetFile =
        plannedFiles?.has(destination) === true ? plannedFiles.get(destination) : readEntry(bounds, destination, false);
    if (targetFile === undefined)
        throw new Error(`The link target for ${path} is missing. Restore the target or remove the link.`);
    if (targetFile.isLink) throw new Error(`The link target for ${path} is not a regular file. Choose a regular file.`);
}

// Check the same parent directories before a read or a prepared write.
function checkParents(bounds: SafeFolderState, path: string, statParent: (path: string) => Stats): string {
    const parts = bounds.partsOf(path);
    let directory = bounds.root;
    for (const part of parts.slice(0, -1)) {
        directory = join(directory, part);
        const stat = statParent(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink())
            throw new Error(`A parent of ${path} is a link or is not a directory. Choose a directory without links.`);
    }
    return join(bounds.root, ...parts);
}

// A synchronous replacement must finish its flush before the caller continues.
function flushFile(temporary: string, value: FileCopy): void {
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
function mustUnlinkFirst(expected: FileCopy | undefined): boolean {
    if (process.platform !== 'win32' || expected === undefined || expected.isLink === true) return false;
    return (expected.mode & OWNER_WRITE_BIT) === 0;
}

/**
 * Compare only permissions represented by the host filesystem API. Windows exposes a read-only flag.
 * @param file the copy's mode and whether it holds a link.
 * @returns the mode the system can represent.
 */
export function fileMode(file: Pick<FileCopy, 'mode' | 'isLink'>): number {
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
export function sameEntry(found: FileCopy | undefined, expected: FileCopy | undefined): boolean {
    if (found === undefined || expected === undefined) return found === expected;
    const read = { ...found, mode: fileMode(found) };
    const requested = { ...expected, mode: fileMode(expected) };
    return isDeepStrictEqual(read, requested);
}

/**
 * The absolute path of an entry, after checking that all parents denote real directories without links.
 * @param bounds the root.
 * @param path the root-relative path.
 * @returns the absolute path.
 */
export function checkedPath(bounds: SafeFolderState, path: string): string {
    return checkParents(bounds, path, lstatSync);
}

/**
 * The absolute path of an entry, creating missing parents and refusing linked or non-directory parents.
 * @param bounds the root.
 * @param path the root-relative path.
 * @returns the absolute path after preparing its parents.
 */
export function preparedPath(bounds: SafeFolderState, path: string): string {
    return checkParents(bounds, path, preparedDirectory);
}

/**
 * The copy at a path, or undefined for a missing entry.
 * @param bounds the root.
 * @param path the root-relative path.
 * @param allowLink whether to read a symbolic link rather than refuse it.
 * @returns the copy.
 */
export function readEntry(bounds: SafeFolderState, path: string, allowLink: boolean): FileCopy | undefined {
    try {
        const target = checkedPath(bounds, path);
        const stat = lstatSync(target);
        if (allowLink && stat.isSymbolicLink()) return linkRead(target, stat);
        return fileRead(target, stat, path);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Checks a copy's path and, for a link, its target, requiring a normalized relative path to a regular file
 * inside the root.
 * @param bounds the root.
 * @param path the root-relative path.
 * @param value the copy.
 * @param plannedFiles planned file writes, consulted before the disk for a link's destination.
 * @returns the link target text, or undefined for a regular file.
 */
export function validateCopy(
    bounds: SafeFolderState,
    path: string,
    value: FileCopy,
    plannedFiles?: PlannedFiles,
): string | undefined {
    bounds.partsOf(path);
    if (!value.isLink) return undefined;
    const target = value.bytes.toString('utf8');
    if (isUnsafeLinkTarget(value, target))
        throw new Error(`${path} has an unsafe link target. Use a relative path inside the repository.`);
    const destination = posix.join(posix.dirname(path), target);
    bounds.partsOf(destination);
    assertOutsideStateFolder(destination);
    if (posix.relative(posix.dirname(path), destination) !== target)
        throw new Error(
            `The link target for ${path} is not a normalized relative path. Remove dot and parent segments.`,
        );
    assertLinkDestination(bounds, path, destination, plannedFiles);
    return target;
}

/**
 * Create a symbolic link after the caller validates its target.
 * @param path the path of the new link.
 * @param target the target text or bytes.
 */
export function writeLink(path: string, target: string | Buffer): void {
    symlinkSync(target, path);
}

/**
 * Replaces the entry at a path with the copy, through a staged file renamed into place.
 * @param bounds the root.
 * @param path the root-relative path.
 * @param value the copy to write.
 * @param expected the copy the caller last saw there, or undefined for a new file.
 */
export function replaceEntry(
    bounds: SafeFolderState,
    path: string,
    value: FileCopy,
    expected: FileCopy | undefined,
): void {
    const link = validateCopy(bounds, path, value);
    const target = preparedPath(bounds, path);
    const temporary = join(dirname(target), `${TEMPORARY_FILE_PREFIX}${randomUUID()}${TEMPORARY_FILE_SUFFIX}`);
    let staged = false;
    try {
        if (link === undefined) flushFile(temporary, value);
        else writeLink(temporary, link);
        staged = true;
        if (!sameEntry(readEntry(bounds, path, expected?.isLink === true), expected))
            throw new Error(`Destination changed during the operation: ${path}`);
        if (mustUnlinkFirst(expected)) unlinkSync(target);
        renameSync(temporary, target);
        staged = false;
    } finally {
        if (staged) unlinkSync(temporary);
    }
}
