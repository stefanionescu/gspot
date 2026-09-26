import type { MergedView } from '#cli/policy/merge.ts';
import { TOOL_DEADLINE } from '#cli/configurations/settings.ts';
import { run, type SpawnOptions, type SpawnResult } from '#cli/platform/spawn.ts';

const TOOL_ENV = { NO_COLOR: '1', FORCE_COLOR: '0' };
const MILLISECONDS = 1000;
/**
 * Resolve the shared deadline for checks, adapters, corrections, and installation commands.
 * @param view the policy view whose limits apply, or undefined for the default
 * @returns the deadline in seconds
 */
export function toolDeadlineSeconds(view: Pick<MergedView, 'limit'> | undefined): number {
    return view?.limit('tool_seconds') ?? TOOL_DEADLINE.default;
}
/**
 * Runs a tool command with the shared output environment and configured deadline.
 * @param view the policy view whose limits apply
 * @param command the expanded argument vector
 * @param prepared the command directory and expanded environment
 * @param cancelSignal cancellation for the command session
 * @returns the completed process result
 */
export async function runToolCommand(
    view: Pick<MergedView, 'limit'> | undefined,
    command: string[],
    prepared: Pick<SpawnOptions, 'cwd' | 'env' | 'stdin'>,
    cancelSignal?: AbortSignal,
): Promise<SpawnResult> {
    if (cancelSignal?.aborted === true)
        return {
            code: 1,
            stdout: '',
            stderr: 'The command was canceled.',
            missing: false,
            duration: 0,
            isCanceled: true,
        };
    const seconds = toolDeadlineSeconds(view);
    return run(command, {
        ...prepared,
        env: { ...TOOL_ENV, ...prepared.env },
        timeoutMs: seconds * MILLISECONDS,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
}
