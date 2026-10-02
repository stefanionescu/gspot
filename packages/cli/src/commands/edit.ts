// The step every policy edit shares: prepare and write gspot.toml, apply it, and install what the selection needs.
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import * as messages from '#cli/policy/messages.ts';
import { decodedText } from '#cli/platform/text.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { writeOutputs } from '#cli/lifecycle/write.ts';
import { openSession } from '#cli/execution/session.ts';
import { proposePolicy } from '#cli/policy/mutations.ts';
import { asOwner } from '#cli/lifecycle/ownership/owner.ts';
import { isReasonAccepted } from '#cli/policy/loosening.ts';
import { finishInstall } from '#cli/commands/install/steps.ts';
import type { ApplyReport } from '#cli/types/lifecycle/lifecycle.ts';
import type { Mutation, Proposal } from '#cli/types/policy/policy.ts';
import type { CommandResult, PreparedPolicy } from '#cli/types/commands/commands.ts';

/**
 * Capture the input bytes and mode before evaluating and validating a policy mutation.
 * @param root the repository root
 * @param mutate the change to apply to the policy text
 * @returns the validated plan with the original file
 */
export function preparePolicy(root: string, mutate: Mutation): PreparedPolicy {
    using files = openRoot(root);
    const original = files.read('gspot.toml');
    if (original === undefined) throw new GspotError('policy', [messages.fileMissing('gspot.toml')]);
    const text = decodedText(original.bytes);
    if (text === undefined) throw new Error('The policy file gspot.toml must contain valid UTF-8 text.');
    return { ...proposePolicy(root, text, mutate), original };
}

/**
 * Publish exactly the validated plan while refusing changed input bytes or permissions.
 * @param root the repository root
 * @param plan the prepared policy
 * @returns what was written
 */
export function writePolicy(root: string, plan: PreparedPolicy): Proposal {
    if (plan.changed)
        asOwner(root, (owner) => {
            const previous = owner.read('gspot.toml');
            if (!isDeepStrictEqual(previous, plan.original))
                throw new Error('The policy file gspot.toml changed while the edit was prepared. Retry the command.');
            const status = owner.replace(
                'gspot.toml',
                { bytes: Buffer.from(plan.text), mode: plan.original.mode },
                'policy',
                true,
            );
            if (status === 'preserved') throw new Error('The policy edit could not preserve the current input.');
        });
    return plan;
}

/**
 * Applies one mutation to gspot.toml and runs apply, or prints the change on a dry run.
 * @param root the repository root.
 * @param mutation the change to the raw document.
 * @param isDryRun when true nothing is written and apply does not run.
 * @param describe the text that tells the user what changed.
 * @returns the command result with exit code 0, and what apply wrote.
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
    return asOwner(root, async () => {
        writePolicy(root, result);
        const session = await openSession(root, {
            policy: result.policy,
            text: result.text,
            path: join(root, 'gspot.toml'),
            problems: [],
        });
        const applied = await writeOutputs(session);
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
    if (reason === undefined) throw new GspotError('policy', [messages.missingReason(where, command)]);
    if (!isReasonAccepted(reason)) throw new GspotError('policy', [messages.refusedReason(where, reason)]);
}

/**
 * Installs the tools that a changed selection needs once add or remove has applied it.
 * @param root the repository root
 * @param changed what commitPolicy returned
 * @returns the command result, with a note about the installed tools
 */
export async function installSelection(
    root: string,
    changed: Awaited<ReturnType<typeof commitPolicy>>,
): Promise<CommandResult> {
    const { applied, ...result } = changed;
    if (applied === undefined) return result;
    const session = await openSession(root);
    const { installNote, exitCode } = await finishInstall(session, true);
    const note = installNote === '' ? '' : `${installNote}\n`;
    const next = exitCode === 0 ? 'Run gspot check to check the selected kits.\n' : '';
    return { ...result, text: `${result.text}${note}${next}`, exitCode };
}
