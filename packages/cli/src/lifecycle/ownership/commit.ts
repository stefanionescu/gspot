// Applying plans: each batch is logged before a byte moves, so an interruption can be recovered.
import { posix } from 'node:path';
import { pathKey } from '#cli/platform/paths.ts';
import { sameEntry } from '#cli/platform/root/rules.ts';
import { identify } from '#cli/lifecycle/ownership/log.ts';
import type { Proposed } from '#cli/types/platform/root.ts';
import type { Planned } from '#cli/types/lifecycle/apply.ts';
import type { Log, Outcome } from '#cli/types/lifecycle/ownership.ts';

// Validates destination paths and refuses a batch that repeats a destination.
function validatePlans(log: Log, plans: Planned[], proposed: Proposed): void {
    const destinations = new Set<string>();
    for (const plan of plans) {
        const key = pathKey(plan.path);
        if (destinations.has(key)) throw new Error(`Duplicate plan destination: ${plan.path}`);
        destinations.add(key);
        if (plan.after !== undefined) log.files.validate(plan.path, plan.after, proposed);
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
 * Applies a batch of plans as one logged mutation, refusing any that preserves a file.
 * @param log the open log
 * @param plans the plans, each for a distinct file
 * @returns the outcome of each plan, in order
 */
export function applyPlans(log: Log, plans: Planned[]): Outcome[] {
    const proposed = new Map(
        plans.map(({ path, after, before, status }) => [
            path,
            status === 'preserved' || (status === 'unchanged' && after === undefined) ? before : after,
        ]),
    );
    validatePlans(log, plans, proposed);
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
