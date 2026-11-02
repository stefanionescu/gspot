import { join, relative } from 'node:path';
import { getTool } from '#cli/tools/pins.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { findToolPath } from '#cli/tools/inspect.ts';
import { listOtherTools } from '#cli/engine/tools.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findText } from '#cli/system/files/reads.ts';
import { createCopy } from '#cli/engine/copies/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { ProcessFailure } from '#cli/types/tools.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { stripCoverageArguments } from '#cli/engine/plan.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { readToolCommandPrefix } from '#cli/tools/packages.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { buildCommandLines } from '#cli/engine/tool-runs/batches.ts';
import { RAN_STATUSES, FILES_PLACEHOLDER } from '#cli/config/engine.ts';
import { listCopyPythonArguments, buildCopyPythonEnvironment } from '#cli/tools/uv.ts';
import { runToolProcess, buildOtherToolEnvironment } from '#cli/engine/tool-runs/tool.ts';
import { buildBaseResult, mergeCheckResults, restoreCommandPaths } from '#cli/engine/results.ts';
import { addCommandLine, buildCheckResult, parseCommandFindings } from '#cli/engine/tool-runs/output.ts';
import type { CheckResult, CheckSession, CommandLaunch, CheckRunOptions } from '#cli/types/engine/run.ts';
import type { FolderRun, CommandRun, CommandBatch, CommandSetup, Substitutions } from '#cli/types/engine/tool-runs.ts';

import {
    expandCommand,
    listCopyFiles,
    listCommandConfigs,
    replacePlaceholders,
    runsInPackageFolder,
    buildFileCommandLines,
} from '#cli/engine/tool-runs/placeholders.ts';

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
    const started = performance.now();
    for (const commandLine of launch.commandLines) {
        const { result, failure } = await session.limitProcess(() =>
            runToolProcess(commandLine.commandArguments, {
                ...launch,
                cancelSignal: session.cancelSignal,
                timeoutSeconds: session.settings.tool_timeout_seconds,
                name: tool.name,
            }),
        );
        if (failure !== undefined)
            return {
                ...base,
                ...failure,
                duration: Math.round(performance.now() - started),
                command: commandArguments,
                findings: state.findings,
            };
        const parsed = parseCommandFindings(planned, result, { cwd, root: state.root }, { verbose });
        if (parsed.findings === undefined)
            return {
                ...base,
                status: 'error',
                duration: Math.round(performance.now() - started),
                note: parsed.note,
                command: commandArguments,
                findings: state.findings,
            };
        addCommandLine(planned, tool, { commandLine, result, findings: parsed.findings }, state);
    }
    return buildCheckResult(check, { base, state, commandArguments, started });
}

function findMissingConfig(
    planned: PlannedCheck,
    { session, command, base }: { session: CheckSession; command: string[]; base: CheckResult },
): CheckResult | undefined {
    const files = openFiles(session.root);
    const missing = listCommandConfigs(session, planned, command).find(
        (path) => (isGspotPath(path) ? files.read(path) : findText(session.cache, path)) === undefined,
    );
    if (missing === undefined) return undefined;
    return { ...base, status: 'error', note: `The generated file ${missing} is missing. Run gspot apply.` };
}

async function runInFolder(run: FolderRun): Promise<CheckResult> {
    const { session, planned, tool, command, toolPath, base, options } = run;
    using copy =
        planned.check.run_in_copy === true
            ? await createCopy(session, listCopyFiles(session, planned, command))
            : undefined;
    const root = copy?.path ?? session.root;
    const commandSetup = buildCommandLaunch(planned, { session, command, root, toolPath });
    commandSetup.env = await buildOtherToolEnvironment(
        session,
        listOtherTools(planned.scope, planned.check, command),
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

async function findMissingOtherTool(
    session: CheckSession,
    planned: PlannedCheck,
    command: string[],
    cwd: string,
): Promise<ProcessFailure | undefined> {
    for (const name of listOtherTools(planned.scope, planned.check, command)) {
        const required = getTool(readConfigurations().values(), name);
        const availability = await findToolPath(session, required, cwd);
        if ('status' in availability) return availability;
    }
    return undefined;
}

/**
Select the folder that a command of a check runs in.

@param root the repository, or the copy of it that the tool runs in.
@param planned the check and its scope.
*/
export function selectCommandFolder(root: string, planned: PlannedCheck): string {
    const { check, scope } = planned;
    const usesScopeFolder =
        check.cwd === 'scope' || (check.runs === 'scope' && check.cwd !== 'root') || runsInPackageFolder(root, planned);
    return usesScopeFolder ? join(root, scope.path) : root;
}

/**
Resolves the working folder and expands the tool environment values.

@param session the repository and its settings.
@param planned the check and its files.
@param root the repository, or the copy of it that the command runs in.
*/
function buildCommandSetup(session: CheckSession, planned: PlannedCheck, root: string): CommandSetup {
    const { scope } = planned;
    const cwd = selectCommandFolder(root, planned);
    const substitutions = buildCommandSubstitutions(root, planned, cwd);
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

/**
Builds the placeholder values from the scope and working folder.

@param root the repository, or the copy of it that the tool runs in.
@param planned the check and its files.
@param cwd the folder that the tool runs in.
@returns the placeholder values, with paths relative to cwd.
*/
export function buildCommandSubstitutions(root: string, planned: PlannedCheck, cwd: string): Substitutions {
    const substitutions: Substitutions = {
        files: planned.files
            .map((file) => convertToPosixPath(relative(cwd, join(root, file.path))))
            .map((path) => (path.startsWith('-') ? `./${path}` : path)),
        scope: planned.scope.path,
        root,
    };
    if (planned.messageFile !== undefined) substitutions.messageFile = planned.messageFile;
    return substitutions;
}

/**
Expands a check or fix command into file batches that fit the command line.

@param planned the check to run.
@param expansion what to run.
@param expansion.session the repository and its tools.
@param expansion.command the executable and the arguments as declared.
@param expansion.root the repository, or the copy of it that the tool runs in.
@param expansion.toolPath the resolved executable path.
*/
export function buildCommandLaunch(
    planned: PlannedCheck,
    expansion: { session: CheckSession; command: string[]; root: string; toolPath: string },
): CommandLaunch {
    const { session, root, toolPath } = expansion;
    const { cwd, files, substitutions, env } = buildCommandSetup(session, planned, root);
    const command = [
        ...readToolCommandPrefix(session.toolsRoot, planned.tool as Tool, toolPath),
        ...expansion.command.slice(1),
    ];
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

/**
Finds the tool and runs the expanded commands of a check.

@param session the repository and its tools.
@param planned the check to run.
@param options the command override and the verbosity of the notes.
*/
export async function runCommandCheck(
    session: CheckSession,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    const tool = planned.tool as Tool;
    const base = buildBaseResult(planned, session);
    const setup = buildCommandSetup(session, planned, session.root);
    const command = [
        ...(stripCoverageArguments(planned, options) as string[]),
        ...listCopyPythonArguments(tool, setup.env),
    ];
    const { cwd } = setup;
    const missing = findMissingConfig(planned, { session, command, base });
    if (missing !== undefined) return missing;
    const availability = await findToolPath(session, tool, cwd);
    if ('status' in availability) return { ...base, ...availability };
    const otherToolFailure = await findMissingOtherTool(session, planned, command, cwd);
    return otherToolFailure === undefined
        ? await runInFolder({
              session,
              planned,
              tool,
              command,
              toolPath: availability.path,
              base,
              options,
          })
        : { ...base, ...otherToolFailure };
}

/**
Run each command batch and merge the findings, keeping earlier findings when a later run fails.

@param session the repository and tools.
@param planned the check to run.
@param batches the files and command of each run.
@returns the merged result, or the first failure with the findings so far.
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
