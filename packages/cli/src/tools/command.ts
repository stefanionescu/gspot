import { run } from '#cli/platform/spawn.ts';
import { TOOL_ENV } from '#cli/config/tools/tools.ts';
import { TOOL_DEADLINE } from '#cli/config/policy/policy.ts';
import type { MergedView } from '#cli/types/policy/policy.ts';
import { MS_PER_SECOND } from '#cli/config/platform/platform.ts';
import type { SpawnResult, SpawnOptions } from '#cli/types/platform/platform.ts'; /**
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
    const seconds = view?.limit('tool_seconds') ?? TOOL_DEADLINE.default;
    return run(command, {
        ...prepared,
        env: { ...TOOL_ENV, ...prepared.env },
        timeoutMs: seconds * MS_PER_SECOND,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
}

/**
 * Resolve the shared deadline for checks, adapters, corrections, and installation commands.
 * @param view the policy view whose limits apply, or undefined for the default
 * @returns the deadline in seconds
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two modules read the deadline through it; one owner keeps the default.
export function toolDeadlineSeconds(view: Pick<MergedView, 'limit'> | undefined): number {
    return view?.limit('tool_seconds') ?? TOOL_DEADLINE.default;
}
