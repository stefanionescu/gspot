// Applying proposals: each batch is logged before a byte moves, so an interruption can be recovered.
import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { originalSchema } from '#cli/lifecycle/log.ts';
import type { FileObservation } from '#cli/types/platform.ts';
import { matches, identity } from '#cli/lifecycle/ownership/log.ts';
import type { Log, Outcome, FileProposal, PreparedWrite } from '#cli/types/lifecycle/lifecycle.ts';

// The file as it is now, read as a link entry when either side of the proposal is a link.
function foundObservation(
    log: Log,
    path: string,
    current: FileObservation | undefined,
    next: FileObservation | undefined,
): FileObservation | undefined {
    const isLink = current?.isLink === true || next?.isLink === true;
    if (isLink) return log.files.readEntry(path);
    return log.files.read(path);
}

// Refuses a proposal whose file or record changed after it was made.
function assertProposalCurrent(
    log: Log,
    proposal: FileProposal,
    proposed: ReadonlyMap<string, FileObservation | undefined>,
): void {
    const { path, current, previous, next } = proposal;
    const existing = log.entryFor(path);
    if (next !== undefined) log.files.validate(path, next, proposed);
    const found = foundObservation(log, path, current, next);
    if (!isDeepStrictEqual(existing, previous) || !isDeepStrictEqual(found, current))
        throw new Error(`File changed after its proposal: ${path}`);
}

// Refuses a batch that repeats a destination or holds a proposal whose file changed.
function assertProposalsCurrent(
    log: Log,
    proposals: FileProposal[],
    proposed: ReadonlyMap<string, FileObservation | undefined>,
): void {
    const destinations = new Set<string>();
    for (const proposal of proposals) {
        const key = proposal.path.normalize('NFC').toLowerCase();
        if (destinations.has(key)) throw new Error(`Duplicate proposal destination: ${proposal.path}`);
        destinations.add(key);
        assertProposalCurrent(log, proposal, proposed);
    }
}

// The backup of the current bytes, taken when they leave: the first ownership, a removal, or a change.
function backupFor(log: Log, proposal: FileProposal): z.infer<typeof originalSchema> | undefined {
    const { path, current, next } = proposal;
    if (current === undefined) return undefined;
    const isReplaced = proposal.saveOriginal === true || next === undefined || !matches(current, identity(next));
    return isReplaced ? log.backup(path, current) : undefined;
}

// The record a changed proposal writes, with the original its entry keeps.
function prepareRecord(log: Log, proposal: FileProposal): PreparedWrite | undefined {
    const { path, current, next, entry } = proposal;
    if (entry === undefined && proposal.status !== 'changed') return undefined;
    const recovery = backupFor(log, proposal);
    const original = proposal.saveOriginal === true ? recovery : entry?.original;
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
 * Applies a batch of proposals as one logged mutation, refusing any that preserves a file.
 * @param log the open log
 * @param proposals the proposals, each for a distinct file
 * @returns the outcome of each proposal, in order
 */
export function applyProposals(log: Log, proposals: FileProposal[]): Outcome[] {
    const proposed = new Map(
        proposals.map(({ path, next, current, status }) => [
            path,
            status === 'preserved' || (status === 'unchanged' && next === undefined) ? current : next,
        ]),
    );
    assertProposalsCurrent(log, proposals, proposed);
    const conflict = proposals.find((proposal) => proposal.status === 'preserved');
    if (conflict !== undefined)
        throw new Error(`Preserved edited or unowned ${conflict.path}. Review that file before applying.`);
    const prepared = proposals.flatMap((proposal) => {
        const record = prepareRecord(log, proposal);
        return record === undefined ? [] : [record];
    });
    if (prepared.length > 0) write(log, prepared);
    return proposals.map((proposal) => proposal.status);
}

/**
 * Applies one proposal, which yields its outcome or is preserved without a write.
 * @param log the open log
 * @param proposal the proposal
 * @returns its outcome
 */
export function applyProposal(log: Log, proposal: FileProposal): Outcome {
    if (proposal.status === 'preserved') return 'preserved';
    const [status] = applyProposals(log, [proposal]);
    if (status === undefined) throw new Error(`Applying ${proposal.path} produced no status.`);
    return status;
}
