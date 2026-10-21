// Record an install command and stop on cancellation or timeout.
import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { InstallContext } from '#cli/types/install.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';

/**
 * Record and run one install command with the shared cancellation and time limit.
 *
 * @param context the installation state and attempted commands.
 * @param command the program and arguments.
 * @param options the working folder and environment.
 * @param options.cwd the folder where the command runs.
 * @param options.env variable overrides for the child process.
 * @returns the process output and exit status.
 */
export async function runInstallStep(
    context: InstallContext,
    command: readonly string[],
    options: { cwd: string; env?: Record<string, string | undefined> },
): Promise<SpawnResult> {
    context.steps.push(command);
    const timeoutSeconds = context.session.timeoutSeconds;
    const result = await runTool(command, { ...options, cancelSignal: context.session.cancelSignal, timeoutSeconds });
    context.session.cancelSignal?.throwIfAborted();
    if (result.isTimedOut === true)
        throw new GspotError(
            'installation',
            `The command ${command.join(' ')} ran longer than tool_timeout_seconds (${String(timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>, then run: gspot install.`,
        );
    return result;
}
