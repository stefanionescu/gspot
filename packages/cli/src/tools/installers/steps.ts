import { runTool } from '#cli/tools/run.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { ToolInstall } from '#cli/types/tools.ts';
import { writeProgress } from '#cli/system/terminal.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import { formatSeconds } from '#cli/system/text/messages.ts';
import { NETWORK_ADVICE } from '#cli/config/tools/installers.ts';
import { redactInstallOutput } from '#cli/tools/installers/credentials.ts';

/**
Format how a process ended: its exit code, or the signal that stopped it.
*/
export function formatExit(result: Pick<SpawnResult, 'code' | 'signal'>): string {
    return result.signal === undefined ? `exit ${String(result.code)}` : `stopped by ${result.signal}`;
}

export async function runInstallStep(
    install: ToolInstall,
    command: readonly string[],
    options: { cwd: string; env?: Record<string, string | undefined>; step?: string },
): Promise<SpawnResult> {
    const { step = `the command ${command.join(' ')}`, ...spawn } = options;
    install.steps.push(command);
    if (options.step !== undefined) writeProgress(`${step}\n`);
    const timeoutSeconds = install.session.settings.tool_timeout_seconds;
    const started = performance.now();
    const result = await runTool(command, { ...spawn, cancelSignal: install.session.cancelSignal, timeoutSeconds });
    install.session.cancelSignal?.throwIfAborted();
    if (result.end === 'timed-out') {
        throw new GspotError(
            'install',
            `Install stopped ${step} after ${formatSeconds(performance.now() - started)}, past tool_timeout_seconds (${String(timeoutSeconds)}s). Raise it with gspot set tool_timeout_seconds <seconds>.`,
        );
    }
    return result;
}

export async function runRequiredInstallStep(
    install: ToolInstall,
    command: readonly string[],
    options: {
        cwd: string;
        env?: Record<string, string | undefined>;
        step: string;
        name: string;
        readAdvice?: (result: SpawnResult) => string;
    },
): Promise<SpawnResult> {
    const { name, readAdvice = () => NETWORK_ADVICE, ...spawn } = options;
    const result = await runInstallStep(install, command, spawn);
    if (result.code !== 0)
        throw new GspotError(
            'install',
            `${name} failed (${formatExit(result)}):\n${redactInstallOutput(result, [])}\n${readAdvice(result)}`,
        );
    return result;
}
