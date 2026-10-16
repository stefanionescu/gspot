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
import { normalizeEnvironmentKey, readEnvironmentVariable } from '#cli/system/environment.ts';

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
 * Run a check tool with the shared timeout and classify its process failure.
 *
 * @param commandArguments the executable and expanded arguments.
 * @param options the command options.
 * @param view the resolved scope settings.
 * @param name the tool or setting name.
 *
 * @returns the process result and any execution failure.
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

/**
 * Add installed companion directories to the process path, including inside a scratch copy.
 *
 * @param input the source values.
 * @param names the companion tool names.
 * @param env the environment for the tool process.
 *
 * @returns the process environment with installed companion directories.
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
        PATH: [
            ...folders,
            env[Object.keys(env).find((name) => normalizeEnvironmentKey(name) === 'PATH') ?? 'PATH'] ??
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
    const commandArguments =
        'tool' in command ? [process.execPath, buildAssetPath(command.entry), path] : [path, ...command.slice(1)];
    const { result, failure } = await runPlannedTool(
        commandArguments,
        {
            ...options,
            env: buildCompanionEnvironment(input, checkCompanions(input.scope, input.check), env),
            cancelSignal: input.cancelSignal,
        },
        input.scope.view,
        name,
    );
    if (failure?.status === 'missing') throw new GspotError('tool', failure.note);
    if (failure !== undefined) throw new Error(failure.note);
    return result;
}
