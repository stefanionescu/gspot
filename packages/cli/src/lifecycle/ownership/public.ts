import { posix } from 'node:path';
import { openRoot } from '#cli/platform/root/public.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import type { Planned } from '#cli/types/lifecycle/apply.ts';
import { STATE_DIRECTORY } from '#cli/config/platform/locations.ts';
import { pathKey, contentDigest } from '#cli/platform/contracts.ts';
import { OWNERSHIP_JSON_INDENT } from '#cli/config/lifecycle/ownership.ts';
import { ownershipSchema } from '#cli/lifecycle/ownership/state/contracts.ts';
import { recoverInstallations } from '#cli/lifecycle/ownership/state/public.ts';
import type { Root, FileCopy, PlannedFiles } from '#cli/types/platform/root.ts';
import { sameEntry, assertMutationTarget } from '#cli/platform/root/contracts.ts';

import type {
    Log,
    Outcome,
    Identity,
    Ownership,
    OwnershipEntry,
    PendingOwnership,
} from '#cli/types/lifecycle/ownership.ts';

// Settles one interrupted mutation: accepted when it completed, left unwritten when the file is as before or gone,
// refused when edited. A Windows replacement removes a read-only file before its rename, so a crash can leave none.
function recoverPending(files: Root, pending: PendingOwnership, accept: (pending: PendingOwnership) => void): void {
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
            bytes: Buffer.from(`${JSON.stringify(parsed, null, OWNERSHIP_JSON_INDENT)}\n`),
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
        [Symbol.dispose]: files[Symbol.dispose],
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

// Validates destination paths and refuses a batch that repeats a destination.
function validatePlans(log: Log, plans: Planned[], plannedFiles: PlannedFiles): void {
    const destinations = new Set<string>();
    for (const plan of plans) {
        const key = pathKey(plan.path);
        if (destinations.has(key)) throw new Error(`Duplicate plan destination: ${plan.path}`);
        destinations.add(key);
        if (plan.after !== undefined) log.files.validate(plan.path, plan.after, plannedFiles);
    }
}

// Removes the folders a removed file leaves empty, from its own up to the repository root.
function removeEmptyFolders(log: Log, path: string): void {
    for (let folder = posix.dirname(path); folder !== '.'; folder = posix.dirname(folder)) {
        if (log.files.list(folder).length > 0) return;
        log.files.rmdir(folder);
    }
}

// Writes the pending records, writes every file, and settles the log.
function writeBatch(log: Log, prepared: Planned[]): void {
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
 * The identity a copy is recorded and compared by.
 * @param file the copy
 * @returns its hash and whether it is a link
 */
export function identify(file: FileCopy): Identity {
    return {
        hash: contentDigest(file.bytes),
        ...(file.isLink ? { isLink: true as const } : {}),
    };
}

/**
 * Whether a file is the one an identity records, with absence matching absence.
 * @param file the file as it is now, or undefined when it does not exist
 * @param expected the recorded identity, or undefined when none was recorded
 * @returns whether they agree
 */
export function isRecorded(file: FileCopy | undefined, expected: Identity | undefined): boolean {
    if (file === undefined) return expected === undefined;
    if (expected === undefined) return false;
    const found = identify(file);
    return found.hash === expected.hash && found.isLink === expected.isLink;
}

/**
 * Opens one locked ownership context and recovers interrupted writes and installations.
 * @param root the repository root
 * @returns the context, which the command disposes
 */
export function openOwnership(root: string): Log {
    using resources = new DisposableStack();
    const files = resources.use(openRoot(root));
    files.claim(`${STATE_DIRECTORY}/writer.lock`);
    const log = openLog(files);
    recoverInstallations(log);
    resources.move();
    return log;
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
 * Applies a batch of plans as one logged mutation, refusing any that preserves a file.
 * @param log the open log
 * @param plans the plans, each for a distinct file
 * @returns the outcome of each plan, in order
 */
export function applyPlans(log: Log, plans: Planned[]): Outcome[] {
    const plannedFiles = new Map(
        plans.map(({ path, after, before, status }) => [
            path,
            status === 'preserved' || (status === 'unchanged' && after === undefined) ? before : after,
        ]),
    );
    validatePlans(log, plans, plannedFiles);
    const conflict = plans.find((plan) => plan.status === 'preserved');
    if (conflict !== undefined)
        throw new Error(
            `The file ${conflict.path} was not overwritten by gspot. Move it aside, then retry the command.`,
        );
    // A plan writes when it changes the file or records a new entry.
    const prepared = plans.filter((plan) => plan.entry !== undefined || plan.status === 'changed');
    if (prepared.length > 0) writeBatch(log, prepared);
    return plans.map((plan) => plan.status);
}

/**
 * Applies one plan, which yields its outcome or is preserved without a write.
 * @param log the open log
 * @param plan the plan
 * @returns its outcome
 */
export function applyPlan(log: Log, plan: Planned): Outcome {
    if (plan.status === 'preserved') return 'preserved';
    applyPlans(log, [plan]);
    return plan.status;
}
