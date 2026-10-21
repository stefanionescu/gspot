// Run tools with the configured timeout and shared process options.
import { TOOL_ENV } from '#cli/config/tools/run.ts';
import { readGitEnvironment } from '#cli/system/git.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import type { ToolRunOptions } from '#cli/types/tools/run.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';

/**
 * Run a tool command with the shared output environment and the timeout from the settings.
 *
 * @param command the expanded arguments.
 * @param options how the command runs.
 *
 * @returns the process result.
 */
export async function runTool(command: readonly string[], options: ToolRunOptions): Promise<SpawnResult> {
    const { timeoutSeconds, cancelSignal, ...prepared } = options;
    if (cancelSignal?.aborted === true)
        return {
            code: 1,
            stdout: '',
            stderr: 'The command was canceled.',
            missing: false,
            duration: 0,
            canceled: true,
            timedOut: false,
            errored: false,
        };
    const selected = readGitEnvironment(prepared.cwd, command, { ...TOOL_ENV, ...prepared.env });
    if ('failure' in selected) return selected.failure;
    const result = await spawnProcess(command, {
        ...prepared,
        env: selected.env,
        timeoutSeconds,
        cancelSignal,
    });
    return {
        ...result,
        stdout: result.stdout.replaceAll('\r\n', '\n'),
        stderr: result.stderr.replaceAll('\r\n', '\n'),
    };
}
