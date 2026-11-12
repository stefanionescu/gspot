import { join, relative } from 'node:path';

import { FILES_PLACEHOLDER, RAN_STATUSES } from '#cli/config/engine.ts';
import { createCopy } from '#cli/engine/copies/files.ts';
import { stripCoverageArguments } from '#cli/engine/plan.ts';
import { buildBaseResult, measureSpan, mergeCheckResults, restoreCommandPaths } from '#cli/engine/results.ts';
import { buildCommandLines } from '#cli/engine/tool-runs/batches.ts';
import {
    addCommandLine,
    buildCheckResult,
    clearOutsideLinkExit,
    parseCommandFindings,
} from '#cli/engine/tool-runs/output.ts';
import {
    buildFileCommandLines,
    expandCommand,
    isPackageFolderRun,
    listCommandConfigs,
    listCopyFiles,
    replacePlaceholders,
} from '#cli/engine/tool-runs/placeholders.ts';
import { buildSecondaryToolEnvironment, runToolProcess } from '#cli/engine/tool-runs/tool.ts';
import { listSecondaryTools } from '#cli/engine/tools.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText } from '#cli/system/files/reads.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { findToolPath, lookUpTool } from '#cli/tools/inspect.ts';
import { readToolCommandPrefix } from '#cli/tools/packages.ts';
import { buildCopyPythonEnvironment, listCopyPythonArguments } from '#cli/tools/python-environment.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckResult, CheckRunOptions, CheckSession, CommandLaunch } from '#cli/types/engine/run.ts';
import type { CommandBatch, CommandRun, CommandSetup, FolderRun, Substitutions } from '#cli/types/engine/tool-runs.ts';
import type { Tool } from '#cli/types/manifests.ts';
import type { ProcessFailure } from '#cli/types/tools.ts';

async function runCommands(
    planned: PlannedCheck,
    {
        session,
        verbose,
        tool,
        launch,
        base,
    }: {
        session: CheckSession;
        verbose: boolean | undefined;
        tool: Tool;
        launch: CommandLaunch;
        base: CheckResult;
    },
): Promise<CheckResult> {
    const { check } = planned;
    const { cwd, commandArguments } = launch;
    const state: CommandRun = { root: launch.root, cwd, findings: [], failed: false };
    const slot: { start?: number } = {};
    for (const commandLine of launch.commandLines) {
        const { result: finished, failure } = await session.limitProcess(() => {
            slot.start ??= performance.now();
            return runToolProcess(commandLine.commandArguments, {
                ...launch,
                cancelSignal: session.cancelSignal,
                timeoutSeconds: session.settings.tool_timeout_seconds,
                name: tool.name,
            });
        });
        if (failure !== undefined)
            return {
                ...base,
                ...failure,
                ...measureSpan(slot.start),
                command: commandArguments,
                findings: state.findings,
            };
        const result = clearOutsideLinkExit(check, finished, state.root);
        const parsed = parseCommandFindings(planned, result, { cwd, root: state.root }, { verbose });
        if (parsed.findings === undefined)
            return {
                ...base,
                status: 'error',
                ...measureSpan(slot.start),
                note: parsed.note,
                command: commandArguments,
                findings: state.findings,
            };
        addCommandLine(planned, tool, { commandLine, result, findings: parsed.findings }, state);
    }
    return buildCheckResult(planned, { base, state, commandArguments, start: slot.start });
}

function findMissingConfig(
    planned: PlannedCheck,
    { session, command, base }: { session: CheckSession; command: string[]; base: CheckResult },
): CheckResult | undefined {
    const files = openFiles(session.root);
    const missing = listCommandConfigs(session, planned, command).find(
        (path) => (isGspotPath(path) ? files.read(path) : findText(session.cache, path)) === undefined,
    );
    return missing === undefined
        ? undefined
        : { ...base, status: 'error', note: `The generated file ${missing} is missing. Run gspot install.` };
}

async function runInFolder(run: FolderRun): Promise<CheckResult> {
    const { session, planned, tool, command, toolPath, base, options } = run;
    using copy =
        planned.check.run_in_copy === true
            ? await createCopy(session, listCopyFiles(session, planned, command))
            : undefined;
    const root = copy?.path ?? session.root;
    const commandSetup = buildCommandLaunch(planned, { session, command, root, tool, toolPath });
    commandSetup.env = await buildSecondaryToolEnvironment(
        session,
        listSecondaryTools(planned.scope, planned.check, command),
        commandSetup.env,
    );
    const result = await runCommands(planned, {
        session,
        verbose: options.verbose,
        tool,
        launch: commandSetup,
        base,
    });
    return restoreCommandPaths(result, root, session.root);
}

async function findMissingSecondaryTool(
    session: CheckSession,
    planned: PlannedCheck,
    command: string[],
    cwd: string,
): Promise<ProcessFailure | undefined> {
    for (const name of listSecondaryTools(planned.scope, planned.check, command)) {
        const required = getTool(readConfigurations().values(), name);
        const availability = await findToolPath(session, required, cwd);
        if ('status' in availability) return availability;
    }
    return undefined;
}

function buildCommandSetup(session: CheckSession, planned: PlannedCheck, root: string): CommandSetup {
    const { scope } = planned;
    const cwd = selectCommandFolder(root, planned);
    const substitutions = buildCommandSubstitutions(root, planned, cwd, session.selection?.messageFile);
    const files = substitutions.files;
    const env =
        planned.check.env === undefined
            ? {}
            : Object.fromEntries(
                  Object.entries(planned.check.env).map(([name, value]) => [
                      name,
                      replacePlaceholders(session, planned, value, substitutions),
                  ]),
              );
    const python =
        planned.check.needs?.includes('python-environment') === true
            ? buildCopyPythonEnvironment({ root, toolsRoot: session.toolsRoot }, scope.path)
            : {};
    return { root, cwd, files, substitutions, env: { ...env, ...python } };
}

export function selectCommandFolder(root: string, planned: PlannedCheck): string {
    const { check, scope } = planned;
    const isInScopeFolder =
        check.cwd === 'scope' || (check.runs === 'scope' && check.cwd !== 'root') || isPackageFolderRun(root, planned);
    return isInScopeFolder ? join(root, scope.path) : root;
}

export function buildCommandSubstitutions(
    root: string,
    planned: PlannedCheck,
    cwd: string,
    messageFile: string | undefined,
): Substitutions {
    const substitutions: Substitutions = {
        files: planned.files
            .map((file) => convertToPosixPath(relative(cwd, join(root, file.path))))
            .map((path) => (path.startsWith('-') ? `./${path}` : path)),
        scopePath: planned.scope.path,
        root,
    };
    if (messageFile !== undefined) substitutions.messageFile = messageFile;
    return substitutions;
}

export function buildCommandLaunch(
    planned: PlannedCheck,
    expansion: { session: CheckSession; command: string[]; root: string; tool: Tool; toolPath: string },
): CommandLaunch {
    const { session, root, tool, toolPath } = expansion;
    const { cwd, files, substitutions, env } = buildCommandSetup(session, planned, root);
    const command = [...readToolCommandPrefix(session.toolsRoot, tool, toolPath), ...expansion.command.slice(1)];
    const commandArguments = expandCommand(session, planned, command, substitutions);
    const commandLines = command.some((argument) => FILES_PLACEHOLDER.test(argument))
        ? buildCommandLines(planned, { session, command, substitutions })
        : buildFileCommandLines(commandArguments, files);
    return {
        root,
        cwd,
        commandArguments: commandArguments.filter((argument) => typeof argument === 'string'),
        commandLines,
        env,
    };
}

export async function runCommandCheck(
    session: CheckSession,
    planned: PlannedCheck,
    options: Pick<CheckRunOptions, 'verbose' | 'command'> = {},
): Promise<CheckResult> {
    const { tool } = planned;
    const authored = stripCoverageArguments(planned, options);
    // The plan gives a tool to each check with a command, and a check without one passes the command it builds.
    if (tool === undefined || authored === undefined)
        throw new Error(`${planned.check.id} runs a command, but it has no command or no tool.`);
    const base = buildBaseResult(planned, session);
    const setup = buildCommandSetup(session, planned, session.root);
    const command = [...authored, ...listCopyPythonArguments(tool, setup.env)];
    const { cwd } = setup;
    const missing = findMissingConfig(planned, { session, command, base });
    if (missing !== undefined) return missing;
    const availability = await findToolPath(session, tool, cwd);
    if ('status' in availability) return { ...base, ...availability };
    const secondaryToolFailure = await findMissingSecondaryTool(session, planned, command, cwd);
    return secondaryToolFailure === undefined
        ? await runInFolder({
              session,
              planned,
              tool,
              command,
              toolPath: availability.path,
              base,
              options,
          })
        : { ...base, ...secondaryToolFailure };
}

export async function lookUpCommandTools(
    session: CheckSession,
    checks: PlannedCheck[],
    codes: ReadonlyMap<PlannedCheck, CheckCode | undefined>,
): Promise<void> {
    await Promise.allSettled(
        checks.flatMap((planned) => {
            if (planned.tool === undefined || codes.get(planned)?.check !== undefined) return [];
            const cwd = selectCommandFolder(session.root, planned);
            const names = listSecondaryTools(planned.scope, planned.check, stripCoverageArguments(planned, {}));
            const tools = [planned.tool, ...names.map((name) => getTool(readConfigurations().values(), name))];
            return tools.map((tool) => lookUpTool(session, tool, cwd));
        }),
    );
}

/**
Run each command batch and merge the findings, keeping earlier findings when a later run fails.
*/
export async function runCommandBatches(
    session: CheckSession,
    planned: PlannedCheck,
    batches: CommandBatch[],
): Promise<CheckResult> {
    let merged = buildBaseResult(planned, session);
    for (const { files, command } of batches) {
        merged = mergeCheckResults(merged, await runCommandCheck(session, { ...planned, files }, { command }));
        if (!RAN_STATUSES.has(merged.status)) break;
    }
    return merged;
}
