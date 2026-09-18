// What every writing command ends with: one mutation of gspot.toml, validated as load does, then apply. The reason rules live here too.
import type { Mutation } from '#types/config.ts';
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
 * @returns the command result with exit code 0
 */
export async function commitPolicy(
    root: string,
    mutation: Mutation,
    isDryRun: boolean,
    describe: string,
): Promise<CommandResult> {
    const result = writePolicy(root, mutation, isDryRun);
    if (isDryRun)
        return {
            text: `${describe}\n(dry run: gspot.toml not written)\n`,
            json: { text: result.text, dryRun: true },
            exitCode: 0,
        };
    const session = await openSession(root);
    await applyAll(session);
    return { text: `${describe}\n`, json: { changed: result.changed }, exitCode: 0 };
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
