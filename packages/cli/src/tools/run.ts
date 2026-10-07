// Tool subprocesses share their output environment, configured deadline, and cancellation boundary.
import { run } from '#cli/platform/spawn.ts';
import { TOOL_ENV } from '#cli/config/tools/install.ts';
import { getGitEnvironment } from '#cli/platform/git.ts';
import type { ToolRunOptions } from '#cli/types/tools/run.ts';
import { TOOL_DEADLINE } from '#cli/config/policy/settings.ts';
import { MS_PER_SECOND } from '#cli/config/platform/runtime.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';

/**
 * Runs a tool command with the shared output environment and configured deadline.
 * @param command the expanded argument vector
 * @param options the command directory, environment, deadline, and cancellation
 * @returns the completed process result
 */
export async function runTool(command: string[], options: ToolRunOptions): Promise<SpawnResult> {
    const { timeoutSeconds = TOOL_DEADLINE.default, cancelSignal, ...prepared } = options;
    if (cancelSignal?.aborted === true)
        return {
            code: 1,
            stdout: '',
            stderr: 'The command was canceled.',
            missing: false,
            duration: 0,
            isCanceled: true,
        };
    const selected = await getGitEnvironment(prepared.cwd, command, {
        env: { ...TOOL_ENV, ...prepared.env },
        timeoutMs: timeoutSeconds * MS_PER_SECOND,
        cancelSignal,
    });
    if ('failure' in selected) return selected.failure;
    return run(command, {
        ...prepared,
        env: selected.env,
        timeoutMs: timeoutSeconds * MS_PER_SECOND,
        cancelSignal,
    });
}
