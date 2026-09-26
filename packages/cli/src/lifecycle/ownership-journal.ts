// The durable ownership journal an owner works from: its records, its recovery of an interrupted mutation, and
// the backups it takes before a file changes hands.
import type { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { ownershipSchema } from '#cli/lifecycle/journal.ts';
import { fileMode, mutationTarget } from '#cli/platform/filesystem.ts';
import type { ConfinedRoot, FileSnapshot } from '#cli/platform/filesystem.ts';
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

// Settles one interrupted mutation: accepted when it completed, restored when the file vanished, refused when edited.
function recoverPending(
    confined: ConfinedRoot,
    pending: Pending,
    accept: (pending: Pending) => void,
    recovery: string,
): void {
    const isLink = pending.before?.isLink === true || pending.after?.isLink === true;
    const current = isLink ? confined.readEntry(pending.path) : confined.read(pending.path);
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
    const actual = identity(file);
    return actual.hash === expected.hash && actual.mode === expected.mode && actual.isLink === expected.isLink;
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
    const state: OwnershipState =
        recorded === undefined
            ? { version: 1, files: [] }
            : ownershipSchema.parse(JSON.parse(recorded.bytes.toString('utf8')));
    const entries = new Map(state.files.map((entry) => [entry.path.normalize('NFC').toLowerCase(), entry]));
    const save = (): void => {
        state.files = [...entries.values()];
        ownershipSchema.parse(state);
        const next = { bytes: Buffer.from(`${JSON.stringify(state, null, 2)}\n`), mode: PRIVATE_FILE };
        confined.write(record, next, recorded);
        recorded = next;
    };
    const accept = (pending: Pending): void => {
        const key = pending.path.normalize('NFC').toLowerCase();
        if (pending.entry === undefined) entries.delete(key);
        else entries.set(key, pending.entry);
    };
    if (state.pending !== undefined) {
        const ordered = state.pending.toSorted(
            (left, right) => Number(left.before?.isLink === true) - Number(right.before?.isLink === true),
        );
        for (const pending of ordered) recoverPending(confined, pending, accept, recovery);
        delete state.pending;
        save();
    }
    const operation = `${recovery}/${randomUUID()}`;
    let isRecoveryReady = false;
    return {
        confined,
        state,
        save,
        backup(path, file) {
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
        },
        find(path) {
            if (state.pending !== undefined)
                throw new Error(
                    'An interrupted mutation must be recovered before another operation. Reopen the lifecycle owner.',
                );
            mutationTarget(path);
            const entry = entries.get(path.normalize('NFC').toLowerCase());
            if (entry !== undefined && entry.path !== path)
                throw new Error(`Lifecycle path aliases recorded ${entry.path}: ${path}`);
            return entry;
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
    find(path: string): OwnershipEntry | undefined;
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
