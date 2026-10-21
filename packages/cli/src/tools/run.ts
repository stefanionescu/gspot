// Run tools with the configured timeout and shared process options.
import { TOOL_ENV } from '#cli/config/tools/run.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { buildGitEnvironment } from '#cli/system/git.ts';
import type { ToolRunOptions } from '#cli/types/tools/run.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
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
            isCanceled: true,
        };
    const selected = buildGitEnvironment(prepared.cwd, command, { ...TOOL_ENV, ...prepared.env });
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

/**
 * Read the process timeout from the scope settings.
 *
 * @param view the scope settings with the timeout.
 *
 * @returns how long a tool may run, in seconds.
 */
export function getToolTimeoutSeconds(view: Pick<ScopeView, 'settings'>): number {
    return Number(view.settings['tool_timeout_seconds']);
}
