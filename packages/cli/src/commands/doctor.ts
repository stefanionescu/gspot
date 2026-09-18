// gspot doctor
import type { Command } from 'commander';

import { emit } from '#cli/commands/emit.ts';
import { doctorCommand } from '#cli/doctor/command.ts';

/** Registers doctor. */
export function registerDoctor(program: Command): void {
    program
        .command('doctor')
        .description('Report the tools, the unchecked files, and what changed in the repository since init')
        .option('--settings', 'Print every setting the selection exposes, its value and where it came from')
        .option('--offline', 'Skip the one lookup for a newer gspot')
        .action(async (flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals() as Record<string, unknown>;
            await emit(
                () =>
                    doctorCommand({
                        cwd: String(global['directory'] ?? process.cwd()),
                        settings: Boolean(flags['settings']),
                        offline: Boolean(flags['offline']),
                    }),
                global,
            );
        });
}
