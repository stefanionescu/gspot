import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
// What every writing command ends with: one mutation of gspot.toml, validated as load does, then apply. The reason rules live here too.
import type { Mutation } from '#types/config.ts';
import type { ApplyReport } from '#types/emit.ts';
import { openSession } from '#cli/run/session.ts';
import type { CommandResult } from '#types/run.ts';
import { writePolicy } from '#cli/policy/write.ts';
import * as messages from '#cli/policy/messages.ts';
import { applyAll } from '#cli/emit/apply-command.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import { isReasonAccepted } from '#cli/policy/loosening.ts';

/**
 * Applies one mutation to gspot.toml and runs apply, or prints the change on a dry run.
 * @param root the repository root
 * @param mutation the change to the raw document
 * @param isDryRun when true nothing is written and apply does not run
 * @param describe the text that tells the user what changed
 * @returns the command result with exit code 0, and what apply wrote
 */
export async function commitPolicy(
    root: string,
    mutation: Mutation,
    isDryRun: boolean,
    describe: string,
): Promise<CommandResult & { applied?: ApplyReport }> {
    const result = writePolicy(root, mutation, true);
    if (isDryRun)
        return {
            text: `${describe}\n(dry run: gspot.toml not written)\n`,
            json: { text: result.text, dryRun: true },
            exitCode: 0,
        };
    return withLifecycleOwner(root, async () => {
        writePolicy(root, mutation);
        const session = await openSession(root);
        const applied = await applyAll(session);
        const notes = applied.notes.map((note) => `note     ${note}\n`).join('');
        return {
            text: `${describe}\n${notes}`,
            json: { changed: result.changed, notes: applied.notes },
            exitCode: 0,
            applied,
        };
    });
}

/**
 * Refuses a missing or placeholder reason.
 * @param reason the reason the user gave, if any
 * @param where the command the reason belongs to, for the message
 * @param command the full command line that carries the reason
 */
export function requireReason(reason: string | undefined, where: string, command: string): void {
    if (reason === undefined) throw new PolicyError([messages.missingReason(where, command)]);
    if (!isReasonAccepted(reason)) throw new PolicyError([messages.refusedReason(where, reason)]);
}

/**
 * Refuses an accepted-looking reason that the loosening rules reject; a missing reason passes.
 * @param reason the reason the user gave, if any
 * @param where the command the reason belongs to, for the message
 */
export function refuseBadReason(reason: string | undefined, where: string): void {
    if (reason !== undefined && !isReasonAccepted(reason))
        throw new PolicyError([messages.refusedReason(where, reason)]);
}
