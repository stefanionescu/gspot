// Run tools with the configured timeout and shared process options.
import { TOOL_ENV } from '#cli/config/tools/run.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { buildGitEnvironment } from '#cli/system/git.ts';
import type { ToolRunOptions } from '#cli/types/tools/run.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { TOOL_TIMEOUT_SETTING } from '#cli/config/settings/values.ts';

/**
 * Runs a tool command with the shared output environment and configured timeout.
 *
 * @param command the expanded argument vector.
 * @param options the command directory, environment, timeout, and cancellation.
 *
 * @returns the completed process result.
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
        timeoutSeconds: timeoutSeconds,
        cancelSignal,
    });
    return {
        ...result,
        stdout: result.stdout.replaceAll('\r\n', '\n'),
        stderr: result.stderr.replaceAll('\r\n', '\n'),
    };
}

/**
 * Resolve the configured process timeout from effective check settings.
 *
 * @param view the scoped values containing the process timeout setting.
 *
 * @returns the numeric process limit selected for the current scope.
 */
export function getToolTimeoutSeconds(view: Pick<ScopeView, 'settings'>): number {
    return Number(view.settings[TOOL_TIMEOUT_SETTING]);
}
