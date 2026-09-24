import { printCommand } from '#cli/commands/print-result.ts';
// Reports problems with the configured repository.
import { doctorReport, doctorText } from '#cli/commands/doctor/report.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { openSession } from '#cli/run/session.ts';
import { pinnedVersion } from '#cli/run/version-pin.ts';
import type { CommandResult } from '#cli/types/execution.ts';
import type { DoctorOptions } from '#cli/types/reports.ts';

/**
 * Reports configuration, tool, and coverage problems.
 * @param options the parsed flags
 * @returns the command result
 */
export async function doctorCommand(options: DoctorOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    const session = await openSession(root);
    const report = doctorReport(session, pinnedVersion(root));
    return { text: doctorText(report), json: report, exitCode: report.exitCode };
}

import { directoryOf } from '#cli/commands/flags.ts';
import type { Command } from 'commander';

/**
 * Registers doctor.
 * @param program the commander program
 */
export function registerDoctor(program: Command): void {
    program
        .command('doctor')
        .summary('Diagnose repository setup')
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
