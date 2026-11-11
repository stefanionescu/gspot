import { basename, delimiter, dirname } from 'node:path';

import { PROCESS_KILLED_LINE, RAISE_TIMEOUT_MESSAGE } from '#cli/config/engine.ts';
import { findCommandTool } from '#cli/engine/plan.ts';
import { formatOutputTail } from '#cli/engine/tool-runs/output.ts';
import { listSecondaryTools } from '#cli/engine/tools.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { foldVariableName, readEnvironmentVariable } from '#cli/system/environment.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { findToolPath, lookUpTool } from '#cli/tools/inspect.ts';
import { readToolCommandPrefix } from '#cli/tools/packages.ts';
import { runTool } from '#cli/tools/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import type { CheckTool, CheckToolOptions, ToolProcessResult } from '#cli/types/engine/tool-runs.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import type { ProcessFailure, ToolRunOptions } from '#cli/types/tools.ts';

async function readCheckTool(
    session: CheckSession,
    planned: PlannedCheck,
    name: string,
    options: CheckToolOptions,
): Promise<CheckTool> {
    const tool = findCommandTool(readConfigurations().values(), name);
    const env = { ...planned.check.env, ...options.env };
    const availability = await findToolPath(session, tool, options.cwd);
    if ('status' in availability) {
        if (availability.status === 'error') throw new CheckStop('error', availability.note);
        throw new CheckStop('missing', availability.note);
    }
    const start = readToolCommandPrefix(session.toolsRoot, tool, availability.path);
    return { name: tool.name, path: availability.path, start, env };
}

function findProcessFailure(
    result: SpawnResult,
    {
        name,
        timeoutSeconds,
        exitCodes,
    }: { name: string; timeoutSeconds: number; exitCodes: readonly number[] | undefined },
): ProcessFailure | undefined {
    if (result.end === 'canceled') return { status: 'canceled', note: `${name} was canceled.` };
    if (result.end === 'timed-out')
        return {
            status: 'error',
            note: [
                `${name} ran longer than tool_timeout_seconds (${String(timeoutSeconds)}s), so gspot stopped it. ${RAISE_TIMEOUT_MESSAGE}`,
                ...formatOutputTail(result, '').split('\n'),
            ]
                .filter((line) => line !== '' && !PROCESS_KILLED_LINE.test(line))
                .join('\n'),
        };
    if (result.end === 'missing')
        return { status: 'missing', note: `gspot could not start ${name}: ${result.stderr.trim()}` };
    if (result.end === 'failed') return { status: 'error', note: `${name} could not run: ${result.stderr.trim()}` };
    if (exitCodes !== undefined && result.code !== 0 && !exitCodes.includes(result.code))
        return {
            status: 'error',
            note: `The ${basename(name)} command failed (exit ${String(result.code)}): ${formatOutputTail(result)}`,
        };
    return undefined;
}

/**
Run a tool process and classify a failure. With exit codes, any other nonzero exit code is a failure too.
*/
export async function runToolProcess(
    commandArguments: string[],
    options: ToolRunOptions & { name: string; exitCodes?: readonly number[] },
): Promise<ToolProcessResult> {
    const { name, exitCodes, ...processOptions } = options;
    const result = await runTool(commandArguments, processOptions);
    return { result, failure: findProcessFailure(result, { name, timeoutSeconds: options.timeoutSeconds, exitCodes }) };
}

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

export async function runCheckTool(
    session: CheckSession,
    planned: PlannedCheck,
    command: readonly string[],
    options: CheckToolOptions,
): Promise<SpawnResult> {
    const { tool, ...launch } = options;
    const { name, path, start, env } = await readCheckTool(session, planned, tool ?? (command[0] as string), launch);
    const commandArguments = tool === undefined ? [...start, ...command.slice(1)] : [...command, path];
    const secondaryTools = listSecondaryTools(planned.scope, planned.check);
    const toolEnvironment = await buildSecondaryToolEnvironment(session, secondaryTools, env);
    const { result, failure } = await session.limitProcess(() =>
        runToolProcess(commandArguments, {
            ...launch,
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
