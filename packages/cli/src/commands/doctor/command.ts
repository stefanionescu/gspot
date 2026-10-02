import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/execution/session.ts';
import { printCommand } from '#cli/commands/print-result.ts';
import { pinnedVersion } from '#cli/lifecycle/version-pin.ts';
import type { DoctorOptions } from '#cli/types/commands/doctor.ts';
import { buildReport, formatReport } from '#cli/commands/doctor/report.ts';
import type { Program, CommandResult } from '#cli/types/commands/commands.ts';

/**
 * Reports configuration and tool problems.
 * @param options the parsed flags
 * @returns the command result
 */
export async function doctorCommand(options: DoctorOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    const report = buildReport(session, pinnedVersion(root));
    return { text: formatReport(report), json: report, exitCode: report.exitCode };
}

/**
 * Registers doctor.
 * @param program the commander program
 */
export function registerDoctor(program: Program): void {
    program
        .command('doctor')
        .summary('Check the gspot setup')
        .description(
            'Report missing tools, unchecked files, and changes since init: the selected tools, the Git hooks, the files no check reads, and the generated files that changed. doctor repairs nothing. Each problem comes with the command that fixes it.',
        )
        .addHelpText(
            'after',
            '\nExit codes:\n- 0: the selected tools and hooks are ready.\n- 1: a selected tool or hook is missing, invalid, or outdated.\n- 2: doctor could not finish.\n\nExample:\ngspot doctor',
        )
        .action(async (_flags, command) => {
            const global = command.optsWithGlobals();
            await printCommand(
                (cwd) =>
                    doctorCommand({
                        cwd,
                    }),
                global,
            );
        });
}
