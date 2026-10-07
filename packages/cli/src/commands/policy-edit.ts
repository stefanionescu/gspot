// The step every policy edit shares: prepare and write gspot.toml, then apply it.
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { decodeUtf8 } from '#cli/platform/text.ts';
import { proposePolicy } from '#cli/policy/edit.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import type { CommandResult } from '#cli/types/output.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { EXIT_ERROR } from '#cli/config/platform/runtime.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { reasonDiagnostic } from '#cli/policy/errors/reasons.ts';
import type { ApplyReport } from '#cli/types/lifecycle/output.ts';
import { proposeReplacement } from '#cli/lifecycle/ownership/plans.ts';
import type { Mutation, Proposal } from '#cli/types/policy/settings.ts';
import type { PreparedPolicy, PolicyPreviewJson, PolicyCommitResult } from '#cli/types/commands/policy-edit.ts';

/**
 * Capture the input bytes and mode before evaluating and validating a policy mutation.
 * @param root the repository root
 * @param mutate the change to apply to the policy text
 * @returns the validated plan with the original file
 */
export function preparePolicy(root: string, mutate: Mutation): PreparedPolicy {
    using files = openRoot(root);
    const original = files.read(POLICY_FILE);
    if (original === undefined)
        throw new GspotError('policy', [`There is no gspot.toml here. Run \`gspot init\` to create one.`]);
    const text = decodeUtf8(original.bytes);
    if (text === undefined)
        throw new GspotError('policy', ['The policy file gspot.toml must contain valid UTF-8 text.']);
    return { ...proposePolicy(root, text, mutate), original };
}

/**
 * Previews a validated policy edit without opening ownership state or applying outputs.
 * @param root the repository root
 * @param mutation the change to the raw policy
 * @param summary the proposed change
 * @returns the preview text and proposed policy
 */
export function previewPolicy(root: string, mutation: Mutation, summary: string): CommandResult<PolicyPreviewJson> {
    const proposal = preparePolicy(root, mutation);
    return {
        text: `${summary}\n(dry run: gspot.toml not written)\n`,
        json: { policy: proposal.text, dryRun: true },
        exitCode: 0,
    };
}

/**
 * Publish exactly the validated plan while refusing changed input bytes or permissions.
 * @param log the command's locked ownership context
 * @param plan the prepared policy
 * @returns what was written
 */
export function writePolicy(log: Log, plan: PreparedPolicy): Proposal {
    if (plan.changed) {
        const previous = log.files.read(POLICY_FILE);
        if (!isDeepStrictEqual(previous, plan.original))
            throw new GspotError('policy', [
                'The gspot.toml file changed while gspot was running. Run the command again.',
            ]);
        applyPlan(
            log,
            proposeReplacement(log, {
                path: POLICY_FILE,
                next: { bytes: Buffer.from(plan.text), mode: plan.original.mode },
                kind: 'policy',
                canReplace: true,
            }),
        );
    }
    return plan;
}

/**
 * Applies one mutation to gspot.toml through the command's locked ownership context.
 * @param root the repository root.
 * @param log the command's locked ownership context
 * @param mutation the change to the raw document.
 * @param summary the text that tells the user what changed.
 * @returns the command result with what apply wrote, or exit code 2 when apply stopped after the policy was written.
 */
export async function commitPolicy(
    root: string,
    log: Log,
    mutation: Mutation,
    summary: string,
): Promise<PolicyCommitResult> {
    const result = preparePolicy(root, mutation);
    if (!result.changed)
        return {
            text: 'gspot.toml already says this; nothing to apply.\n',
            json: { changed: false },
            exitCode: 0,
        };
    const session = await openSession(root, {
        policy: result.policy,
        text: result.text,
        path: join(root, POLICY_FILE),
        problems: [],
    });
    let generated;
    try {
        generated = emitAll(session);
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
            text: `The policy change was not written: ${reason}\nResolve that, then retry the command.\n`,
            json: { error: 'preparation', changed: false, applied: false, message: reason },
            exitCode: EXIT_ERROR,
        };
    }
    writePolicy(log, result);
    let applied: ApplyReport;
    try {
        applied = writeOutputs(session, log, undefined, generated);
    } catch (error) {
        // The policy is written by now, so the result says it keeps the change and how to finish.
        const reason = error instanceof Error ? error.message : String(error);
        return {
            text: `${summary}\ngspot.toml keeps this change, and applying it stopped: ${reason}\nResolve that, then run gspot apply.\n`,
            json: { error: 'apply', changed: result.changed, applied: false, message: reason },
            exitCode: EXIT_ERROR,
        };
    }
    const notes = applied.notes.map((note) => `note     ${note}\n`).join('');
    return {
        text: `${summary}\n${notes}`,
        json: { changed: result.changed, notes: applied.notes },
        exitCode: 0,
        applied,
        session,
    };
}

/**
 * Refuses a missing or placeholder reason.
 * @param reason the reason the user gave, if any
 * @param subject the command the reason belongs to, for the message
 * @param hint the full command line that carries the reason
 */
export function requireReason(reason: string | undefined, subject: string, hint: string): void {
    const diagnostic = reasonDiagnostic(subject, reason, hint);
    if (diagnostic !== undefined) throw new GspotError('policy', diagnostic);
}
