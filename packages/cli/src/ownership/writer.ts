import { posix } from 'node:path';
import { contentDigest } from '#cli/text.ts';
import { pathKey } from '#cli/system/paths.ts';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { sameEntry } from '#cli/system/safe-folder/reads.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import { ownershipStateSchema } from '#cli/ownership/log-schema.ts';
import { assertWritablePath } from '#cli/system/safe-folder/names.ts';
import type { FileCopy, SafeFolder } from '#cli/types/system/safe-folder.ts';

import {
    WRITER_LOCK_FILE,
    OWNERSHIP_LOG_FILE,
    OWNERSHIP_JSON_INDENT,
    OWNERSHIP_LOG_VERSION,
} from '#cli/config/ownership.ts';
import type {
    Identity,
    WritePlan,
    OwnedFile,
    OwnershipLog,
    PendingWrite,
    OwnershipState,
} from '#cli/types/ownership.ts';

// Settle an interrupted mutation: accept a completed write, retain original or absent files,
// refused when edited. A Windows replacement removes a read-only file before its rename, so a crash can leave none.
function recoverPending(files: SafeFolder, pending: PendingWrite, accept: (pending: PendingWrite) => void): void {
    const isLink = [pending.before, pending.after].some((entry) => entry?.isLink === true);
    const current = isLink ? files.readKeepingLinks(pending.path) : files.read(pending.path);
    if (isRecorded(current, pending.after)) {
        accept(pending);
        return;
    }
    if (current !== undefined && !isRecorded(current, pending.before))
        throw new Error(
            `A previous gspot run stopped while writing ${pending.path}, and the file changed since then. Fix it by hand, then run the command again.`,
        );
}

// Read saved ownership, or start with empty ownership.
function parseOwnershipState(recorded: FileCopy | undefined): OwnershipState {
    if (recorded === undefined) return { version: OWNERSHIP_LOG_VERSION, files: [] };
    return ownershipStateSchema.parse(JSON.parse(recorded.bytes.toString('utf8')));
}

// The recorded entry of a path, refusing a record under another spelling of the same path.
function findOwnedFile(entries: Map<string, OwnedFile>, path: string): OwnedFile | undefined {
    const entry = entries.get(pathKey(path));
    if (entry !== undefined && entry.path !== path)
        throw new Error(
            `Generated file ${entry.path} is now written as ${path}, which differs only by letter case and is one file on some systems. Rename it to a third name and run gspot apply, then rename it to the new spelling and run gspot apply again.`,
        );
    return entry;
}

/**
 * Reads the log under a locked root, recovers any interrupted mutation, and prepares the next operation.
 *
 * @param files the locked root the log lives under.
 *
 * @returns the log.
 */
function openLog(files: SafeFolder): OwnershipLog {
    const logPath = OWNERSHIP_LOG_FILE;
    let recorded = files.read(logPath);
    const state = parseOwnershipState(recorded);
    const entries = new Map(state.files.map((entry) => [pathKey(entry.path), entry]));
    const save = (): void => {
        state.files = [...entries.values()];
        const parsed = ownershipStateSchema.parse(state);
        const next = {
            bytes: Buffer.from(`${JSON.stringify(parsed, null, OWNERSHIP_JSON_INDENT)}\n`),
            mode: PRIVATE_FILE,
        };
        files.write(logPath, next, recorded);
        recorded = next;
    };
    const accept = (pending: PendingWrite): void => {
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
        [Symbol.dispose]: files[Symbol.dispose],
        files,
        state,
        save,
        entryFor(path) {
            assertWritablePath(path);
            return findOwnedFile(entries, path);
        },
        finish() {
            for (const pending of state.pending ?? []) accept(pending);
            delete state.pending;
            save();
        },
    };
}

// Removes the folders a removed file leaves empty, from its own up to the repository root.
function removeEmptyFolders(log: OwnershipLog, path: string): void {
    for (let folder = posix.dirname(path); folder !== '.'; folder = posix.dirname(folder)) {
        if (log.files.list(folder).length > 0) return;
        log.files.rmdir(folder);
    }
}

// Writes the pending records, writes every file, and settles the log.
function writeBatch(log: OwnershipLog, prepared: WritePlan[]): void {
    log.state.pending = prepared.map(({ path, before, after, entry }) => ({
        path,
        ...(before === undefined ? {} : { before: identify(before) }),
        ...(after === undefined ? {} : { after: identify(after) }),
        ...(entry === undefined ? {} : { entry }),
    }));
    log.save();
    // Publish regular targets before links, so a link finds its target.
    const ordered = prepared.toSorted(
        (left, right) => Number(left.after?.isLink === true) - Number(right.after?.isLink === true),
    );
    for (const { path, before, after } of ordered) {
        if (after === undefined) {
            if (before !== undefined) {
                log.files.remove(path, before);
                removeEmptyFolders(log, path);
            }
        } else if (!sameEntry(before, after)) log.files.write(path, after, before);
    }
    log.finish();
}

/**
 * Compute the identity for recording and comparing a copy.
 *
 * @param file the copy.
 *
 * @returns its hash and link status.
 */
export function identify(file: FileCopy): Identity {
    return {
        hash: contentDigest(file.bytes),
        ...(file.isLink ? { isLink: true as const } : {}),
    };
}

/**
 * Compare a file with its recorded identity, including absence.
 *
 * @param file the file as currently read, or undefined for an absent path.
 * @param expected the recorded identity, or undefined without a saved identity.
 *
 * @returns whether they agree.
 */
export function isRecorded(file: FileCopy | undefined, expected: Identity | undefined): boolean {
    if (file === undefined) return expected === undefined;
    if (expected === undefined) return false;
    const found = identify(file);
    return found.hash === expected.hash && found.isLink === expected.isLink;
}

/**
 * Opens one locked ownership log and recovers interrupted file writes.
 *
 * @param root the repository root.
 *
 * @returns the context, which the command disposes.
 */
export function openWriter(root: string): OwnershipLog {
    using resources = new DisposableStack();
    const files = resources.use(openSafeFolder(root));
    files.claim(WRITER_LOCK_FILE);
    const log = openLog(files);
    resources.move();
    return log;
}

/**
 * Reads ownership without creating a claim or writing files.
 *
 * @param root the repository root.
 *
 * @returns the saved state, or empty ownership for a new repository.
 */
export function readOwnershipLog(root: string): OwnershipState {
    using files = openSafeFolder(root);
    return parseOwnershipState(files.read(OWNERSHIP_LOG_FILE));
}

/**
 * Applies a batch of plans as one logged mutation, refusing any that preserves a file.
 *
 * @param log the open log.
 * @param plans the plans, each for a distinct file.
 */
export function applyPlans(log: OwnershipLog, plans: WritePlan[]): void {
    const plannedFiles = new Map(
        plans.map(({ path, after, before, status }) => [
            path,
            status === 'preserved' || (status === 'unchanged' && after === undefined) ? before : after,
        ]),
    );
    for (const plan of plans) {
        if (plan.after !== undefined) log.files.validate(plan.path, plan.after, plannedFiles);
    }
    const conflict = plans.find((plan) => plan.status === 'preserved');
    if (conflict !== undefined) throw notOverwrittenError([conflict.path], 'retry the command');
    // A plan writes when it changes the file or records a new entry.
    const prepared = plans.filter((plan) => plan.entry !== undefined || plan.status === 'changed');
    if (prepared.length > 0) writeBatch(log, prepared);
}

/**
 * Explain preserved files and the command to retry after moving them aside.
 *
 * @param paths the repository-relative path patterns.
 * @param command the executable and argument list.
 *
 * @returns the preservation error with its repair command.
 */
export function notOverwrittenError(paths: string[], command: string): Error {
    return new Error(
        `These files were not overwritten by gspot: ${paths.join(', ')}. Move them aside, then ${command}.`,
    );
}
