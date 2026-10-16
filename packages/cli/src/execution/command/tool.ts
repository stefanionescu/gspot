import { dirname, delimiter } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/planning.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import type { ToolSearch } from '#cli/types/tools/find.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { checkCompanions } from '#cli/planning/needed-tools.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { runTool, getToolTimeoutSeconds } from '#cli/tools/run.ts';
import { executionFailure } from '#cli/execution/command/output.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import type { ToolRunOptions, ToolAvailability } from '#cli/types/tools/run.ts';
import { environmentKey, readEnvironmentVariable } from '#cli/system/environment.ts';

import type {
    CheckTool,
    PreparedCommand,
    CheckToolOptions,
    CheckToolProgram,
    PlannedToolResult,
} from '#cli/types/execution/command.ts';

function checkTool(
    input: CheckInput,
    name: string,
    options: Pick<PreparedCommand, 'cwd'> & Partial<Pick<PreparedCommand, 'env'>>,
): CheckTool {
    const tool = toolDeclaration(input.manifests.values(), name);
    const env = { ...tool.env, ...input.check.env, ...options.env };
    const availability = findTool(input, options.cwd, tool, env);
    if ('status' in availability) {
        if (availability.status === 'error') throw new Error(availability.note);
        throw new GspotError('tool', availability.note);
    }
    return { name: tool.name, path: availability.path, env };
}

/**
 * Run a check tool with the shared timeout and classify its process failure.
 *
 * @param argv the executable and expanded arguments.
 * @param options the command options.
 * @param view the resolved scope settings.
 * @param name the tool or setting name.
 *
 * @returns the process result and any execution failure.
 */
export async function runPlannedTool(
    argv: string[],
    options: Omit<ToolRunOptions, 'timeoutSeconds'>,
    view: ScopeView,
    name: string,
): Promise<PlannedToolResult> {
    const result = await runTool(argv, { ...options, timeoutSeconds: getToolTimeoutSeconds(view) });
    return { result, failure: executionFailure(result, name, view) };
}

/**
 * Resolve the declared tool once and return its executable or installation error.
 *
 * @param session the repository session.
 * @param cwd the tool working directory.
 * @param tool the declared tool and its installation pin.
 * @param env the environment for the tool process.
 *
 * @returns the executable path or its installation failure.
 */
export function findTool(
    session: ToolSearch,
    cwd: string,
    tool: ToolDeclaration,
    env?: Record<string, string>,
): ToolAvailability {
    return buildToolAvailability(tool, inspectTool({ ...session, cwd }, env === undefined ? tool : { ...tool, env }));
}

// A nested tool runs from its selected installation even inside a scratch copy.
/**
 * Add installed companion directories to the process path.
 *
 * @param input the source values.
 * @param names the companion tool names.
 * @param env the environment for the tool process.
 *
 * @returns the process environment with installed companion directories.
 */
export function companionEnvironment(
    input: Session | CheckInput,
    names: string[] | undefined,
    env: Record<string, string>,
): Record<string, string> {
    const directories = (names ?? [])
        .map((name) => inspectTool(input, toolDeclaration(input.manifests.values(), name)).path)
        .filter((path) => path !== undefined)
        .map((path) => dirname(path));
    if (directories.length === 0) return env;
    return {
        ...env,
        PATH: [
            ...directories,
            env[Object.keys(env).find((name) => environmentKey(name) === 'PATH') ?? 'PATH'] ??
                readEnvironmentVariable('PATH') ??
                '',
        ].join(delimiter),
    };
}

/**
 * Run a check's tool through the shared execution boundaries.
 *
 * @param input the check and its command session.
 * @param command the executable name and arguments.
 * @param options the working directory, environment, and standard input.
 *
 * @returns captured output after checking process failures.
 */
export async function runCheckTool(
    input: CheckInput,
    command: readonly string[] | CheckToolProgram,
    options: CheckToolOptions,
): Promise<SpawnResult> {
    const { name, path, env } = checkTool(input, 'tool' in command ? command.tool : (command[0] as string), options);
    const argv =
        'tool' in command ? [process.execPath, buildAssetPath(command.entry), path] : [path, ...command.slice(1)];
    const { result, failure } = await runPlannedTool(
        argv,
        {
            ...options,
            env: companionEnvironment(input, checkCompanions(input.selection, input.check), env),
            cancelSignal: input.cancelSignal,
        },
        input.selection.view,
        name,
    );
    if (failure?.status === 'missing') throw new GspotError('tool', failure.note);
    if (failure !== undefined) throw new Error(failure.note);
    return result;
}
