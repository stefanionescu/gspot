// Writes files and links without replacing changed source files.
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { PRIVATE_FILE, OWNER_WRITE_BIT } from '#cli/config/system/modes.ts';
import type { FileCopy, SafeFolderState } from '#cli/types/system/safe-folder.ts';
import { TEMPORARY_FILE_PREFIX, TEMPORARY_FILE_SUFFIX } from '#cli/config/system/safe-folder.ts';
import { readEntry, sameEntry, preparedPath, validateCopy } from '#cli/system/safe-folder/reads.ts';

import {
    openSync,
    closeSync,
    fsyncSync,
    unlinkSync,
    fchmodSync,
    renameSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';

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
