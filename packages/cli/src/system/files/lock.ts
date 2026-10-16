// Claims writer locks and recovers abandoned locks.
import { posix } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PRIVATE_FILE, PRIVATE_DIRECTORY } from '#cli/config/system/modes.ts';
import type { FileCopy, SafeFolderState } from '#cli/types/system/safe-folder.ts';
import { readEntry, checkedPath, preparedPath } from '#cli/system/files/entries.ts';
import { linkSync, mkdirSync, rmdirSync, unlinkSync, readdirSync, writeFileSync } from 'node:fs';
import { LOCK_TOKEN_SEPARATOR, LOCK_RECOVERY_SUFFIX, TEMPORARY_FILE_SUFFIX } from '#cli/config/system/files.ts';

// Creates the lock file with the token, or returns false when another holder already owns the file.
function tryLock(target: string, token: string): boolean {
    const temporary = `${target}.${randomUUID()}${TEMPORARY_FILE_SUFFIX}`;
    writeFileSync(temporary, token, { flag: 'wx', mode: PRIVATE_FILE });
    try {
        linkSync(temporary, target);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        return false;
    } finally {
        unlinkSync(temporary);
    }
}

// Refuses an incomplete lock or one whose process still runs; retire only abandoned locks.
function assertAbandonedLock(current: FileCopy, path: string): void {
    const pid = Number(current.bytes.toString('utf8').split(LOCK_TOKEN_SEPARATOR, 1)[0]);
    try {
        process.kill(pid, 0);
    } catch (error) {
        const { code } = error as NodeJS.ErrnoException;
        if (code === 'ESRCH') return;
        if (code !== 'EPERM') throw error;
    }
    throw new Error(
        `Another gspot command, process ${String(pid)}, holds ${path}. Retry after it finishes, or delete ${path} when no gspot command is running.`,
    );
}

// A separate lease prevents concurrent reclaimers from deleting a replacement writer's lock.
function removeStaleLock(bounds: SafeFolderState, path: string, target: string): void {
    const reclaim = `${target}${LOCK_RECOVERY_SUFFIX}`;
    try {
        mkdirSync(reclaim, { mode: PRIVATE_DIRECTORY });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        throw new Error(
            `Another process is recovering ${path}. Retry after it finishes. If no gspot command is running, remove ${path}${LOCK_RECOVERY_SUFFIX}.`,
            { cause: error },
        );
    }
    try {
        const stale = readEntry(bounds, path, false);
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
 * @param bounds the directory and its safe path rules.
 */
export function releaseLocks(bounds: SafeFolderState): void {
    for (const [path, holder] of bounds.locks) {
        if (readEntry(bounds, path, false)?.bytes.toString('utf8') !== holder) continue;
        unlinkSync(checkedPath(bounds, path));
        for (let folder = posix.dirname(path); folder !== '.'; folder = posix.dirname(folder)) {
            if (readdirSync(checkedPath(bounds, folder)).length > 0) break;
            rmdirSync(checkedPath(bounds, folder));
        }
    }
    bounds.locks.clear();
}

/**
 * Takes the writer lock at a path, clearing one whose holder has exited and refusing one whose holder runs.
 * @param bounds the root, which records the lock it now holds.
 * @param path the root-relative path of the lock file.
 */
export function takeLock(bounds: SafeFolderState, path: string): void {
    const target = preparedPath(bounds, path);
    const token = `${String(process.pid)}${LOCK_TOKEN_SEPARATOR}${randomUUID()}`;
    while (!tryLock(target, token)) {
        const current = readEntry(bounds, path, false);
        if (current === undefined) continue;
        assertAbandonedLock(current, path);
        removeStaleLock(bounds, path, target);
    }
    bounds.locks.set(path, token);
}
