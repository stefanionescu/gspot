import { join, relative } from 'node:path';
import { getTool } from '#cli/manifests/tools.ts';
import { find } from '#cli/system/files/reads.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { createCopy } from '#cli/runs/copy/files.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { listOtherTools } from '#cli/planning/tools.ts';
import { RAN_STATUSES } from '#cli/config/runs/check.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildCommandLines } from '#cli/runs/command/batches.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import type { ProcessFailure } from '#cli/types/executables/run.ts';
import { PYTHON_CONFIGURATION } from '#cli/config/manifests/names.ts';
import { buildBaseResult, mergeCheckResults } from '#cli/runs/results.ts';
import { FILES_PLACEHOLDER } from '#cli/config/runs/command/placeholders.ts';
import type { CheckResult, CheckRunOptions } from '#cli/types/runs/check.ts';
import { inspectTool, buildToolAvailability } from '#cli/executables/inspect.ts';
import { hasProjectCoverage, stripCoverageArguments } from '#cli/planning/checks.ts';
import { runToolProcess, buildOtherToolEnvironment } from '#cli/runs/command/tool.ts';
import { addCommandLine, buildCheckResult, parseCommandFindings } from '#cli/runs/command/output.ts';

import {
    listCopyPythonArguments,
    buildCopyPythonEnvironment,
    findMissingProjectEnvironment,
} from '#cli/executables/uv.ts';
import type {
    FolderRun,
    CommandRun,
    CommandBatch,
    CommandSetup,
    Substitutions,
    CommandLaunch,
} from '#cli/types/runs/command.ts';
import {
    expandCommand,
    listCopyFiles,
    replacePlaceholders,
    runsInPackageFolder,
    buildFileCommandLines,
    listCommandConfigFiles,
} from '#cli/runs/command/placeholders.ts';

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
                timeoutSeconds: session.timeoutSeconds,
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

function findMissingConfigFile(
    planned: PlannedCheck,
    {
        session,
        command,
        base,
        configFiles,
    }: { session: Session; command: string[]; base: CheckResult; configFiles: string[] },
): CheckResult | undefined {
    const files = openFiles(session.root);
    const missing = [...configFiles, ...listCommandConfigFiles(session, planned, command)].find(
        (path) => (path.startsWith(`${GSPOT_FOLDER}/`) ? files.read(path) : find(session.reads, path)) === undefined,
    );
    if (missing === undefined) return undefined;
    return { ...base, status: 'error', note: `The generated file ${missing} is missing. Run gspot apply.` };
}

async function runInFolder(run: FolderRun): Promise<CheckResult> {
    const { session, planned, tool, command, toolPath, setup, base, options, configFiles } = run;
    using copy =
        options.copyRoot === undefined && planned.check.run_in_copy === true
            ? await createCopy({
                  root: session.root,
                  paths: [...listCopyFiles(session, planned, command), ...configFiles],
                  dependencies: [],
                  cancelSignal: session.cancelSignal,
              })
            : undefined;
    const folder = options.copyRoot ?? copy?.path;
    const commandSetup =
        folder === undefined
            ? prepareCommand(planned, { session, command, setup, toolPath })
            : prepareCommand(planned, {
                  session: session,
                  command: command,
                  setup: buildCommandSetup(session, planned, { options: options, root: folder }),
                  toolPath: toolPath,
              });
    commandSetup.env = buildOtherToolEnvironment(
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
    if (folder === undefined) return result;
    const reported = expandCommand(session, planned, command.with(0, toolPath), setup.substitutions);
    return { ...result, command: reported.filter((argument) => typeof argument === 'string') };
}

function findMissingOtherTool(
    session: CheckSession,
    planned: PlannedCheck,
    command: string[],
    cwd: string,
): ProcessFailure | undefined {
    for (const name of listOtherTools(planned.scope, planned.check, command)) {
        const required = getTool(session.configurationsByName.values(), name);
        const availability = buildToolAvailability(
            required,
            inspectTool({ ...session, cwd: cwd, miseBinPaths: session.readMiseBinPaths() }, required),
        );
        if ('status' in availability) return availability;
    }
    return undefined;
}

function selectCommandFolder(root: string, planned: PlannedCheck): string {
    const { check, scope } = planned;
    const usesScopeFolder =
        check.cwd === 'scope' || (check.runs === 'scope' && check.cwd !== 'root') || runsInPackageFolder(root, planned);
    return usesScopeFolder ? join(root, scope.path) : root;
}

/**
Resolves the working folder and expands the tool environment values.

@param session the repository and its settings.
@param planned the check and its files.
@param setup the overrides and the folder of the run.
@param setup.options the overrides from the check code.
@param setup.root the repository, or the copy of it that the command runs in.
*/
export function buildCommandSetup(
    session: Session,
    planned: PlannedCheck,
    { options, root }: { options: CheckRunOptions; root: string },
): CommandSetup {
    const { scope } = planned;
    const cwd = selectCommandFolder(root, planned);
    const substitutions = buildCommandSubstitutions(root, planned, cwd);
    const files = substitutions.files;
    if (options.listFileArguments !== undefined) substitutions.files = options.listFileArguments(session, planned);
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
        planned.configuration?.name === PYTHON_CONFIGURATION
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
        indent:
            planned.scope.settings.tables.format.indent_style === 'space'
                ? planned.scope.settings.tables.format.indent_width
                : 0,
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
@param expansion.setup the working paths and tool variables.
@param expansion.toolPath the resolved executable path.
*/
export function prepareCommand(
    planned: PlannedCheck,
    expansion: { session: Session; command: string[]; setup: CommandSetup; toolPath: string },
): CommandLaunch {
    const { session, setup, toolPath } = expansion;
    const { root, cwd, files, substitutions, env } = setup;
    const command = expansion.command.with(0, toolPath);
    const commandArguments = expandCommand(session, planned, command, substitutions);
    const commandLines = command.includes(FILES_PLACEHOLDER)
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
@param options the command and copy folder overrides.
*/
export async function runCommandCheck(
    session: CheckSession,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    const tool = planned.tool as Tool;
    const base = buildBaseResult(planned, session);
    const missingEnvironment = findMissingProjectEnvironment(session, planned);
    if (missingEnvironment !== undefined) return { ...base, ...missingEnvironment };
    const setup = buildCommandSetup(session, planned, { options, root: session.root });
    const command = buildToolCommand(session, planned, options, setup.env);
    const { cwd } = setup;
    const configFiles = options.listConfigFiles?.(session, planned) ?? [];
    const missing = findMissingConfigFile(planned, { session, command, base, configFiles });
    if (missing !== undefined) return missing;
    const availability = buildToolAvailability(
        tool,
        inspectTool({ ...session, cwd: cwd, miseBinPaths: session.readMiseBinPaths() }, tool),
    );
    if ('status' in availability) return { ...base, ...availability };
    const otherToolFailure = findMissingOtherTool(session, planned, command, cwd);
    return otherToolFailure === undefined
        ? await runInFolder({
              session,
              planned,
              tool,
              command,
              toolPath: availability.path,
              setup,
              base,
              options,
              configFiles,
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

function buildToolCommand(
    session: Session,
    planned: PlannedCheck,
    options: CheckRunOptions,
    environment: Record<string, string>,
): string[] {
    const command = [
        ...(stripCoverageArguments(planned, options) as string[]),
        ...listCopyPythonArguments(planned.tool as Tool, environment),
    ];
    if (
        planned.check.id === 'pytest/coverage' &&
        options.command === undefined &&
        hasProjectCoverage(session, planned.scope.path)
    )
        return command.filter((argument) => !argument.startsWith('--cov-config='));
    return command;
}
