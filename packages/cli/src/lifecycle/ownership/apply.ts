// Applying proposals: each batch is journaled before a byte moves, so an interruption can be recovered.
import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import type { FileSnapshot } from '#cli/types/platform.ts';
import type { originalSchema } from '#cli/lifecycle/journal.ts';
import { identity, matches } from '#cli/lifecycle/ownership/journal.ts';
import type { Outcome, PreparedWrite, FileProposal, Journal } from '#cli/types/lifecycle/lifecycle.ts';

// The file as it is now, read as a link entry when either side of the proposal is a link.
function foundSnapshot(
    journal: Journal,
    path: string,
    current: FileSnapshot | undefined,
    next: FileSnapshot | undefined,
): FileSnapshot | undefined {
    const isLink = current?.isLink === true || next?.isLink === true;
    if (isLink) return journal.confined.readEntry(path);
    return journal.confined.read(path);
}

// Refuses a proposal whose file or record changed since it was made.
function assertProposalCurrent(
    journal: Journal,
    proposal: FileProposal,
    proposed: ReadonlyMap<string, FileSnapshot | undefined>,
): void {
    const { path, current, previous, next } = proposal;
    const existing = journal.entryFor(path);
    if (next !== undefined) journal.confined.validate(path, next, proposed);
    const found = foundSnapshot(journal, path, current, next);
    if (!isDeepStrictEqual(existing, previous) || !isDeepStrictEqual(found, current))
        throw new Error(`File changed after its proposal: ${path}`);
}

// Refuses a batch that repeats a destination or holds a proposal whose file changed.
function assertProposalsCurrent(
    journal: Journal,
    proposals: FileProposal[],
    proposed: ReadonlyMap<string, FileSnapshot | undefined>,
): void {
    const destinations = new Set<string>();
    for (const proposal of proposals) {
        const key = proposal.path.normalize('NFC').toLowerCase();
        if (destinations.has(key)) throw new Error(`Duplicate proposal destination: ${proposal.path}`);
        destinations.add(key);
        assertProposalCurrent(journal, proposal, proposed);
    }
}

// The backup of the current bytes, taken when they leave: the first ownership, a removal, or a change.
function backupFor(journal: Journal, proposal: FileProposal): z.infer<typeof originalSchema> | undefined {
    const { path, current, next } = proposal;
    if (current === undefined) return undefined;
    const isReplaced = proposal.saveOriginal === true || next === undefined || !matches(current, identity(next));
    return isReplaced ? journal.backup(path, current) : undefined;
}

// The record a changed proposal writes, with the original its entry keeps.
function prepareRecord(journal: Journal, proposal: FileProposal): PreparedWrite | undefined {
    const { path, current, next, entry } = proposal;
    if (entry === undefined && proposal.status !== 'changed') return undefined;
    const recovery = backupFor(journal, proposal);
    const original = proposal.saveOriginal === true ? recovery : entry?.original;
    const recordedEntry =
        entry === undefined ? undefined : { ...entry, ...(original === undefined ? {} : { original }) };
    return { path, current, next, entry: recordedEntry, recovery };
}

// Writes the pending records, publishes every file, and settles the journal.
function publish(journal: Journal, prepared: PreparedWrite[]): void {
    journal.state.pending = prepared.map(({ path, current, next, entry, recovery }) => ({
        path,
        ...(current === undefined ? {} : { before: identity(current) }),
        ...(recovery === undefined ? {} : { beforeBackup: recovery }),
        ...(next === undefined ? {} : { after: identity(next) }),
        ...(entry === undefined ? {} : { entry }),
    }));
    journal.save();
    // Publish regular targets before links, including original targets restored in this batch.
    const ordered = prepared.toSorted(
        (left, right) => Number(left.next?.isLink === true) - Number(right.next?.isLink === true),
    );
    for (const { path, current, next } of ordered) {
        if (next === undefined) {
            if (current !== undefined) journal.confined.remove(path, current);
        } else if (!matches(current, identity(next))) journal.confined.write(path, next, current);
    }
    journal.finish();
}

/**
 * Applies a batch of proposals as one journaled mutation, refusing any that preserves a file.
 * @param journal the open journal
 * @param proposals the proposals, each for a distinct file
 * @returns the outcome of each proposal, in order
 */
export function applyProposals(journal: Journal, proposals: FileProposal[]): Outcome[] {
    const proposed = new Map(
        proposals.map(({ path, next, current, status }) => [
            path,
            status === 'preserved' || (status === 'unchanged' && next === undefined) ? current : next,
        ]),
    );
    assertProposalsCurrent(journal, proposals, proposed);
    const conflict = proposals.find((proposal) => proposal.status === 'preserved');
    if (conflict !== undefined)
        throw new Error(`Preserved edited or unowned ${conflict.path}. Review that file before applying.`);
    const prepared = proposals.flatMap((proposal) => {
        const record = prepareRecord(journal, proposal);
        return record === undefined ? [] : [record];
    });
    if (prepared.length > 0) publish(journal, prepared);
    return proposals.map((proposal) => proposal.status);
}

/**
 * Applies one proposal, which yields its outcome or is preserved without a write.
 * @param journal the open journal
 * @param proposal the proposal
 * @returns its outcome
 */
export function applyProposal(journal: Journal, proposal: FileProposal): Outcome {
    if (proposal.status === 'preserved') return 'preserved';
    const [status] = applyProposals(journal, [proposal]);
    if (status === undefined) throw new Error(`Applying ${proposal.path} produced no status.`);
    return status;
}
