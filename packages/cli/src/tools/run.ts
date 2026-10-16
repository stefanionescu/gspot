import { run } from '#cli/system/processes.ts';
import { TOOL_ENV } from '#cli/config/tools/run.ts';
import { MS_PER_SECOND } from '#cli/config/units.ts';
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
    const result = await run(command, {
        ...prepared,
        env: selected.env,
        timeoutMs: toolTimeoutMilliseconds(timeoutSeconds),
        cancelSignal,
    });
    return {
        ...result,
        stdout: result.stdout.replaceAll('\r\n', '\n'),
        stderr: result.stderr.replaceAll('\r\n', '\n'),
    };
}
/**
 * The single tool timeout converted for process APIs.
 *
 * @param seconds the duration in seconds.
 *
 * @returns the duration in milliseconds.
 */
export function toolTimeoutMilliseconds(seconds: number): number {
    return seconds * MS_PER_SECOND;
}

/**
 * Resolve the configured process timeout from effective check settings.
 *
 * @param view the effective check settings.
 *
 * @returns the timeout in seconds.
 */
export function toolTimeoutSeconds(view: Pick<ScopeView, 'settings'>): number {
    return Number(view.settings[TOOL_TIMEOUT_SETTING]);
}
