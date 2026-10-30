import { spawnProcess } from '#cli/system/processes.ts';
import { buildGitEnvironment } from '#cli/system/git.ts';
import { TOOL_ENVIRONMENT } from '#cli/config/executables.ts';
import type { SpawnResult } from '#cli/types/system/system.ts';
import type { ToolRunOptions } from '#cli/types/executables/executables.ts';

/**
Run a tool command with the shared output environment and the timeout from the settings.

@param command the expanded arguments.
@param options how the command runs.
*/
export async function runTool(command: readonly string[], options: ToolRunOptions): Promise<SpawnResult> {
    const { timeoutSeconds, cancelSignal, ...spawnOptions } = options;
    const selected = buildGitEnvironment(spawnOptions.cwd, command, { ...TOOL_ENVIRONMENT, ...spawnOptions.env });
    if ('failure' in selected) return selected.failure;
    const result = await spawnProcess(command, {
        ...spawnOptions,
        env: selected.variables,
        timeoutSeconds,
        cancelSignal,
    });
    return {
        ...result,
        stdout: result.stdout.replaceAll('\r\n', '\n'),
        stderr: result.stderr.replaceAll('\r\n', '\n'),
    };
}
