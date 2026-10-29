import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { ToolInstall } from '#cli/types/installers/install.ts';
import { redactInstallOutput } from '#cli/installers/credentials.ts';

/**
Record and run one install command with the shared cancellation and time limit.

@param install the installation state and attempted commands.
@param command the program and arguments.
@param options the working folder and environment.
@param options.cwd the folder where the command runs.
@param options.env variable overrides for the child process.
*/
export async function runInstallStep(
    install: ToolInstall,
    command: readonly string[],
    options: { cwd: string; env?: Record<string, string | undefined> },
): Promise<SpawnResult> {
    install.steps.push(command);
    const timeoutSeconds = install.session.timeoutSeconds;
    const result = await runTool(command, { ...options, cancelSignal: install.session.cancelSignal, timeoutSeconds });
    install.session.cancelSignal?.throwIfAborted();
    if (result.timedOut)
        throw new GspotError(
            'install',
            `The command ${command.join(' ')} ran longer than tool_timeout_seconds (${String(timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
        );
    return result;
}

/**
Record and run one install command, and stop when it exits with an error.

@param install the installation state and attempted commands.
@param command the program and arguments.
@param options the working folder, the environment, and the name of the command in the error.
@param options.cwd the folder where the command runs.
@param options.env variable overrides for the child process.
@param options.name how the error names the command.
*/
export async function runRequiredInstallStep(
    install: ToolInstall,
    command: readonly string[],
    options: { cwd: string; env?: Record<string, string | undefined>; name: string },
): Promise<SpawnResult> {
    const { name, ...spawn } = options;
    const result = await runInstallStep(install, command, spawn);
    if (result.code !== 0)
        throw new GspotError(
            'install',
            `${name} failed (exit ${String(result.code)}):\n${redactInstallOutput(result, [])}`,
        );
    return result;
}
