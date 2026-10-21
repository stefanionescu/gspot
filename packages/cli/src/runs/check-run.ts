import { runBuiltInCheck } from '#cli/runs/built-in.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { CheckResult, CheckRunOptions, CheckImplementation } from '#cli/types/runs/check.ts';

/**
 * Run a built-in check or the command of its implementation.
 *
 * @param session the repository and its tools.
 * @param planned the check to run.
 * @param implementation the check implementation, or undefined for a tool command.
 * @param options the command and scratch folder overrides.
 * @returns the check result.
 */
export async function runCheckImplementation(
    session: Session,
    planned: PlannedCheck,
    implementation: CheckImplementation | undefined,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    if (implementation?.check !== undefined) return runBuiltInCheck(implementation.check, session, planned);
    return (implementation?.run ?? runCheckCommand)(session, planned, {
        ...options,
        arguments: implementation?.arguments,
        toolFiles: implementation?.toolFiles,
    });
}
