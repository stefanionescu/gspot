import { dirname, delimiter } from 'node:path';
import { runTool } from '#cli/executables/run.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { GspotError } from '#cli/system/errors.ts';
import { listOtherTools } from '#cli/planning/tools.ts';
import type { CheckSession } from '#cli/types/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import type { SpawnResult } from '#cli/types/system/system.ts';
import { inspectTool, buildToolAvailability } from '#cli/executables/inspect.ts';
import { foldVariableName, readEnvironmentVariable } from '#cli/system/environment.ts';
import type { ProcessFailure, ToolRunOptions } from '#cli/types/executables/executables.ts';
import type { CheckTool, CheckToolOptions, CheckToolProgram, ToolProcessResult } from '#cli/types/runs/command.ts';

function getCheckTool(
    session: CheckSession,
    planned: PlannedCheck,
    name: string,
    options: CheckToolOptions,
): CheckTool {
    const tool = getTool(session.configurationsByName.values(), name);
    const env = { ...planned.check.env, ...options.env };
    const availability = buildToolAvailability(
        tool,
        inspectTool({ ...session, cwd: options.cwd, miseBinPaths: session.readMiseBinPaths() }, tool),
    );
    if ('status' in availability) {
        if (availability.status === 'error') throw new GspotError('check', availability.note);
        throw new GspotError('tool', availability.note);
    }
    return { name: tool.name, path: availability.path, env };
}

function findProcessFailure(result: SpawnResult, name: string, timeoutSeconds: number): ProcessFailure | undefined {
    if (result.canceled) return { status: 'error', note: `${name} was canceled.` };
    if (result.timedOut)
        return {
            status: 'error',
            note: `${name} ran longer than tool_timeout_seconds (${String(timeoutSeconds)}s), so gspot stopped it.`,
        };
    if (result.missing) return { status: 'missing', note: `gspot could not start ${name}: ${result.stderr.trim()}` };
    if (result.errored)
        return {
            status: 'error',
            note: `${name} could not run: ${result.stderr.trim()}`,
        };
    return undefined;
}

/**
Run a tool process and classify a failure.

@param commandArguments the executable and expanded arguments.
@param options the process options and tool name for a failure note.
*/
export async function runToolProcess(
    commandArguments: string[],
    options: ToolRunOptions & { name: string },
): Promise<ToolProcessResult> {
    const { name, ...processOptions } = options;
    const result = await runTool(commandArguments, processOptions);
    return { result, failure: findProcessFailure(result, name, options.timeoutSeconds) };
}

/**
Add the folders of the installed other tools of a check to the process `PATH`, also in a copy.

@param session the repository and its configurations.
@param names the other tools to add.
@param environment variables for the tool process.
@returns the environment with their folders on `PATH`.
*/
export function buildOtherToolEnvironment(
    session: CheckSession,
    names: string[],
    environment: Record<string, string>,
): Record<string, string> {
    const folders = names
        .map(
            (name) =>
                inspectTool(
                    { ...session, miseBinPaths: session.readMiseBinPaths() },
                    getTool(session.configurationsByName.values(), name),
                ).path,
        )
        .filter((path) => path !== undefined)
        .map((path) => dirname(path));
    if (folders.length === 0) return environment;
    const pathKey = Object.keys(environment).find((name) => foldVariableName(name) === 'PATH') ?? 'PATH';
    return {
        ...environment,
        [pathKey]: [...folders, environment[pathKey] ?? readEnvironmentVariable('PATH') ?? ''].join(delimiter),
    };
}

/**
Run the tool of a check with the tool time limit and failure handling.

@param session the repository and its tools.
@param planned the check and scope.
@param command the executable name and arguments, or a shipped program that drives the tool through its JavaScript API.
@param options how to start the process.
*/
export async function runCheckTool(
    session: CheckSession,
    planned: PlannedCheck,
    command: readonly string[] | CheckToolProgram,
    options: CheckToolOptions,
): Promise<SpawnResult> {
    const { name, path, env } = getCheckTool(
        session,
        planned,
        'tool' in command ? command.tool : (command[0] as string),
        options,
    );
    const commandArguments =
        'tool' in command ? [process.execPath, command.modulePath, path] : [path, ...command.slice(1)];
    const { result, failure } = await session.limitProcess(() =>
        runToolProcess(commandArguments, {
            ...options,
            env: buildOtherToolEnvironment(session, listOtherTools(planned.scope, planned.check), env),
            cancelSignal: session.cancelSignal,
            timeoutSeconds: session.timeoutSeconds,
            name,
        }),
    );
    if (failure?.status === 'missing') throw new GspotError('tool', failure.note);
    if (failure !== undefined) throw new GspotError('check', failure.note);
    return result;
}
