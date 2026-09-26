import { applyAll } from '#cli/commands/apply/workflow.ts';
import type { CommandResult } from '#cli/commands/print-result.ts';
import { openSession } from '#cli/execution/session.ts';
import type { ApplyReport } from '#cli/lifecycle/apply.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { preparePolicy, writePolicy } from '#cli/lifecycle/policy.ts';
import { isReasonAccepted } from '#cli/policy/loosening.ts';
import * as messages from '#cli/policy/messages.ts';
import { PolicyError } from '#cli/policy/read.ts';
import type { Mutation } from '#cli/policy/write.ts';
import { join } from 'node:path';

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
    const result = preparePolicy(root, mutation);
    if (isDryRun)
        return {
            text: `${describe}\n(dry run: gspot.toml not written)\n`,
            json: { text: result.text, dryRun: true },
            exitCode: 0,
        };
    return withLifecycleOwner(root, async () => {
        writePolicy(root, result);
        const session = await openSession(root, {
            policy: result.policy,
            text: result.text,
            path: join(root, 'gspot.toml'),
            problems: [],
        });
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
