// Saves a reusable policy profile.
import { relative, resolve, sep } from 'node:path';
import { parseProfile } from '#cli/profile/read.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { readPolicy } from '#cli/policy/read-policy.ts';
import { exportedProfile } from '#cli/profile/export.ts';
import { mutationTarget } from '#cli/platform/filesystem.ts';
import type { CommandResult } from '#cli/commands/print-result.ts';
import { withLifecycleOwner, readOwnership } from '#cli/lifecycle/ownership.ts';

/**
 * Writes a profile from the policy of this repository.
 * @param cwd the directory the command runs in
 * @param file the file to write, relative to cwd
 * @returns the command result, with what was left out
 */
export async function exportCommand(cwd: string, file: string): Promise<CommandResult> {
    const root = findRoot(cwd);
    const policy = readPolicy(root);
    const saved = exportedProfile(policy.text, file);
    mutationTarget(file);
    const path = relative(root, resolve(cwd, file)).split(sep).join('/');
    mutationTarget(path);
    parseProfile(saved.text, file);
    withLifecycleOwner(root, (owner) => {
        if (owner.read('gspot.toml')?.bytes.toString('utf8') !== policy.text)
            throw new Error('The policy changed while the profile was prepared. Retry the export.');
        const existing = readOwnership(root).files.find((entry) => entry.path === path);
        if (existing !== undefined && existing.kind !== 'export')
            throw new Error(`Profile export cannot replace managed ${path}. Choose another destination.`);
        const current = owner.read(path);
        const proposal = owner.proposeReplacement(
            path,
            { bytes: Buffer.from(saved.text), mode: current?.mode ?? 0o644 },
            'export',
        );
        owner.applyProposals([proposal]);
    });
    const lines = [`wrote ${file}`, ...saved.leftOut.map((entry) => `left out  ${entry}`)];
    return { text: `${lines.join('\n')}\n`, json: { file, leftOut: saved.leftOut }, exitCode: 0 };
}
