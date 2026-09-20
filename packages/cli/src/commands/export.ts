// gspot export
import type { Command } from 'commander';
import { directoryOf } from '#cli/commands/flags.ts';
import { exportCommand } from '#cli/profile/command.ts';
import { printCommand } from '#cli/commands/print-result.ts';

/**
 * Registers export.
 * @param program the commander program
 */
export function registerExport(program: Command): void {
    program
        .command('export <file>')
        .description('Write a profile from the policy of this repository, without anything that names a path')
        .action(async (file: string, _flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(() => exportCommand(directoryOf(global), file), global);
        });
}
