// Replacing files under a confined root atomically, and the lock that keeps one lifecycle writer at a time.
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { sameSnapshot } from '#cli/platform/safe-paths.ts';
// Writes the bytes and mode of a regular file to the staging path, which must not exist yet.
import { OWNER_WRITE_BIT, PRIVATE_FILE } from '#cli/constants/platform.ts';
import type { Staging, Confinement, FileSnapshot } from '#cli/types/platform.ts';
import { readEntry, resolveParent, validateSnapshot } from '#cli/platform/confined-reads.ts';

import {
    closeSync,
    fchmodSync,
    fsyncSync,
    // eslint-disable-next-line sonarjs/deprecation, n/no-deprecated-api -- lchmod is the one call that sets a link's own mode on macOS
    lchmodSync,
    openSync,
    renameSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';

// A staging file that cannot be completed is removed before the error leaves.
function stageFile(temporary: string, value: FileSnapshot): void {
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

// Creates the link at the staging path with, on macOS, the mode the snapshot carries.
function stageLink(temporary: string, link: string, value: FileSnapshot): void {
    symlinkSync(link, temporary);
    if (process.platform !== 'darwin') return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- lchmod is the one call that sets a link's own mode on macOS
        lchmodSync(temporary, value.mode);
    } catch (error) {
        unlinkSync(temporary);
        throw error;
    }
}

// Windows cannot rename over a read-only file. The owner journals its saved bytes before this removal,
// so an interrupted replacement can restore the absent target.
function mustUnlinkFirst(expected: FileSnapshot | undefined): boolean {
    if (process.platform !== 'win32' || expected === undefined || expected.isLink === true) return false;
    return (expected.mode & OWNER_WRITE_BIT) === 0;
}

// Moves the staged entry over the destination, after checking that the destination is still as expected.
function commitStaged(staging: Staging, expected: FileSnapshot | undefined): void {
    const { confinement, path, target, temporary } = staging;
    if (!sameSnapshot(readEntry(confinement, path, expected?.isLink === true), expected))
        throw new Error(`Lifecycle destination changed during the operation: ${path}`);
    let removed = false;
    try {
        if (mustUnlinkFirst(expected)) {
            unlinkSync(target);
            removed = true;
        }
        renameSync(temporary, target);
    } catch (error) {
        if (removed && expected !== undefined) restoreRemoved(confinement, path, expected, error);
        throw error;
    }
}

// Puts the expected file back after a replacement that removed it failed.
function restoreRemoved(confinement: Confinement, path: string, expected: FileSnapshot, error: unknown): void {
    try {
        if (readEntry(confinement, path, false) === undefined) writeSnapshot(confinement, path, expected, undefined);
    } catch (restorationError) {
        throw new AggregateError([error, restorationError], `Replacement and restoration failed: ${path}`);
    }
}

// Stages the snapshot beside its destination, returning whether a file now exists at the staging path.
function stage(staging: Staging, value: FileSnapshot, link: string | undefined): void {
    if (link === undefined) stageFile(staging.temporary, value);
    else stageLink(staging.temporary, link, value);
}

// Creates the lock file with the token, or returns false when another holder's file is already there.
function claimLock(target: string, token: string): boolean {
    try {
        writeFileSync(target, token, { flag: 'wx', mode: PRIVATE_FILE });
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        return false;
    }
}

// The process id a lock file records, refusing a lock that records none.
function lockHolder(current: FileSnapshot | undefined, path: string): number {
    const pid = Number(current?.bytes.toString('utf8').split(':', 1)[0]);
    if (!Number.isSafeInteger(pid) || pid <= 0)
        throw new Error(`Incomplete lifecycle lock: ${path}. Remove it after checking that no writer is running.`);
    return pid;
}

// Whether a process is still running.
function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
        return false;
    }
}

// Removes a lock whose holder has exited, when the file is still the one that was read.
function releaseStale(confinement: Confinement, path: string, target: string, current: FileSnapshot | undefined): void {
    if (isDeepStrictEqual(current, readEntry(confinement, path, false))) unlinkSync(target);
}

/**
 * Replaces the entry at a path with the snapshot, through a staged file renamed into place.
 * @param confinement the root
 * @param path the confined path
 * @param value the snapshot to write
 * @param expected the snapshot the caller last saw there, or undefined for a new file
 */
export function writeSnapshot(
    confinement: Confinement,
    path: string,
    value: FileSnapshot,
    expected: FileSnapshot | undefined,
): void {
    const link = validateSnapshot(confinement, path, value);
    const target = resolveParent(confinement, path, true);
    const staging: Staging = {
        confinement,
        path,
        target,
        temporary: join(dirname(target), `.gspot-${randomUUID()}.tmp`),
    };
    let staged = false;
    try {
        stage(staging, value, link);
        staged = true;
        commitStaged(staging, expected);
        staged = false;
    } finally {
        if (staged) unlinkSync(staging.temporary);
    }
}

/**
 * Takes the writer lock at a path, clearing one whose holder has exited and refusing one whose holder runs.
 * @param confinement the root, which records the lock it now holds
 * @param path the confined path of the lock file
 */
export function acquireLock(confinement: Confinement, path: string): void {
    const target = resolveParent(confinement, path, true);
    const token = `${String(process.pid)}:${randomUUID()}`;
    for (;;) {
        if (claimLock(target, token)) {
            confinement.locks.set(path, token);
            return;
        }
        const current = readEntry(confinement, path, false);
        if (isAlive(lockHolder(current, path)))
            throw new Error('Another lifecycle writer holds this repository. Retry after it finishes.');
        releaseStale(confinement, path, target, current);
    }
}
