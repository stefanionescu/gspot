// The durable ownership log an owner works from: its records and its recovery of an interrupted mutation.
import { pathKey } from '#cli/platform/paths.ts';
import { contentDigest } from '#cli/platform/text.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { Root, FileCopy } from '#cli/types/platform/root.ts';
import { STATE_DIRECTORY } from '#cli/config/platform/locations.ts';
import { ownershipSchema } from '#cli/lifecycle/ownership/schema.ts';
import { OUTPUT_JSON_INDENT } from '#cli/config/lifecycle/ownership.ts';
import { fileMode, assertMutationTarget } from '#cli/platform/root/rules.ts';
import { recoverInstallations } from '#cli/lifecycle/ownership/installations.ts';
import { PRIVATE_FILE, READ_ONLY_FILE, OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import type { Log, Identity, Ownership, OwnershipEntry, PendingOwnership } from '#cli/types/lifecycle/ownership.ts';

// Settles one interrupted mutation: accepted when it completed, left unwritten when the file is as before or gone,
// refused when edited. A Windows replacement removes a read-only file before its rename, so a crash can leave none.
function recoverPending(files: Root, pending: PendingOwnership, accept: (pending: PendingOwnership) => void): void {
    const isLink = [pending.before, pending.after].some((entry) => entry?.isLink === true);
    const current = isLink ? files.readKeepingLinks(pending.path) : files.read(pending.path);
    if (isMatch(current, pending.after)) {
        accept(pending);
        return;
    }
    if (current !== undefined && !isMatch(current, pending.before))
        throw new Error(
            `A previous gspot run stopped while writing ${pending.path}, and the file changed since then. Fix it by hand, then run the command again.`,
        );
}

// The recorded ownership state, or an empty one when nothing was recorded yet.
function parseOwnership(recorded: FileCopy | undefined): Ownership {
    if (recorded === undefined) return { version: 1, files: [] };
    return ownershipSchema.parse(JSON.parse(recorded.bytes.toString('utf8')));
}

// The recorded entry of a path, refusing a record under another spelling of the same path.
function getEntry(entries: Map<string, OwnershipEntry>, path: string): OwnershipEntry | undefined {
    const entry = entries.get(pathKey(path));
    if (entry !== undefined && entry.path !== path)
        throw new Error(
            `Generated file ${entry.path} is now written as ${path}, which differs only by letter case and is one file on some systems. Rename it to a third name and run gspot apply, then rename it to the new spelling and run gspot apply again.`,
        );
    return entry;
}

/**
 * Reads the log under a locked root, recovers any interrupted mutation, and prepares the next operation.
 * @param files the locked root the log lives under
 * @returns the log
 */
function openLog(files: Root): Log {
    const logPath = `${STATE_DIRECTORY}/ownership.json`;
    let recorded = files.read(logPath);
    const state = parseOwnership(recorded);
    const entries = new Map(state.files.map((entry) => [pathKey(entry.path), entry]));
    const save = (): void => {
        state.files = [...entries.values()];
        const parsed = ownershipSchema.parse(state);
        const next = {
            bytes: Buffer.from(`${JSON.stringify(parsed, null, OUTPUT_JSON_INDENT)}\n`),
            mode: PRIVATE_FILE,
        };
        files.write(logPath, next, recorded);
        recorded = next;
    };
    const accept = (pending: PendingOwnership): void => {
        const key = pathKey(pending.path);
        if (pending.entry === undefined) entries.delete(key);
        else entries.set(key, pending.entry);
    };
    if (state.pending !== undefined) {
        for (const pending of state.pending) recoverPending(files, pending, accept);
        delete state.pending;
        save();
    }
    return {
        [Symbol.dispose]() {
            files.close();
        },
        files,
        state,
        save,
        entryFor(path) {
            if (state.pending !== undefined)
                throw new Error(
                    'An interrupted mutation must be recovered before another operation. Reopen the lifecycle owner.',
                );
            assertMutationTarget(path);
            return getEntry(entries, path);
        },
        finish() {
            for (const pending of state.pending ?? []) accept(pending);
            delete state.pending;
            save();
        },
    };
}

/**
 * The identity a copy is recorded and compared by.
 * @param file the copy
 * @returns its hash, mode, and whether it is a link
 */
export function identify(file: FileCopy): Identity {
    return {
        hash: contentDigest(file.bytes),
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
export function isMatch(file: FileCopy | undefined, expected: Identity | undefined): boolean {
    if (file === undefined) return expected === undefined;
    if (expected === undefined) return false;
    const found = identify(file);
    return found.hash === expected.hash && found.mode === expected.mode && found.isLink === expected.isLink;
}

/**
 * Whether a file is the one gspot recorded. A Git checkout of a read-only file counts: it holds the same bytes
 * with mode 0644 where gspot wrote 0444.
 * @param file the file as it is now, or undefined when it does not exist
 * @param recorded the recorded identity, or undefined when none was recorded
 * @returns whether the file is unedited
 */
export function isRecorded(file: FileCopy | undefined, recorded: Identity | undefined): boolean {
    if (isMatch(file, recorded)) return true;
    if (file === undefined || recorded === undefined || file.isLink === true || recorded.isLink === true) return false;
    const found = identify(file);
    return (
        found.hash === recorded.hash &&
        recorded.mode === READ_ONLY_FILE &&
        found.mode === fileMode({ mode: OWNER_WRITABLE_FILE })
    );
}

/**
 * Opens one locked ownership context and recovers interrupted writes and installations.
 * @param root the repository root
 * @returns the context, which the command disposes
 */
export function openOwnership(root: string): Log {
    const files = openRoot(root);
    try {
        files.claim(`${STATE_DIRECTORY}/writer.lock`);
        const log = openLog(files);
        recoverInstallations(log);
        return log;
    } catch (error) {
        files.close();
        throw error;
    }
}

/**
 * Reads ownership without creating a claim or writing files.
 * @param root the repository root
 * @returns the saved state, or empty ownership for a new repository
 */
export function getOwnership(root: string): Ownership {
    using files = openRoot(root);
    return parseOwnership(files.read(`${STATE_DIRECTORY}/ownership.json`));
}

/**
 * Keeps Git's writable checkout mode when the generated bytes match a recorded read-only file.
 * @param proposed the generated file
 * @param current the current file
 * @returns the copy to write
 */
export function preserveMode(proposed: FileCopy, current: FileCopy | undefined): FileCopy {
    const mode = current !== undefined && isRecorded(current, identify(proposed)) ? current.mode : fileMode(proposed);
    return { bytes: proposed.bytes, mode };
}
