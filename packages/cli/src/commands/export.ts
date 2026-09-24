import { directoryOf } from '#cli/commands/flags.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { exportCommand } from '#cli/profile/command.ts';
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
