// Applying plans: each batch is logged before a byte moves, so an interruption can be recovered.
import { isDeepStrictEqual } from 'node:util';
import type { Read } from '#cli/types/platform.ts';
import { matches, identity } from '#cli/lifecycle/ownership/log.ts';
import type { Log, Outcome, Planned } from '#cli/types/lifecycle/lifecycle.ts';

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

// Writes the pending records, writes every file, and settles the log.
function write(log: Log, prepared: Planned[]): void {
    log.state.pending = prepared.map(({ path, current, next, entry }) => ({
        path,
        ...(current === undefined ? {} : { before: identity(current) }),
        ...(next === undefined ? {} : { after: identity(next) }),
        ...(entry === undefined ? {} : { entry }),
    }));
    log.save();
    // Publish regular targets before links, so a link finds its target.
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
    // A plan writes when it changes the file or records a new entry.
    const prepared = plans.filter((plan) => plan.entry !== undefined || plan.status === 'changed');
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
