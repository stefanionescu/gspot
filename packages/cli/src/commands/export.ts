// Saves a reusable policy profile.
import type { CommandResult } from '#cli/commands/print-result.ts';
import { readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { mutationTarget } from '#cli/platform/filesystem.ts';
import { exportedProfile } from '#cli/policy/profiles/export.ts';
import { parseProfile } from '#cli/policy/profiles/read.ts';
import { readPolicy } from '#cli/policy/read.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { relative, resolve, sep } from 'node:path';

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

import { directoryOf } from '#cli/commands/flags.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import type { Command } from 'commander';

/**
 * Registers export.
 * @param program the commander program
 */
export function registerExport(program: Command): void {
    program
        .command('export <file>')
        .summary('Export a profile')
        .description('Write a profile from the policy of this repository, without anything that names a path')
        .addHelpText(
            'after',
            '\nEffects:\nWrites a reusable profile to the requested file from the current policy. Path-specific settings are omitted and reported. The repository policy remains unchanged.\n\nExit codes:\n0: the profile was written. 2: invalid input or inability to complete the request.\n\nExample:\ngspot export team.toml',
        )
        .action(async (file: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => exportCommand(directoryOf(global), file), global);
        });
}
