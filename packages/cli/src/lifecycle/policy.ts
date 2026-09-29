import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/platform/errors.ts';
import { proposePolicy } from '#cli/policy/write.ts';
import { fileMissing } from '#cli/policy/messages.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import type { PreparedPolicy } from '#cli/types/lifecycle/lifecycle.ts';
import type { Mutation, WriteResult } from '#cli/types/policy/policy.ts';

/**
 * Capture the input bytes and mode before evaluating and validating a policy mutation.
 * @param root the repository root
 * @param mutate the change to apply to the policy text
 * @returns the validated plan with the original file
 */
export function preparePolicy(root: string, mutate: Mutation): PreparedPolicy {
    const original = openRoot(root).read('gspot.toml');
    if (original === undefined) throw new GspotError('policy', [fileMissing('gspot.toml')]);
    const text = original.bytes.toString('utf8');
    if (!Buffer.from(text).equals(original.bytes))
        throw new Error('The policy file gspot.toml must contain valid UTF-8 text.');
    return { ...proposePolicy(root, text, mutate), original };
}

/**
 * Publish exactly the validated plan while refusing changed input bytes or permissions.
 * @param root the repository root
 * @param plan the prepared policy
 * @returns what was written
 */
export function writePolicy(root: string, plan: PreparedPolicy): WriteResult {
    if (plan.changed)
        runOwnedLifecycle(root, (owner) => {
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
