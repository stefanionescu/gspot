// The durable ownership log an owner works from: its records, its recovery of an interrupted mutation, and
// the backups it takes before a file changes hands.
import { createHash, randomUUID } from 'node:crypto';
import { ownershipSchema } from '#cli/lifecycle/log.ts';
import type { Read, Root } from '#cli/types/platform.ts';
import { OUTPUT_JSON_INDENT } from '#cli/config/output.ts';
import { fileMode, mutationTarget } from '#cli/platform/safe-paths.ts';
import { GSPOT_FOLDER, PRIVATE_FILE, PRIVATE_DIRECTORY } from '#cli/config/platform.ts';

import type {
    Log,
    Identity,
    Original,
    OwnershipEntry,
    OwnershipState,
    PendingOwnership,
} from '#cli/types/lifecycle/lifecycle.ts';

// Restores the file an interrupted replacement removed, from the backup the log recorded for it.
function restoreFromBackup(files: Root, pending: PendingOwnership, backup: Original): void {
    const saved = files.read(backup.backup);
    if (saved === undefined || identity(saved).hash !== backup.hash)
        throw new Error(`Interrupted replacement backup is missing or changed: ${pending.path}`);
    files.write(
        pending.path,
        { bytes: saved.bytes, mode: backup.mode, ...(backup.isLink ? { isLink: true } : {}) },
        undefined,
    );
}

// Settles one interrupted mutation: accepted when it completed, restored when the file vanished, refused when edited.
function recoverPending(
    files: Root,
    pending: PendingOwnership,
    accept: (pending: PendingOwnership) => void,
    recovery: string,
): void {
    const isLink = [pending.before, pending.after].some((entry) => entry?.isLink === true);
    const current = isLink ? files.readEntry(pending.path) : files.read(pending.path);
    if (matches(current, pending.after)) {
        accept(pending);
        return;
    }
    if (current === undefined && pending.beforeBackup !== undefined) {
        restoreFromBackup(files, pending, pending.beforeBackup);
        return;
    }
    if (!matches(current, pending.before))
        throw new Error(
            `Interrupted lifecycle operation conflicts with edited ${pending.path}. Preserve ${recovery} and resolve that file before retrying.`,
        );
}

// Deletes the backups of one operation folder that no entry keeps, and the folder once it is empty.
function pruneOperation(files: Root, folder: string, kept: Set<string>): void {
    for (const name of files.list(folder)) {
        const path = `${folder}/${name}`;
        const current = kept.has(path.replace(/\.json$/u, '')) ? undefined : files.read(path);
        if (current !== undefined) files.remove(path, current);
    }
    if (files.list(folder).length === 0) files.rmdir(folder);
}

// Deletes every backup no entry keeps as its original. A finished operation needs none of its own backups: they
// only guard an interrupted one.
function pruneRecovery(files: Root, recovery: string, entries: Iterable<OwnershipEntry>): void {
    if (files.stat(recovery)?.isDirectory() !== true) return;
    const kept = new Set(
        [...entries].flatMap((entry) => (entry.original === undefined ? [] : [entry.original.backup])),
    );
    for (const operation of files.list(recovery)) {
        const folder = `${recovery}/${operation}`;
        if (files.stat(folder)?.isDirectory() === true) pruneOperation(files, folder, kept);
    }
}

// The recorded ownership state, or an empty one when nothing was recorded yet.
function readState(recorded: Read | undefined): OwnershipState {
    if (recorded === undefined) return { version: 1, files: [] };
    return ownershipSchema.parse(JSON.parse(recorded.bytes.toString('utf8')));
}

// Settles every interrupted mutation, regular files before links so a restored link finds its target.
function recoverAll(
    files: Root,
    pending: PendingOwnership[],
    accept: (pending: PendingOwnership) => void,
    recovery: string,
): void {
    const ordered = pending.toSorted(
        (left, right) => Number(left.before?.isLink === true) - Number(right.before?.isLink === true),
    );
    for (const entry of ordered) recoverPending(files, entry, accept, recovery);
}

// The recorded entry of a path, refusing a record under another spelling of the same path.
function recordedEntry(entries: Map<string, OwnershipEntry>, path: string): OwnershipEntry | undefined {
    const entry = entries.get(path.normalize('NFC').toLowerCase());
    if (entry !== undefined && entry.path !== path)
        throw new Error(`Lifecycle path aliases recorded ${entry.path}: ${path}`);
    return entry;
}

// Writes backups into one recovery folder per operation, created on the first backup.
function backupWriter(files: Root, recovery: string): Log['backup'] {
    const operation = `${recovery}/${randomUUID()}`;
    let isRecoveryReady = false;
    return (path, file) => {
        if (!isRecoveryReady) {
            files.mkdir(recovery, PRIVATE_DIRECTORY);
            files.mkdir(operation, PRIVATE_DIRECTORY);
            isRecoveryReady = true;
        }
        const destination = `${operation}/${randomUUID()}.original`;
        files.write(destination, { bytes: file.bytes, mode: PRIVATE_FILE }, undefined);
        const backupRecord = { path, backup: destination, ...identity(file) };
        files.write(
            `${destination}.json`,
            { bytes: Buffer.from(`${JSON.stringify(backupRecord)}\n`), mode: PRIVATE_FILE },
            undefined,
        );
        return { backup: destination, ...identity(file) };
    };
}

/**
 * The identity a snapshot is recorded and compared by.
 * @param file the snapshot
 * @returns its hash, mode, and whether it is a link
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The ownership log records and compares a file by this one identity: hash, mode, and link flag.
export function identity(file: Read): Identity {
    return {
        hash: createHash('sha256').update(file.bytes).digest('hex'),
        mode: fileMode(file),
        ...(file.isLink ? { isLink: true as const } : {}),
    };
}

/**
 * Whether a file is the one an identity records, with absence matching absence.
 * @param file the file as it is now, or undefined when it does not exist
 * @param expected the recorded identity, or undefined when none was recorded
 * @returns whether they agree
 */
export function matches(file: Read | undefined, expected: Identity | undefined): boolean {
    if (file === undefined) return expected === undefined;
    if (expected === undefined) return false;
    const found = identity(file);
    return found.hash === expected.hash && found.mode === expected.mode && found.isLink === expected.isLink;
}

/**
 * Reads the log under a locked root, recovers any interrupted mutation, and prepares the next operation.
 * @param files the locked root the log lives under
 * @param stateDirectory the directory under the root that holds the log
 * @returns the log
 */
export function openLog(files: Root, stateDirectory: string): Log {
    const record = `${stateDirectory}/ownership.json`;
    const recovery = `${stateDirectory}/recovery`;
    let recorded = files.read(record);
    const state = readState(recorded);
    const entries = new Map(state.files.map((entry) => [entry.path.normalize('NFC').toLowerCase(), entry]));
    const save = (): void => {
        state.files = [...entries.values()];
        ownershipSchema.parse(state);
        const next = { bytes: Buffer.from(`${JSON.stringify(state, null, OUTPUT_JSON_INDENT)}\n`), mode: PRIVATE_FILE };
        files.write(record, next, recorded);
        recorded = next;
    };
    const accept = (pending: PendingOwnership): void => {
        const key = pending.path.normalize('NFC').toLowerCase();
        if (pending.entry === undefined) entries.delete(key);
        else entries.set(key, pending.entry);
    };
    if (state.pending !== undefined) {
        recoverAll(files, state.pending, accept, recovery);
        delete state.pending;
        save();
    }
    // A retired file of the .gspot folder keeps only an original, an older gspot output: nothing authored lives
    // there, so uninstall must not bring it back.
    const retired = [...entries.entries()].filter(
        ([, entry]) => entry.installed === undefined && entry.path.startsWith(`${GSPOT_FOLDER}/`),
    );
    for (const [key] of retired) entries.delete(key);
    if (retired.length > 0) save();
    pruneRecovery(files, recovery, entries.values());
    const backups = backupWriter(files, recovery);
    return {
        files,
        state,
        save,
        backup: backups,
        entryFor(path) {
            if (state.pending !== undefined)
                throw new Error(
                    'An interrupted mutation must be recovered before another operation. Reopen the lifecycle owner.',
                );
            mutationTarget(path);
            return recordedEntry(entries, path);
        },
        forget(path) {
            entries.delete(path.normalize('NFC').toLowerCase());
        },
        finish() {
            for (const pending of state.pending ?? []) accept(pending);
            delete state.pending;
            save();
            pruneRecovery(files, recovery, entries.values());
        },
    };
}
