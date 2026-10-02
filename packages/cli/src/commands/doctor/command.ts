import type { Command } from 'commander';
import { directoryOf } from '#cli/commands/flags.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/execution/session.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { pinnedVersion } from '#cli/lifecycle/version-pin.ts';
import { doctorText, doctorReport } from '#cli/commands/doctor/report.ts';
import type { CommandResult, DoctorOptions } from '#cli/types/commands.ts';

/**
 * Reports configuration and tool problems.
 * @param options the parsed flags
 * @returns the command result
 */
export async function doctorCommand(options: DoctorOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    const report = doctorReport(session, pinnedVersion(root));
    return { text: doctorText(report), json: report, exitCode: report.exitCode };
}

/**
 * Registers doctor.
 * @param program the commander program
 */
export function registerDoctor(program: Command): void {
    program
        .command('doctor')
        .summary('Check the gspot setup')
        .description('Report missing tools, unchecked files, and changes since init')
        .addHelpText(
            'after',
            '\nEffects:\nChecks the selected tools, the Git hooks, the files no check reads, and the generated files that changed. doctor repairs nothing. Each problem comes with the command that fixes it.\n\nExit codes:\n- 0: the selected tools and hooks are ready.\n- 1: a selected tool or hook is missing, invalid, or outdated.\n- 2: doctor could not finish.\n\nExample:\ngspot doctor',
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
