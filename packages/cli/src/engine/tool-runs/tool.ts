import { runTool } from '#cli/tools/run.ts';
import { getTool } from '#cli/tools/pins.ts';
import { dirname, delimiter } from 'node:path';
import { CheckStop } from '#cli/system/errors.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import { listSecondaryTools } from '#cli/engine/tools.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { readToolCommandPrefix } from '#cli/tools/packages.ts';
import { lookUpTool, findToolPath } from '#cli/tools/inspect.ts';
import { formatOutputTail } from '#cli/engine/tool-runs/output.ts';
import type { ProcessFailure, ToolRunOptions } from '#cli/types/tools.ts';
import { PROCESS_KILLED_LINE, RAISE_TIMEOUT_MESSAGE } from '#cli/config/engine.ts';
import { foldVariableName, readEnvironmentVariable } from '#cli/system/environment.ts';
import type { CheckTool, CheckToolOptions, ToolProcessResult } from '#cli/types/engine/tool-runs.ts';

async function readCheckTool(
    session: CheckSession,
    planned: PlannedCheck,
    name: string,
    options: CheckToolOptions,
): Promise<CheckTool> {
    const tool = getTool(readConfigurations().values(), name);
    const env = { ...planned.check.env, ...options.env };
    const availability = await findToolPath(session, tool, options.cwd);
    if ('status' in availability) {
        if (availability.status === 'error') throw new CheckStop('error', availability.note);
        throw new CheckStop('missing', availability.note);
    }
    const start = readToolCommandPrefix(session.toolsRoot, tool, availability.path);
    return { name: tool.name, path: availability.path, start, env };
}

function findProcessFailure(result: SpawnResult, name: string, timeoutSeconds: number): ProcessFailure | undefined {
    if (result.canceled) return { status: 'error', note: `${name} was canceled.` };
    if (result.timedOut)
        return {
            status: 'error',
            note: [
                `${name} ran longer than tool_timeout_seconds (${String(timeoutSeconds)}s), so gspot stopped it. ${RAISE_TIMEOUT_MESSAGE}`,
                ...formatOutputTail(result, '').split('\n'),
            ]
                .filter((line) => line !== '' && !PROCESS_KILLED_LINE.test(line))
                .join('\n'),
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
Add the folders of the installed secondary tools of a check to the process `PATH`, also in a copy.

@param session the repository and its configurations.
@param names the secondary tools to add.
@param environment variables for the tool process.
*/
export async function buildSecondaryToolEnvironment(
    session: CheckSession,
    names: string[],
    environment: Record<string, string>,
): Promise<Record<string, string>> {
    const tools = names.map((name) => getTool(readConfigurations().values(), name));
    const inspections = await Promise.all(tools.map((tool) => lookUpTool(session, tool, session.root)));
    const folders = inspections
        .map((inspection) => inspection.path)
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
@param command the tool name and its arguments. With `options.tool`, the program that drives that tool, which gets the
path of the tool as its last argument.
@param options how to start the process, and the tool to find when the command starts another program.
*/
export async function runCheckTool(
    session: CheckSession,
    planned: PlannedCheck,
    command: readonly string[],
    options: CheckToolOptions,
): Promise<SpawnResult> {
    const { name, path, start, env } = await readCheckTool(
        session,
        planned,
        options.tool ?? (command[0] as string),
        options,
    );
    const commandArguments = options.tool === undefined ? [...start, ...command.slice(1)] : [...command, path];
    const secondaryTools = listSecondaryTools(planned.scope, planned.check);
    const toolEnvironment = await buildSecondaryToolEnvironment(session, secondaryTools, env);
    const { result, failure } = await session.limitProcess(() =>
        runToolProcess(commandArguments, {
            ...options,
            env: toolEnvironment,
            cancelSignal: session.cancelSignal,
            timeoutSeconds: session.settings.tool_timeout_seconds,
            name,
        }),
    );
    if (failure?.status === 'missing') throw new CheckStop('missing', failure.note);
    if (failure !== undefined) throw new CheckStop('error', failure.note);
    return result;
}
