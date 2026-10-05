// Replacing files atomically inside one root, and the lock that keeps one lifecycle writer at a time.
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { sameEntry } from '#cli/platform/root/rules.ts';
import type { Read, Bounds, Staging } from '#cli/types/platform/root.ts';
import { PRIVATE_FILE, OWNER_WRITE_BIT } from '#cli/config/platform/modes.ts';
import { readEntry, preparedPath, validateRead } from '#cli/platform/root/reads.ts';
import { LOCK_POLL_MS, LOCK_WAIT_BYTES, LOCK_INITIALIZATION_MS } from '#cli/config/platform/root.ts';

import {
    openSync,
    closeSync,
    fsyncSync,
    mkdirSync,
    rmdirSync,
    fchmodSync,
    // eslint-disable-next-line sonarjs/deprecation, n/no-deprecated-api -- reason: The `lchmod` API sets a symbolic link's own mode on macOS.
    lchmodSync,
    renameSync,
    unlinkSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';

// Writes the bytes and mode of a regular file to the staging path, which must not exist yet.
// A staging file that cannot be completed is removed before the error leaves.
function stageFile(temporary: string, value: Read): void {
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
function mustUnlinkFirst(expected: Read | undefined): boolean {
    if (process.platform !== 'win32' || expected === undefined || expected.isLink === true) return false;
    return (expected.mode & OWNER_WRITE_BIT) === 0;
}

// Moves the staged entry over the destination, after checking that the destination is still as expected.
function commitStaged(staging: Staging, expected: Read | undefined): void {
    const { bounds, path, target, temporary } = staging;
    if (!sameEntry(readEntry(bounds, path, expected?.isLink === true), expected))
        throw new Error(`Lifecycle destination changed during the operation: ${path}`);
    let removed = false;
    try {
        if (mustUnlinkFirst(expected)) {
            unlinkSync(target);
            removed = true;
        }
        renameSync(temporary, target);
    } catch (error) {
        if (removed && expected !== undefined) restoreRemoved(bounds, path, expected, error);
        throw error;
    }
}

// Puts the expected file back after a replacement that removed it failed.
function restoreRemoved(bounds: Bounds, path: string, expected: Read, error: unknown): void {
    try {
        if (readEntry(bounds, path, false) === undefined) replaceEntry(bounds, path, expected, undefined);
    } catch (restorationError) {
        throw new AggregateError([error, restorationError], `Replacement and restoration failed: ${path}`);
    }
}

// Stages the snapshot beside its destination: a file, or a link when link is set.
function stage(staging: Staging, value: Read, link: string | undefined): void {
    if (link === undefined) stageFile(staging.temporary, value);
    else writeLink(staging.temporary, link, value.mode);
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
function lockHolder(current: Read | undefined, path: string): number {
    const pid = Number(current?.bytes.toString('utf8').split(':', 1)[0]);
    if (!Number.isSafeInteger(pid) || pid <= 0)
        throw new Error(`Incomplete lifecycle lock: ${path}. Remove it after checking that no writer is running.`);
    return pid;
}

// Whether a process is still running. A process of another user refuses the signal, and runs too.
function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        const { code } = error as NodeJS.ErrnoException;
        if (code === 'EPERM') return true;
        if (code !== 'ESRCH') throw error;
        return false;
    }
}

// An empty exclusive file can be a writer between creation and its first write; wait only within its initialization budget.
function waitForLockInitialization(path: string, deadline: number, pause: Int32Array): void {
    if (Date.now() >= deadline)
        throw new Error(`Lifecycle lock is being initialized: ${path}. Retry after the writer finishes.`);
    Atomics.wait(pause, 0, 0, LOCK_POLL_MS);
}

// A separate lease prevents concurrent reclaimers from deleting a replacement writer's lock.
function retireStaleLock(bounds: Bounds, path: string, target: string): void {
    const reclaim = `${target}.reclaim`;
    try {
        mkdirSync(reclaim, { mode: 0o700 });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        throw new Error(
            `Another process is recovering ${path}. Retry after it finishes. If no gspot command is running, remove ${path}.reclaim.`,
            { cause: error },
        );
    }
    try {
        const stale = readEntry(bounds, path, false);
        if (stale !== undefined && stale.bytes.length > 0 && !isAlive(lockHolder(stale, path))) unlinkSync(target);
    } finally {
        rmdirSync(reclaim);
    }
}

/**
 * Creates a link at a path where nothing exists yet, with, on macOS, the mode the snapshot carries. The target is not
 * checked here: lifecycle writes check it first, and a revision copy keeps a tracked link wherever it points.
 * @param path the path of the new link
 * @param target the target text or bytes
 * @param mode the mode of the link itself
 */
export function writeLink(path: string, target: string | Buffer, mode: number): void {
    symlinkSync(target, path);
    if (process.platform !== 'darwin') return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-deprecated, sonarjs/deprecation -- reason: The `lchmod` API sets a symbolic link's own mode on macOS.
        lchmodSync(path, mode);
    } catch (error) {
        unlinkSync(path);
        throw error;
    }
}

/**
 * Replaces the entry at a path with the snapshot, through a staged file renamed into place.
 * @param bounds the root
 * @param path the root-relative path
 * @param value the snapshot to write
 * @param expected the snapshot the caller last saw there, or undefined for a new file
 */
export function replaceEntry(bounds: Bounds, path: string, value: Read, expected: Read | undefined): void {
    const link = validateRead(bounds, path, value);
    const target = preparedPath(bounds, path);
    const staging: Staging = {
        bounds,
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
 * @param bounds the root, which records the lock it now holds
 * @param path the root-relative path of the lock file
 */
export function acquireLock(bounds: Bounds, path: string): void {
    const target = preparedPath(bounds, path);
    const token = `${String(process.pid)}:${randomUUID()}`;
    const deadline = Date.now() + LOCK_INITIALIZATION_MS;
    const pause = new Int32Array(new SharedArrayBuffer(LOCK_WAIT_BYTES));
    while (!claimLock(target, token)) {
        const current = readEntry(bounds, path, false);
        if (current === undefined) continue;
        if (current.bytes.length === 0) {
            waitForLockInitialization(path, deadline, pause);
            continue;
        }
        const pid = lockHolder(current, path);
        if (isAlive(pid))
            throw new Error(
                `Another lifecycle writer, process ${String(pid)}, holds ${path}. Retry after it finishes, or delete ${path} when no gspot command is running.`,
            );
        retireStaleLock(bounds, path, target);
    }
    bounds.locks.set(path, token);
}
