// Run tools with the configured timeout and shared process options.
import { GspotError } from '#cli/system/errors.ts';
import { TOOL_ENV } from '#cli/config/tools/run.ts';
import { spawnProcess } from '#cli/system/processes.ts';
import { buildGitEnvironment } from '#cli/system/git.ts';
import type { ToolRunOptions } from '#cli/types/tools/run.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { TOOL_TIMEOUT_SETTING } from '#cli/config/settings/values.ts';

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
 * Throw for an install step that ran past the time limit, so the error names the limit, not an exit code.
 *
 * @param name what the error calls the step.
 * @param result what the process printed, and its exit code.
 * @param timeoutSeconds the limit the step ran under.
 */
export function assertWithinTimeLimit(name: string, result: SpawnResult, timeoutSeconds: number): void {
    if (result.isTimedOut === true)
        throw new GspotError(
            'installation',
            `${name} ran longer than ${TOOL_TIMEOUT_SETTING} (${String(timeoutSeconds)}s). Raise it with gspot set ${TOOL_TIMEOUT_SETTING} <seconds>, then run: gspot install.`,
        );
}

/**
 * Read the process timeout from the scope settings.
 *
 * @param view the scope settings with the timeout.
 *
 * @returns the timeout in seconds.
 */
export function getToolTimeoutSeconds(view: Pick<ScopeView, 'settings'>): number {
    return Number(view.settings[TOOL_TIMEOUT_SETTING]);
}
