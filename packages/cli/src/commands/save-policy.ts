// One claimed policy edit validates the authored values, then applies prepared outputs without installing tools.
import { join } from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { emitAll } from '#cli/generation/files.ts';
import { preparePolicy } from '#cli/policy/edit.ts';
import { writePolicyFile } from '#cli/policy/file.ts';
import { openSession } from '#cli/commands/session.ts';
import { EXIT_ERROR } from '#cli/config/platform/runtime.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { ApplyReport } from '#cli/types/lifecycle/apply.ts';
import type { PreparedPolicy } from '#cli/types/policy/settings.ts';
import { planReplacement } from '#cli/lifecycle/ownership/plans.ts';
import type { PolicySaveResult, SavePolicyOptions } from '#cli/types/commands/save-policy.ts';

// Both failure phases report native errors and non-Error throws with the same text.
function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Render the canonical policy diff from the transaction's already captured proposal.
 * @param result the prepared policy with its original bytes
 * @param summary the command's description of the requested edit
 * @returns the preview without writing policy or generated files
 */
function planPolicy(result: PreparedPolicy, summary: string): PolicySaveResult {
    const diff = result.changed
        ? createTwoFilesPatch(POLICY_FILE, POLICY_FILE, result.original.bytes.toString('utf8'), result.text)
        : '';
    const text = `${summary}\n${diff}(dry run: gspot.toml not written)\n`;
    return {
        text,
        json: { changed: result.changed, policy: result.text, diff, dryRun: true },
        exitCode: 0,
    };
}

/**
 * Preview or apply one policy change through the same validated transaction.
 * @param root the repository root
 * @param options the authored change, summary, and preview choice
 * @returns the prepared policy diff or the result of applying generated outputs
 */
export async function savePolicy(root: string, options: SavePolicyOptions): Promise<PolicySaveResult> {
    const { change, summary, isDryRun } = options;
    using log = isDryRun ? undefined : openOwnership(root);
    const result = preparePolicy(root, change);
    if (log === undefined) return planPolicy(result, summary);
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
        errors: [],
    });
    let generated;
    try {
        generated = emitAll(session);
    } catch (error) {
        const reason = errorText(error);
        return {
            text: `The policy change was not written: ${reason}\nResolve that, then retry the command.\n`,
            json: { error: 'preparation', changed: false, applied: false, message: reason },
            exitCode: EXIT_ERROR,
        };
    }
    writePolicyFile({
        files: log.files,
        text: result.text,
        original: result.original,
        publish: (next, expected) => {
            applyPlan(log, {
                ...planReplacement(log, { path: POLICY_FILE, next, kind: 'policy', canReplace: true, expected }),
                before: expected,
            });
        },
    });
    let applied: ApplyReport;
    try {
        applied = writeGeneratedFiles(session, log, undefined, generated);
    } catch (error) {
        // The policy is written by now, so the result says it keeps the change and how to finish.
        const reason = errorText(error);
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
    };
}
