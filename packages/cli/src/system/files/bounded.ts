import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { type FileBounds, type FileContents } from '#cli/types/system/files.ts';
import { GspotError, hasErrorCode, buildWriteError } from '#cli/system/errors.ts';
import { MODE_BITS, PRIVATE_FILE, PERMISSION_BITS } from '#cli/config/files/modes.ts';

import {
    WRITABLE_FILE,
    READ_ONLY_FILE,
    OWNER_WRITE_BIT,
    TEMPORARY_FILE_SUFFIX,
    TEMPORARY_FILE_PREFIX,
} from '#cli/config/system/files/bounded.ts';
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

function readRegularFile(absolutePath: string, stat: Stats, path: string): FileContents {
    if (!stat.isFile()) throw new GspotError('filesystem', `${path} is not a regular file. Use a regular file.`);
    const bytes = readFileSync(absolutePath);
    return { bytes, mode: normalizeFileMode({ mode: stat.mode & MODE_BITS }) };
}

function walkParentFolders(bounds: FileBounds, path: string, statParent: (path: string) => Stats): string {
    const segments = splitSystemPath(path);
    let folder = bounds.root;
    const parents = segments.slice(0, -1);
    for (const segment of parents) {
        folder = join(folder, segment);
        const stat = statParent(folder);
        if (!stat.isDirectory() || stat.isSymbolicLink())
            throw new GspotError(
                'filesystem',
                `A parent of ${path} is a link or is not a folder. Choose a folder without links.`,
            );
    }
    return join(bounds.root, ...segments);
}

function writeStagedFile(path: string, contents: FileContents): void {
    const file = openSync(path, 'wx', PRIVATE_FILE);
    try {
        writeFileSync(file, contents.bytes);
        fchmodSync(file, contents.mode);
        fsyncSync(file);
    } catch (error) {
        closeSync(file);
        unlinkSync(path);
        throw error;
    }
    closeSync(file);
}

/**
Keep only the permissions that the system file API shows. Windows shows a read-only flag.

@param file the mode, and whether it holds a link.
@returns the mode the system can represent.
*/
export function normalizeFileMode(file: Pick<FileContents, 'mode' | 'isSymlink'>): number {
    if (file.isSymlink) return PERMISSION_BITS;
    if (process.platform !== 'win32') return file.mode;
    return (file.mode & OWNER_WRITE_BIT) === 0 ? READ_ONLY_FILE : WRITABLE_FILE;
}

/**
Check whether two file contents hold the same bytes and the same mode, as far as the system can show it.

@param found the file contents on disk.
@param expected the file contents that the caller expects.
@returns true when neither exists or both match.
*/
export function isSameContents(found: FileContents | undefined, expected: FileContents | undefined): boolean {
    if (found === undefined || expected === undefined) return found === expected;
    const read = { ...found, mode: normalizeFileMode(found) };
    const requested = { ...expected, mode: normalizeFileMode(expected) };
    return isDeepStrictEqual(read, requested);
}

/**
Build the absolute path of a file after a check that every parent names a real folder, not a link.

@param bounds the root.
@param path the root-relative file.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: This operation supplies lstatSync to the parent walker for its callers.
export function buildContainedPath(bounds: FileBounds, path: string): string {
    return walkParentFolders(bounds, path, lstatSync);
}

/**
Build the absolute path of a file, create missing parents, and refuse parents that link or name no folder.

@param bounds the root.
@param path the root-relative file.
*/
export function preparePath(bounds: FileBounds, path: string): string {
    try {
        return walkParentFolders(bounds, path, prepareParentFolder);
    } catch (error) {
        throw buildWriteError(path, error);
    }
}

/**
Read a regular file, or return undefined when absent.

@param bounds the root.
@param path the root-relative file.
*/
export function readBounded(bounds: FileBounds, path: string): FileContents | undefined {
    try {
        const target = buildContainedPath(bounds, path);
        return readRegularFile(target, lstatSync(target), path);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
}

/**
Read a file or symbolic link without following the link, or return undefined when absent.

@param bounds the root.
@param path the root-relative file.
*/
export function readBoundedKeepingLinks(bounds: FileBounds, path: string): FileContents | undefined {
    try {
        const target = buildContainedPath(bounds, path);
        const stat = lstatSync(target);
        return stat.isSymbolicLink()
            ? { bytes: Buffer.from(readlinkSync(target)), mode: PERMISSION_BITS, isSymlink: true }
            : readRegularFile(target, stat, path);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
}

/**
Replace the file at a path with new file contents, through a staged file that moves into place.

@param bounds the root.
@param path the root-relative file.
@param contents the file contents to write.
*/
export function replaceBounded(bounds: FileBounds, path: string, contents: FileContents): void {
    const target = preparePath(bounds, path);
    const temporary = join(dirname(target), `${TEMPORARY_FILE_PREFIX}${randomUUID()}${TEMPORARY_FILE_SUFFIX}`);
    let isStaged = false;
    try {
        writeStagedFile(temporary, contents);
        isStaged = true;
        const onDisk = process.platform === 'win32' ? lstatSync(target, { throwIfNoEntry: false }) : undefined;
        if (onDisk?.isFile() === true && (onDisk.mode & OWNER_WRITE_BIT) === 0) unlinkSync(target);
        renameSync(temporary, target);
        isStaged = false;
    } catch (error) {
        throw buildWriteError(path, error);
    } finally {
        if (isStaged) unlinkSync(temporary);
    }
}
