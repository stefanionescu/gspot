import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { splitSystemPath } from '#cli/system/paths.ts';
import type { FileContents } from '#cli/types/system.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';

import {
    openSync,
    closeSync,
    lstatSync,
    mkdirSync,
    fchmodSync,
    renameSync,
    type Stats,
    unlinkSync,
    readFileSync,
    readlinkSync,
    writeFileSync,
} from 'node:fs';
import {
    MODE_BITS,
    PRIVATE_FILE,
    WRITABLE_FILE,
    READ_ONLY_FILE,
    OWNER_WRITE_BIT,
    PERMISSION_BITS,
    WRITE_FAILURE_CODES,
    TEMPORARY_FILE_PREFIX,
    TEMPORARY_FILE_SUFFIX,
} from '#cli/config/system.ts';

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

function writeStagedFile(path: string, contents: FileContents): void {
    const file = openSync(path, 'wx', PRIVATE_FILE);
    try {
        writeFileSync(file, contents.bytes);
        fchmodSync(file, contents.mode);
    } catch (error) {
        closeSync(file);
        unlinkSync(path);
        throw error;
    }
    closeSync(file);
}

/**
Build the absolute path of a file after a check that every parent names a real folder, not a link.
*/
export function buildWriteError(path: string, error: unknown): unknown {
    if (WRITE_FAILURE_CODES.some((code) => hasErrorCode(error, code)))
        return new GspotError(
            'filesystem',
            `Cannot write ${path}. Check its permissions and whether the filesystem is read-only, then run the command again.`,
            { cause: error },
        );
    return error;
}

export function buildContainedPath(
    root: string,
    path: string,
    statParent: (path: string) => Stats = lstatSync,
): string {
    const segments = splitSystemPath(path);
    let folder = root;
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
    return join(root, ...segments);
}

/**
Keep only the permissions that the system file API shows. Windows shows a read-only flag.
*/
export function normalizeFileMode(file: Pick<FileContents, 'mode' | 'isSymlink'>): number {
    if (file.isSymlink) return PERMISSION_BITS;
    if (process.platform !== 'win32') return file.mode;
    return (file.mode & OWNER_WRITE_BIT) === 0 ? READ_ONLY_FILE : WRITABLE_FILE;
}

export function isSameContents(found: FileContents | undefined, expected: FileContents | undefined): boolean {
    if (found === undefined || expected === undefined) return found === expected;
    const read = { ...found, mode: normalizeFileMode(found) };
    const requested = { ...expected, mode: normalizeFileMode(expected) };
    return isDeepStrictEqual(read, requested);
}

/**
Build the absolute path of a file, create missing parents, and refuse parents that link or name no folder.
*/
export function preparePath(root: string, path: string): string {
    try {
        return buildContainedPath(root, path, prepareParentFolder);
    } catch (error) {
        throw buildWriteError(path, error);
    }
}

export function readBoundedFile(root: string, path: string): FileContents | undefined {
    try {
        const target = buildContainedPath(root, path);
        return readRegularFile(target, lstatSync(target), path);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
}

export function readBoundedKeepingLinks(root: string, path: string): FileContents | undefined {
    try {
        const target = buildContainedPath(root, path);
        const stat = lstatSync(target);
        return stat.isSymbolicLink()
            ? { bytes: Buffer.from(readlinkSync(target)), mode: PERMISSION_BITS, isSymlink: true }
            : readRegularFile(target, stat, path);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        throw error;
    }
}

export function replaceBoundedFile(root: string, path: string, contents: FileContents): void {
    const target = preparePath(root, path);
    const temporary = join(
        dirname(target),
        `${TEMPORARY_FILE_PREFIX}${String(process.pid)}-${randomUUID()}${TEMPORARY_FILE_SUFFIX}`,
    );
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
