import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { ToolInstall } from '#cli/types/tools.ts';
import { writeProgress } from '#cli/system/terminal.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/system.ts';
import { redactInstallOutput } from '#cli/tools/installers/credentials.ts';

/**
Record and run one install command with the shared cancellation and time limit.

@param install the installation state and attempted commands.
@param command the program and arguments.
@param options the working folder, the environment, and the step that the command does.
@param options.cwd the folder where the command runs.
@param options.env variable overrides for the child process.
@param options.step what the command does, which gspot prints as it starts, for a command that can take a while.
*/
export async function runInstallStep(
    install: ToolInstall,
    command: readonly string[],
    options: { cwd: string; env?: Record<string, string | undefined>; step?: string },
): Promise<SpawnResult> {
    const { step = `the command ${command.join(' ')}`, ...spawn } = options;
    install.steps.push(command);
    if (options.step !== undefined) writeProgress(`${step}\n`);
    const timeoutSeconds = install.session.timeoutSeconds;
    const started = performance.now();
    const result = await runTool(command, { ...spawn, cancelSignal: install.session.cancelSignal, timeoutSeconds });
    install.session.cancelSignal?.throwIfAborted();
    if (result.timedOut) {
        const elapsed = ((performance.now() - started) / MILLISECONDS_PER_SECOND).toFixed(1);
        throw new GspotError(
            'install',
            `Install stopped ${step} after ${elapsed}s, past tool_timeout_seconds (${String(timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
        );
    }
    return result;
}

/**
Record and run one install command, and stop when it exits with an error.

@param install the installation state and attempted commands.
@param command the program and arguments.
@param options the working folder, the environment, the step, and the name of the command in the error.
@param options.cwd the folder where the command runs.
@param options.env variable overrides for the child process.
@param options.step what the command does, which gspot prints as it starts.
@param options.name how the error names the command.
*/
export async function runRequiredInstallStep(
    install: ToolInstall,
    command: readonly string[],
    options: { cwd: string; env?: Record<string, string | undefined>; step: string; name: string },
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

/**
Name the pinned tools that a failed resolution names, and the setting that holds them back. A package manager finds no
release of a pin that came out after the hold began.

@param install the installation state with the hold.
@param output the redacted output of the package manager.
@param pins each pinned tool with its version, as the package manager names it.
@returns the explanation and a line break, or an empty string when the output names no pin.
*/
export function explainReleaseAgeHold(install: ToolInstall, output: string, pins: readonly string[]): string {
    const held = pins.filter((pin) => output.includes(pin));
    if (held.length === 0 || install.releaseAgeDays === 0) return '';
    const days = String(install.releaseAgeDays);
    return `${held.join(', ')} came out less than ${days} days ago. The setting dependencies.min_release_age_days holds back each release for ${days} days. Wait for the release to age, or lower the setting with gspot set dependencies.min_release_age_days <days> --reason "<why>".\n`;
}
