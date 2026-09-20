// gspot doctor
import type { Command } from 'commander';
import { directoryOf } from '#cli/commands/flags.ts';
import { doctorCommand } from '#cli/doctor/command.ts';
import { printCommand } from '#cli/commands/print-result.ts';

/**
 * Registers doctor.
 * @param program the commander program
 */
export function registerDoctor(program: Command): void {
    program
        .command('doctor')
        .description('Report the tools, the unchecked files, and what changed in the repository after init')
        .option('--settings', 'Print every setting the selection exposes, its value and where it came from')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    doctorCommand({
                        cwd: directoryOf(global),
                        settings: flags['settings'] === true,
                    }),
                global,
            );
        });
}
