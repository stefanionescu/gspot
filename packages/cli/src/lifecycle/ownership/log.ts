// The durable ownership log an owner works from: its records and its recovery of an interrupted mutation.
import { createHash } from 'node:crypto';
import { PRIVATE_FILE } from '#cli/config/platform.ts';
import { ownershipSchema } from '#cli/lifecycle/log.ts';
import type { Read, Root } from '#cli/types/platform.ts';
import { OUTPUT_JSON_INDENT } from '#cli/config/output.ts';
import { fileMode, mutationTarget } from '#cli/platform/safe-paths.ts';

import type {
    Log,
    Identity,
    OwnershipEntry,
    OwnershipState,
    PendingOwnership,
} from '#cli/types/lifecycle/lifecycle.ts';

// Settles one interrupted mutation: accepted when it completed, left unwritten when the file is as before or gone,
// refused when edited. A Windows replacement removes a read-only file before its rename, so a crash can leave none.
function recoverPending(files: Root, pending: PendingOwnership, accept: (pending: PendingOwnership) => void): void {
    const isLink = [pending.before, pending.after].some((entry) => entry?.isLink === true);
    const current = isLink ? files.readEntry(pending.path) : files.read(pending.path);
    if (matches(current, pending.after)) {
        accept(pending);
        return;
    }
    if (current !== undefined && !matches(current, pending.before))
        throw new Error(
            `Interrupted lifecycle operation conflicts with edited ${pending.path}. Resolve that file before retrying.`,
        );
}

// The recorded ownership state, or an empty one when nothing was recorded yet.
function readState(recorded: Read | undefined): OwnershipState {
    if (recorded === undefined) return { version: 1, files: [] };
    return ownershipSchema.parse(JSON.parse(recorded.bytes.toString('utf8')));
}

// The recorded entry of a path, refusing a record under another spelling of the same path.
function recordedEntry(entries: Map<string, OwnershipEntry>, path: string): OwnershipEntry | undefined {
    const entry = entries.get(path.normalize('NFC').toLowerCase());
    if (entry !== undefined && entry.path !== path)
        throw new Error(`Lifecycle path aliases recorded ${entry.path}: ${path}`);
    return entry;
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
        for (const pending of state.pending) recoverPending(files, pending, accept);
        delete state.pending;
        save();
    }
    return {
        files,
        state,
        save,
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
