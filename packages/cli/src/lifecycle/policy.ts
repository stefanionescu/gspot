import { isDeepStrictEqual } from 'node:util';
import { fileMissing } from '#cli/policy/messages.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import { proposePolicy } from '#cli/policy/write.ts';
import type { Mutation, WriteResult } from '#cli/policy/write.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { FileSnapshot } from '#cli/platform/filesystem.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';

/** Capture the input bytes and mode before evaluating and validating a policy mutation. */
export function preparePolicy(root: string, mutate: Mutation): PreparedPolicy {
    const original = openConfinedRoot(root).read('gspot.toml');
    if (original === undefined) throw new PolicyError([fileMissing('gspot.toml')]);
    const text = original.bytes.toString('utf8');
    if (!Buffer.from(text).equals(original.bytes)) throw new Error('gspot.toml must contain valid UTF-8 text.');
    return { ...proposePolicy(root, text, mutate), original };
}

/** Publish exactly the validated proposal while refusing changed input bytes or permissions. */
export function writePolicy(root: string, proposal: PreparedPolicy): WriteResult {
    if (proposal.changed)
        withLifecycleOwner(root, (owner) => {
            const previous = owner.read('gspot.toml');
            if (!isDeepStrictEqual(previous, proposal.original))
                throw new Error('gspot.toml changed while the edit was prepared. Retry the command.');
            const status = owner.replace(
                'gspot.toml',
                { bytes: Buffer.from(proposal.text), mode: proposal.original.mode },
                'policy',
                true,
            );
            if (status === 'preserved') throw new Error('The policy edit could not preserve the current input.');
        });
    return proposal;
}

export type PreparedPolicy = WriteResult & { original: FileSnapshot };
