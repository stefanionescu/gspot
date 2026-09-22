// Reports problems with the configured repository.
import { openSession } from '#cli/run/session.ts';
import type { DoctorOptions } from '#cli/doctor/types.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { pinnedVersion } from '#cli/run/version-pin.ts';
import type { CommandResult } from '#cli/run/types.ts';
import { doctorReport, doctorText } from '#cli/doctor/report.ts';

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
