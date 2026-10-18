import { dirname, delimiter } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/planning.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import type { ToolSearch } from '#cli/types/tools/find.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { checkCompanions } from '#cli/planning/needed-tools.ts';
import type { CheckInput } from '#cli/types/checks/run/check.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { runTool, getToolTimeoutSeconds } from '#cli/tools/run.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { findExecutionFailure } from '#cli/checks/run/command/output.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import type { ToolRunOptions, ToolAvailability } from '#cli/types/tools/run.ts';
import { findPathKey, readEnvironmentVariable } from '#cli/system/environment.ts';

import type {
    CheckTool,
    PreparedCommand,
    CheckToolOptions,
    CheckToolProgram,
    PlannedToolResult,
} from '#cli/types/checks/run/command.ts';

function checkTool(
    input: CheckInput,
    name: string,
    options: Pick<PreparedCommand, 'cwd'> & Partial<Pick<PreparedCommand, 'env'>>,
): CheckTool {
    const tool = getToolDeclaration(input.manifests.values(), name);
    const env = { ...tool.env, ...input.check.env, ...options.env };
    const availability = findTool(input, options.cwd, tool, env);
    if ('status' in availability) {
        if (availability.status === 'error') throw new Error(availability.note);
        throw new GspotError('tool', availability.note);
    }
    return { name: tool.name, path: availability.path, env };
}

/**
 * Runs a check tool with the tool time limit and classifies its process failure.
 * @param commandArguments the executable and expanded arguments.
 * @param options how to start the process.
 * @param view the scope settings.
 * @param name the tool that a failure note mentions.
 * @returns the process result and any failure.
 */
export async function runPlannedTool(
    commandArguments: string[],
    options: Omit<ToolRunOptions, 'timeoutSeconds'>,
    view: ScopeView,
    name: string,
): Promise<PlannedToolResult> {
    const result = await runTool(commandArguments, { ...options, timeoutSeconds: getToolTimeoutSeconds(view) });
    return { result, failure: findExecutionFailure(result, name, view) };
}

/**
 * Finds the executable of a declared tool, or why it cannot run.
 * @param session the repository and tool paths.
 * @param cwd the working folder.
 * @param tool the declaration with its version pin.
 * @param env variables for the tool process.
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

/**
 * Add the folders of installed companion tools to the process `PATH`, also in a scratch copy.
 * @param input the repository and manifests.
 * @param names the companion tools to add.
 * @param env variables for the tool process.
 * @returns the environment with the companion folders on `PATH`.
 */
export function buildCompanionEnvironment(
    input: Session | CheckInput,
    names: string[] | undefined,
    env: Record<string, string>,
): Record<string, string> {
    const folders = (names ?? [])
        .map((name) => inspectTool(input, getToolDeclaration(input.manifests.values(), name)).path)
        .filter((path) => path !== undefined)
        .map((path) => dirname(path));
    if (folders.length === 0) return env;
    return {
        ...env,
        PATH: [...folders, env[findPathKey(env) ?? 'PATH'] ?? readEnvironmentVariable('PATH') ?? ''].join(delimiter),
    };
}

/**
 * Runs the tool of a check with the tool time limit and failure handling.
 * @param input the check and scope.
 * @param command the executable name and arguments.
 * @param options how to start the process.
 * @returns the process output.
 */
export async function runCheckTool(
    input: CheckInput,
    command: readonly string[] | CheckToolProgram,
    options: CheckToolOptions,
): Promise<SpawnResult> {
    const { name, path, env } = checkTool(input, 'tool' in command ? command.tool : (command[0] as string), options);
    const commandArguments =
        'tool' in command ? [process.execPath, buildAssetPath(command.entry), path] : [path, ...command.slice(1)];
    const { result, failure } = await runPlannedTool(
        commandArguments,
        {
            ...options,
            env: buildCompanionEnvironment(input, checkCompanions(input.selection, input.check), env),
            cancelSignal: input.cancelSignal,
        },
        input.selection.view,
        name,
    );
    if (failure?.status === 'missing') throw new GspotError('tool', failure.note);
    if (failure !== undefined) throw new Error(failure.note);
    return result;
}
