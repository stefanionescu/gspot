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
        .addHelpText(
            'after',
            '\nEffects:\nInspects selected tools, integrations, coverage, and configuration drift. It reports problems without repairing the repository. Run install, apply, or the suggested correction for the reported problem.\n\nExit codes:\n0: selected tools and hooks are ready. 1: a selected tool or hook is missing, invalid, or outdated. 2: the diagnostic could not complete.\n\nExample:\ngspot doctor',
        )
        .action(async (_flags: Record<string, unknown>, command: Command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                () =>
                    doctorCommand({
                        cwd: directoryOf(global),
                    }),
                global,
            );
        });
}
