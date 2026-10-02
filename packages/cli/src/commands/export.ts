// Saves a reusable policy profile.
import { resolve, relative } from 'node:path';
import { readPolicy } from '#cli/policy/read.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { mutationTarget } from '#cli/platform/safe-paths.ts';
import { parseProfile } from '#cli/policy/profiles/parse.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { exportProfile } from '#cli/policy/profiles/export.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/platform.ts';
import type { Program, CommandResult } from '#cli/types/commands/commands.ts';
import { readOwnership, runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';

/**
 * Writes a profile from the policy of this repository.
 * @param cwd the directory the command runs in
 * @param file the file to write, relative to cwd
 * @returns the command result, with what was left out
 */
export function exportCommand(cwd: string, file: string): CommandResult {
    const root = findRoot(cwd);
    const policy = readPolicy(root);
    const saved = exportProfile(policy.text, file);
    mutationTarget(file);
    const path = toPosix(relative(root, resolve(cwd, file)));
    mutationTarget(path);
    parseProfile(saved.text, file);
    runOwnedLifecycle(root, (owner) => {
        if (owner.read('gspot.toml')?.bytes.toString('utf8') !== policy.text)
            throw new Error('The policy changed while the profile was prepared. Retry the export.');
        const existing = readOwnership(root).files.find((entry) => entry.path === path);
        if (existing !== undefined && existing.kind !== 'export')
            throw new Error(`Profile export cannot replace managed ${path}. Choose another destination.`);
        const current = owner.read(path);
        const plan = owner.proposeReplacement(
            path,
            { bytes: Buffer.from(saved.text), mode: current?.mode ?? OWNER_WRITABLE_FILE },
            'export',
        );
        owner.applyPlans([plan]);
    });
    const lines = [`wrote ${file}`, ...saved.leftOut.map((entry) => `left out  ${entry}`)];
    return { text: `${lines.join('\n')}\n`, json: { file, leftOut: saved.leftOut }, exitCode: 0 };
}

/**
 * Registers export.
 * @param program the commander program
 */
export function registerExport(program: Program): void {
    program
        .command('export <file>')
        .summary('Export a profile')
        .description(
            'Write the policy to a profile other repositories can start from. Settings that name a path stay out, and export lists them. gspot.toml does not change.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the profile was written.\n- 2: the input was invalid, or export could not finish.\n\nExample:\ngspot export team.toml',
        )
        .action(async (file, _flags, command) => {
            const global = command.optsWithGlobals();
            await printCommand((cwd) => Promise.resolve(exportCommand(cwd, file)), global);
        });
}
