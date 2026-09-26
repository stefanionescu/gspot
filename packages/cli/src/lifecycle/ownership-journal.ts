// The durable ownership journal an owner works from: its records, its recovery of an interrupted mutation, and
// the backups it takes before a file changes hands.
import type { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { ownershipSchema } from '#cli/lifecycle/journal.ts';
import type { ConfinedRoot } from '#cli/platform/filesystem.ts';
import type { FileSnapshot } from '#cli/platform/safe-paths.ts';
import { fileMode, mutationTarget } from '#cli/platform/safe-paths.ts';
import { PRIVATE_DIRECTORY, PRIVATE_FILE } from '#cli/platform/file-modes.ts';
import type { OwnershipEntry, OwnershipState, identitySchema, originalSchema } from '#cli/lifecycle/journal.ts';

type Identity = z.infer<typeof identitySchema>;
type Original = z.infer<typeof originalSchema>;
type Pending = NonNullable<OwnershipState['pending']>[number];

// Restores the file an interrupted replacement removed, from the backup the journal recorded for it.
function restoreFromBackup(confined: ConfinedRoot, pending: Pending, backup: Original): void {
    const saved = confined.read(backup.backup);
    if (saved === undefined || identity(saved).hash !== backup.hash)
        throw new Error(`Interrupted replacement backup is missing or changed: ${pending.path}`);
    confined.write(
        pending.path,
        { bytes: saved.bytes, mode: backup.mode, ...(backup.isLink ? { isLink: true } : {}) },
        undefined,
    );
}

// The file an interrupted mutation touched, read as a link when either side of the mutation was one.
function currentOf(confined: ConfinedRoot, pending: Pending): FileSnapshot | undefined {
    const isLink = pending.before?.isLink === true || pending.after?.isLink === true;
    return isLink ? confined.readEntry(pending.path) : confined.read(pending.path);
}

// Settles one interrupted mutation: accepted when it completed, restored when the file vanished, refused when edited.
function recoverPending(
    confined: ConfinedRoot,
    pending: Pending,
    accept: (pending: Pending) => void,
    recovery: string,
): void {
    const current = currentOf(confined, pending);
    if (matches(current, pending.after)) {
        accept(pending);
        return;
    }
    if (current === undefined && pending.beforeBackup !== undefined) {
        restoreFromBackup(confined, pending, pending.beforeBackup);
        return;
    }
    if (!matches(current, pending.before))
        throw new Error(
            `Interrupted lifecycle operation conflicts with edited ${pending.path}. Preserve ${recovery} and resolve that file before retrying.`,
        );
}

// The key a path is recorded under, so two spellings of one path cannot both be recorded.
function normalizedKey(path: string): string {
    return path.normalize('NFC').toLowerCase();
}

// The recorded ownership state, or an empty one when nothing was recorded yet.
function readState(recorded: FileSnapshot | undefined): OwnershipState {
    if (recorded === undefined) return { version: 1, files: [] };
    return ownershipSchema.parse(JSON.parse(recorded.bytes.toString('utf8')));
}

// Settles every interrupted mutation, regular files before links so a restored link finds its target.
function recoverAll(
    confined: ConfinedRoot,
    pending: Pending[],
    accept: (pending: Pending) => void,
    recovery: string,
): void {
    const ordered = pending.toSorted(
        (left, right) => Number(left.before?.isLink === true) - Number(right.before?.isLink === true),
    );
    for (const entry of ordered) recoverPending(confined, entry, accept, recovery);
}

// The recorded entry of a path, refusing a record under another spelling of the same path.
function recordedEntry(entries: Map<string, OwnershipEntry>, path: string): OwnershipEntry | undefined {
    const entry = entries.get(normalizedKey(path));
    if (entry !== undefined && entry.path !== path)
        throw new Error(`Lifecycle path aliases recorded ${entry.path}: ${path}`);
    return entry;
}

// Writes backups into one recovery folder per operation, created on the first backup.
function backupWriter(confined: ConfinedRoot, recovery: string): Journal['backup'] {
    const operation = `${recovery}/${randomUUID()}`;
    let isRecoveryReady = false;
    return (path, file) => {
        if (!isRecoveryReady) {
            confined.mkdir(recovery, PRIVATE_DIRECTORY);
            confined.mkdir(operation, PRIVATE_DIRECTORY);
            isRecoveryReady = true;
        }
        const destination = `${operation}/${randomUUID()}.original`;
        confined.write(destination, { bytes: file.bytes, mode: PRIVATE_FILE }, undefined);
        const details = { path, backup: destination, ...identity(file) };
        confined.write(
            `${destination}.json`,
            { bytes: Buffer.from(`${JSON.stringify(details)}\n`), mode: PRIVATE_FILE },
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
export function identity(file: FileSnapshot): Identity {
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
export function matches(file: FileSnapshot | undefined, expected: Identity | undefined): boolean {
    if (file === undefined) return expected === undefined;
    if (expected === undefined) return false;
    const found = identity(file);
    return found.hash === expected.hash && found.mode === expected.mode && found.isLink === expected.isLink;
}

/**
 * Reads the journal under a locked root, recovers any interrupted mutation, and prepares the next operation.
 * @param confined the locked root the journal lives under
 * @param stateDirectory the directory under the root that holds the journal
 * @returns the journal
 */
export function openJournal(confined: ConfinedRoot, stateDirectory: string): Journal {
    const record = `${stateDirectory}/ownership.json`;
    const recovery = `${stateDirectory}/recovery`;
    let recorded = confined.read(record);
    const state = readState(recorded);
    const entries = new Map(state.files.map((entry) => [normalizedKey(entry.path), entry]));
    const save = (): void => {
        state.files = [...entries.values()];
        ownershipSchema.parse(state);
        const next = { bytes: Buffer.from(`${JSON.stringify(state, null, 2)}\n`), mode: PRIVATE_FILE };
        confined.write(record, next, recorded);
        recorded = next;
    };
    const accept = (pending: Pending): void => {
        const key = normalizedKey(pending.path);
        if (pending.entry === undefined) entries.delete(key);
        else entries.set(key, pending.entry);
    };
    if (state.pending !== undefined) {
        recoverAll(confined, state.pending, accept, recovery);
        delete state.pending;
        save();
    }
    const backups = backupWriter(confined, recovery);
    return {
        confined,
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
        finish() {
            for (const pending of state.pending ?? []) accept(pending);
            delete state.pending;
            save();
        },
    };
}

/** The open journal: the locked root, the recorded state, and the operations that read and write it. */
export type Journal = {
    confined: ConfinedRoot;
    state: OwnershipState;
    save(): void;
    backup(path: string, file: FileSnapshot): Original;
    entryFor(path: string): OwnershipEntry | undefined;
    finish(): void;
};

/** What one operation proposes for one file: the file now, its record, the outcome, and what to write. */
export type FileProposal = {
    path: string;
    current: FileSnapshot | undefined;
    previous: OwnershipEntry | undefined;
    status: 'changed' | 'unchanged' | 'preserved';
    next?: FileSnapshot;
    entry?: OwnershipEntry;
    saveOriginal?: boolean;
};
