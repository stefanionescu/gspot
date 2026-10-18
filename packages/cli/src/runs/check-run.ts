import { runBuiltInCheck } from '#cli/runs/built-in.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { type RunnableCheck, type CheckImplementation } from '#cli/types/runs/check.ts';

/**
 * Build the run of one check. A built-in check runs its own code. A tool check runs its command, with the arguments
 * and tool files of its check implementation on every run.
 * @param implementation the check implementation, or undefined for a tool check that runs only its command.
 * @returns the run function.
 */
export function buildCheckRun(implementation: CheckImplementation | undefined): RunnableCheck['run'] {
    if (implementation?.check !== undefined) return runBuiltInCheck(implementation.check);
    const run = implementation?.run ?? runCheckCommand;
    return (session, planned, options) =>
        run(session, planned, {
            ...options,
            arguments: implementation?.arguments,
            toolFiles: implementation?.toolFiles,
        });
}
