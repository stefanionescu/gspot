// Lock managed writes and release their locks.
import { randomUUID } from 'node:crypto';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { PRIVATE_FILE, PRIVATE_FOLDER } from '#cli/config/system/modes.ts';
import type { FilesState, FileContents } from '#cli/types/system/files.ts';
import { readEntry, verifyPath, preparePath } from '#cli/system/files/entries.ts';
import { linkSync, mkdirSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { LOCK_TOKEN_SEPARATOR, LOCK_RECOVERY_SUFFIX, TEMPORARY_FILE_SUFFIX } from '#cli/config/system/files.ts';

// Creates the lock file with the token, or returns false when another holder already owns the file.
function writeLockFile(target: string, token: string): boolean {
    const temporary = `${target}.${randomUUID()}${TEMPORARY_FILE_SUFFIX}`;
    writeFileSync(temporary, token, { flag: 'wx', mode: PRIVATE_FILE });
    try {
        linkSync(temporary, target);
        return true;
    } catch (error) {
        if (!hasErrorCode(error, 'EEXIST')) throw error;
        return false;
    } finally {
        unlinkSync(temporary);
    }
}

// Refuse a lock unless its holder has exited.
function assertAbandonedLock(current: FileContents, path: string): void {
    const pid = Number(current.bytes.toString('utf8').split(LOCK_TOKEN_SEPARATOR, 1)[0]);
    if (!Number.isSafeInteger(pid) || pid <= 0)
        throw new GspotError(
            'filesystem',
            `${path} names no gspot process. Delete ${path} when no gspot command is running.`,
        );
    try {
        process.kill(pid, 0);
    } catch (error) {
        if (hasErrorCode(error, 'ESRCH')) return;
        if (!hasErrorCode(error, 'EPERM')) throw error;
    }
    throw new GspotError(
        'filesystem',
        `Another gspot command, process ${String(pid)}, holds ${path}. Retry after it finishes, or delete ${path} when no gspot command is running.`,
    );
}

// A separate lease stops two reclaimers from deleting the lock of a new writer.
function removeStaleLock(bounds: FilesState, path: string, target: string): void {
    const reclaim = `${target}${LOCK_RECOVERY_SUFFIX}`;
    try {
        mkdirSync(reclaim, { mode: PRIVATE_FOLDER });
    } catch (error) {
        if (!hasErrorCode(error, 'EEXIST')) throw error;
        throw new GspotError(
            'filesystem',
            `Another process is recovering ${path}. Retry after it finishes. If no gspot command is running, remove ${path}${LOCK_RECOVERY_SUFFIX}.`,
            { cause: error },
        );
    }
    try {
        const stale = readEntry(bounds, path);
        if (stale !== undefined) {
            assertAbandonedLock(stale, path);
            unlinkSync(target);
        }
    } finally {
        rmdirSync(reclaim);
    }
}

/**
 * Release every lock claimed through this safe folder.
 *
 * @param bounds the root and its held locks.
 * @returns the paths of released locks for parent-folder cleanup.
 */
export function releaseLocks(bounds: FilesState): string[] {
    const released: string[] = [];
    for (const [path, holder] of bounds.locks) {
        if (readEntry(bounds, path)?.bytes.toString('utf8') !== holder) continue;
        unlinkSync(verifyPath(bounds, path));
        released.push(path);
    }
    bounds.locks.clear();
    return released;
}

/**
 * Take the writer lock at a path. Clear a lock whose holder has exited, and refuse one whose holder still runs.
 *
 * @param bounds the root, which records the lock it now holds.
 * @param path the root-relative lock file.
 */
export function lockForWriting(bounds: FilesState, path: string): void {
    const target = preparePath(bounds, path);
    const token = `${String(process.pid)}${LOCK_TOKEN_SEPARATOR}${randomUUID()}`;
    while (!writeLockFile(target, token)) {
        const current = readEntry(bounds, path);
        if (current === undefined) continue;
        assertAbandonedLock(current, path);
        removeStaleLock(bounds, path, target);
    }
    bounds.locks.set(path, token);
}
