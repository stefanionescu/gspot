import { TOOL_ENVIRONMENT } from '#cli/config/tools/programs.ts';
import { buildGitEnvironment } from '#cli/repository/git/run.ts';
import { runProcess } from '#cli/system/processes/run.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import type { ToolRunOptions } from '#cli/types/tools.ts';

export async function runTool(command: readonly string[], options: ToolRunOptions): Promise<SpawnResult> {
    const { timeoutSeconds, cancelSignal, ...spawnOptions } = options;
    const selected = await buildGitEnvironment(spawnOptions.cwd, command, { ...TOOL_ENVIRONMENT, ...spawnOptions.env });
    if ('failure' in selected) return selected.failure;
    const result = await runProcess(command, {
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
