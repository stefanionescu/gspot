// Applying plans: each batch is logged before a byte moves, so an interruption can be recovered.
import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { Read } from '#cli/types/platform.ts';
import type { originalSchema } from '#cli/lifecycle/log.ts';
import { matches, identity } from '#cli/lifecycle/ownership/log.ts';
import type { Log, Outcome, Planned, PreparedWrite } from '#cli/types/lifecycle/lifecycle.ts';

// The file as it is now, read as a link entry when either side of the plan is a link.
function foundRead(log: Log, path: string, current: Read | undefined, next: Read | undefined): Read | undefined {
    const isLink = current?.isLink === true || next?.isLink === true;
    if (isLink) return log.files.readEntry(path);
    return log.files.read(path);
}

// Refuses a plan whose file or record changed after it was made.
function assertPlanCurrent(log: Log, plan: Planned, proposed: ReadonlyMap<string, Read | undefined>): void {
    const { path, current, previous, next } = plan;
    const existing = log.entryFor(path);
    if (next !== undefined) log.files.validate(path, next, proposed);
    const found = foundRead(log, path, current, next);
    if (!isDeepStrictEqual(existing, previous) || !isDeepStrictEqual(found, current))
        throw new Error(`File changed after its plan: ${path}`);
}

// Refuses a batch that repeats a destination or holds a plan whose file changed.
function assertPlansCurrent(log: Log, plans: Planned[], proposed: ReadonlyMap<string, Read | undefined>): void {
    const destinations = new Set<string>();
    for (const plan of plans) {
        const key = plan.path.normalize('NFC').toLowerCase();
        if (destinations.has(key)) throw new Error(`Duplicate plan destination: ${plan.path}`);
        destinations.add(key);
        assertPlanCurrent(log, plan, proposed);
    }
}

// The backup of the current bytes, taken when they leave: the first ownership, a removal, or a change.
function backupFor(log: Log, plan: Planned): z.infer<typeof originalSchema> | undefined {
    const { path, current, next } = plan;
    if (current === undefined) return undefined;
    const isReplaced = plan.saveOriginal === true || next === undefined || !matches(current, identity(next));
    return isReplaced ? log.backup(path, current) : undefined;
}

// The record a changed plan writes, with the original its entry keeps.
function prepareRecord(log: Log, plan: Planned): PreparedWrite | undefined {
    const { path, current, next, entry } = plan;
    if (entry === undefined && plan.status !== 'changed') return undefined;
    const recovery = backupFor(log, plan);
    const original = plan.saveOriginal === true ? recovery : entry?.original;
    const recordedEntry =
        entry === undefined ? undefined : { ...entry, ...(original === undefined ? {} : { original }) };
    return { path, current, next, entry: recordedEntry, recovery };
}

// Writes the pending records, writes every file, and settles the log.
function write(log: Log, prepared: PreparedWrite[]): void {
    log.state.pending = prepared.map(({ path, current, next, entry, recovery }) => ({
        path,
        ...(current === undefined ? {} : { before: identity(current) }),
        ...(recovery === undefined ? {} : { beforeBackup: recovery }),
        ...(next === undefined ? {} : { after: identity(next) }),
        ...(entry === undefined ? {} : { entry }),
    }));
    log.save();
    // Publish regular targets before links, including original targets restored in this batch.
    const ordered = prepared.toSorted(
        (left, right) => Number(left.next?.isLink === true) - Number(right.next?.isLink === true),
    );
    for (const { path, current, next } of ordered) {
        if (next === undefined) {
            if (current !== undefined) log.files.remove(path, current);
        } else if (!matches(current, identity(next))) log.files.write(path, next, current);
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
        plans.map(({ path, next, current, status }) => [
            path,
            status === 'preserved' || (status === 'unchanged' && next === undefined) ? current : next,
        ]),
    );
    assertPlansCurrent(log, plans, proposed);
    const conflict = plans.find((plan) => plan.status === 'preserved');
    if (conflict !== undefined)
        throw new Error(`Preserved edited or unowned ${conflict.path}. Review that file before applying.`);
    const prepared = plans.flatMap((plan) => {
        const record = prepareRecord(log, plan);
        return record === undefined ? [] : [record];
    });
    if (prepared.length > 0) write(log, prepared);
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
    const [status] = applyPlans(log, [plan]);
    if (status === undefined) throw new Error(`Applying ${plan.path} produced no status.`);
    return status;
}
