import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';

/**
 * Retire explicitly replaced files after saving recoverable originals; retain directories.
 * @param root
 * @param removed
 * @param observed
 */
export function retireReplaced(
    root: string,
    removed: { path: string }[],
    observed: ReadonlyMap<string, FileSnapshot>,
): TakeoverRemovalResult {
    return withLifecycleOwner(root, (owner) => {
        const result: TakeoverRemovalResult = { removed: [], preserved: [] };
        const proposals = [];
        for (const entry of removed) {
            if (entry.path.endsWith('/')) {
                result.preserved.push(entry.path);
                continue;
            }
            const expected = observed.get(entry.path);
            if (expected === undefined) throw new Error(`No takeover observation exists for ${entry.path}.`);
            const proposal = owner.proposeRetirement(entry.path, expected);
            proposals.push(proposal);
            const status = proposal.status;
            if (status === 'changed') result.removed.push(entry.path);
            else if (status === 'preserved') result.preserved.push(entry.path);
        }
        owner.applyProposals(proposals.filter((proposal) => proposal.status !== 'preserved'));
        return result;
    });
}

export type TakeoverRemovalResult = { removed: string[]; preserved: string[] };
