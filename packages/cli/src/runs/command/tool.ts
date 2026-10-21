import { dirname, delimiter } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { type Session } from '#cli/types/session.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import { getMiseBinPaths } from '#cli/tools/locate.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { listCompanionTools } from '#cli/planning/needed-tools.ts';
import { runTool, getToolTimeoutSeconds } from '#cli/tools/run.ts';
import { inspectTool, buildToolAvailability } from '#cli/tools/inspect.ts';
import { findPathKey, readEnvironmentVariable } from '#cli/system/environment.ts';
import type { ToolRunOptions, ProcessFailure, ToolAvailability } from '#cli/types/tools/run.ts';
import type { CheckTool, CheckToolOptions, CheckToolProgram, ToolProcessResult } from '#cli/types/runs/command.ts';

function getCheckTool(session: Session, planned: PlannedCheck, name: string, options: CheckToolOptions): CheckTool {
    const tool = getTool(session.configurations.values(), name);
    const env = { ...planned.check.env, ...options.env };
    const availability = findTool(session, options.cwd, tool);
    if ('status' in availability) {
        if (availability.status === 'error') throw new Error(availability.note);
        throw new GspotError('tool', availability.note);
    }
    return { name: tool.name, path: availability.path, env };
}

/**
 * Classifies a process failure for command checks and built-in checks.
 *
 * @param result what the process returned.
 * @param name the tool that the note mentions.
 * @param timeoutSeconds the process time limit, in seconds.
 * @returns the failure, or undefined for readable output.
 */
function findProcessFailure(result: SpawnResult, name: string, timeoutSeconds: number): ProcessFailure | undefined {
    if (result.canceled) return { status: 'error', note: `${name} was canceled.` };
    if (result.timedOut)
        return {
            status: 'error',
            note: `${name} ran longer than tool_timeout_seconds (${String(timeoutSeconds)}s) and was stopped.`,
        };
    if (result.missing) return { status: 'missing', note: `${name} could not be started: ${result.stderr.trim()}` };
    if (result.errored)
        return {
            status: 'error',
            note: `${name} could not run: ${result.stderr.trim()}`,
        };
    return undefined;
}

/**
 * Run a tool process and classify a failure.
 *
 * @param commandArguments the executable and expanded arguments.
 * @param options the process options and tool name for a failure note.
 * @returns the process result and any failure.
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
 * Finds the executable of a declared tool, or why it cannot run.
 *
 * @param session the repository and tool paths.
 * @param cwd the working folder.
 * @param tool the declaration with its version pin.
 * @returns the executable path or its installation failure.
 */
export function findTool(session: Session, cwd: string, tool: Tool): ToolAvailability {
    const miseBinPaths = getMiseBinPaths(session);
    return buildToolAvailability(tool, inspectTool({ ...session, cwd, miseBinPaths }, tool));
}

/**
 * Add the folders of installed companion tools to the process `PATH`, also in a copy.
 *
 * @param session the repository and manifests.
 * @param names the companion tools to add.
 * @param env variables for the tool process.
 * @returns the environment with the companion folders on `PATH`.
 */
export function buildCompanionEnvironment(
    session: Session,
    names: string[],
    env: Record<string, string>,
): Record<string, string> {
    const folders = names
        .map(
            (name) =>
                inspectTool(
                    { ...session, miseBinPaths: getMiseBinPaths(session) },
                    getTool(session.configurations.values(), name),
                ).path,
        )
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
 *
 * @param session the repository and its tools.
 * @param planned the check and scope.
 * @param command the executable name and arguments.
 * @param options how to start the process.
 * @returns the process output.
 */
export async function runCheckTool(
    session: Session,
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
        'tool' in command ? [process.execPath, buildAssetPath(command.entry), path] : [path, ...command.slice(1)];
    const { result, failure } = await runToolProcess(commandArguments, {
        ...options,
        env: buildCompanionEnvironment(session, listCompanionTools(planned.selection, planned.check), env),
        cancelSignal: session.cancelSignal,
        timeoutSeconds: getToolTimeoutSeconds(planned.selection.view),
        name,
    });
    if (failure?.status === 'missing') throw new GspotError('tool', failure.note);
    if (failure !== undefined) throw new Error(failure.note);
    return result;
}
