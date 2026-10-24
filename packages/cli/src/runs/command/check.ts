import { join, relative } from 'node:path';
import { createCopy } from '#cli/runs/copy/files.ts';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { listOtherTools } from '#cli/planning/tools.ts';
import { RAN_STATUSES } from '#cli/config/runs/check.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import type { ProcessFailure } from '#cli/types/tools/run.ts';
import { stripCoverageArguments } from '#cli/planning/checks.ts';
import { buildCommandLines } from '#cli/runs/command/batches.ts';
import type { TemporaryFolder } from '#cli/types/system/files.ts';
import { buildBaseResult, mergeCheckResults } from '#cli/runs/report.ts';
import { PYTHON_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { FILES_PLACEHOLDER } from '#cli/config/runs/command/placeholders.ts';
import type { CheckResult, CheckRunOptions } from '#cli/types/runs/check.ts';
import { listCopyPythonArguments, buildCopyPythonEnvironment } from '#cli/tools/python.ts';
import { findTool, runToolProcess, buildOtherToolEnvironment } from '#cli/runs/command/tool.ts';
import { addCommandLine, buildCheckResult, parseCommandFindings } from '#cli/runs/command/output.ts';

import type {
    CopyRun,
    CommandRun,
    CommandGroup,
    CommandSetup,
    Substitutions,
    CommandLaunch,
} from '#cli/types/runs/command.ts';
import {
    expandCommand,
    listCopyFiles,
    replacePlaceholders,
    buildFileCommandLines,
    listCommandConfigFiles,
} from '#cli/runs/command/placeholders.ts';

async function runCommands(
    planned: PlannedCheck,
    {
        cancelSignal,
        tool,
        launch,
        base,
    }: { cancelSignal: AbortSignal | undefined; tool: Tool; launch: CommandLaunch; base: CheckResult },
): Promise<CheckResult> {
    const { check } = planned;
    const { cwd, commandArguments } = launch;
    const state: CommandRun = { root: launch.root, cwd, findings: [], failed: false };
    const started = performance.now();
    for (const commandLine of launch.commandLines) {
        const { result, failure } = await runToolProcess(commandLine.commandArguments, {
            ...launch,
            cancelSignal,
            timeoutSeconds: Number(planned.scope.settings.settings['tool_timeout_seconds']),
            name: tool.name,
        });
        if (failure !== undefined)
            return { ...base, ...failure, duration: performance.now() - started, command: commandArguments };
        const parsed = parseCommandFindings(planned, result, { cwd, root: state.root });
        if (parsed.findings === undefined)
            return {
                ...base,
                status: 'error',
                duration: performance.now() - started,
                note: parsed.note,
                command: commandArguments,
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
        options,
    }: { session: Session; command: string[]; base: CheckResult; options: CheckRunOptions },
): CheckResult | undefined {
    const paths = options.listConfigFiles?.(session, planned) ?? [];
    using files = openFiles(session.root);
    const missing = [...paths, ...listCommandConfigFiles(session, planned, command)].find((path) =>
        path.startsWith(`${DOT_GSPOT}/`)
            ? files.read(path) === undefined
            : findCachedText(session.reads, path) === undefined,
    );
    if (missing === undefined) return undefined;
    return {
        ...base,
        status: 'error',
        note: `The config file ${missing} is missing. Run gspot apply.`,
    };
}

async function runInCopy(run: CopyRun): Promise<CheckResult> {
    const { session, planned, tool, command, toolPath, setup, base, options } = run;
    using copy =
        options.copyRoot === undefined && planned.check.run_in_copy === true
            ? await copyCheckFiles(planned, { session, command, options })
            : undefined;
    const folder = options.copyRoot ?? copy?.path;
    const commandSetup =
        folder === undefined
            ? prepareCommand(planned, { session, command, setup, toolPath })
            : prepareCommandIn(folder, planned, { session, command, toolPath, options });
    commandSetup.env = buildOtherToolEnvironment(
        session,
        listOtherTools(planned.scope, planned.check, command),
        commandSetup.env,
    );
    const result = await runCommands(planned, { cancelSignal: session.cancelSignal, tool, launch: commandSetup, base });
    if (folder === undefined) return result;
    const reported = expandCommand(session, planned, command, setup.substitutions).with(0, toolPath);
    return { ...result, command: reported.filter((argument) => typeof argument === 'string') };
}

function findMissingOtherTool(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    cwd: string,
): ProcessFailure | undefined {
    for (const name of listOtherTools(planned.scope, planned.check, command)) {
        const required = getTool(session.configurations.values(), name);
        const availability = findTool(session, cwd, required);
        if ('status' in availability) return availability;
    }
    return undefined;
}

/**
Copy a check's source, dependencies and config files into a temporary folder.

@param planned the check to run.
@param copy the repository, command, and implementation overrides.
@param copy.session the repository and its tools.
@param copy.command the executable and authored arguments.
@param copy.options the implementation overrides.
@returns the disposable temporary folder.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export async function copyCheckFiles(
    planned: PlannedCheck,
    { session, command, options }: { session: Session; command: string[]; options: CheckRunOptions },
): Promise<TemporaryFolder> {
    return createCopy({
        root: session.root,
        paths: [...listCopyFiles(session, planned, command), ...(options.listConfigFiles?.(session, planned) ?? [])],
        dependencies: [],
        cancelSignal: session.cancelSignal,
    });
}

/**
Prepare a check command in another working folder.

@param folder the working copy of the repository.
@param planned the check to run.
@param expansion the repository, command, tool, and implementation overrides.
@param expansion.session the repository and its tools.
@param expansion.command the executable and authored arguments.
@param expansion.toolPath the resolved executable path.
@param expansion.options the implementation overrides.
@returns the command expanded for that folder.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in 2 files share it.
export function prepareCommandIn(
    folder: string,
    planned: PlannedCheck,
    {
        session,
        command,
        toolPath,
        options,
    }: { session: Session; command: string[]; toolPath: string; options: CheckRunOptions },
): CommandLaunch {
    const selected = { ...session, root: folder };
    return prepareCommand(planned, {
        session: selected,
        command,
        setup: buildCommandSetup(selected, planned, options),
        toolPath,
    });
}

/**
Select the command's tool declaration and build its environment.

@param session the repository and its tools.
@param planned the check and its selected scope.
@param name the executable that the command runs.
@param options the implementation overrides.
@returns the tool declaration and its expanded environment.
*/
export function prepareToolEnvironment(
    session: Session,
    planned: PlannedCheck,
    name: string,
    options: CheckRunOptions,
): { tool: Tool; setup: CommandSetup } {
    const tool = planned.tool?.name === name ? planned.tool : getTool(session.configurations.values(), name);
    const setup = buildCommandSetup(session, { ...planned, tool }, options);
    return { tool, setup };
}

/**
Resolves the working folder and expands the tool environment values.

@param session the repository or its copy.
@param planned the check and its files.
@param options the overrides from the check code.
@returns the paths and environment for the tool.
*/
export function buildCommandSetup(session: Session, planned: PlannedCheck, options: CheckRunOptions): CommandSetup {
    const { check, scope } = planned;
    const runsInScope = check.cwd === 'scope' || (check.runs === 'scope' && check.cwd !== 'root');
    const cwd = runsInScope ? join(session.root, scope.folder.path) : session.root;
    const substitutions = buildCommandSubstitutions(session, planned, cwd);
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
            ? buildCopyPythonEnvironment(session, scope.folder.path)
            : {};
    return { root: session.root, cwd, files, substitutions, env: { ...env, ...python } };
}

/**
Builds the placeholder values from the scope and working folder.

@param source the repository and settings.
@param planned the check and its files.
@param cwd the folder that the tool runs in.
@returns the placeholder values, with paths relative to cwd.
*/
export function buildCommandSubstitutions(source: Session, planned: PlannedCheck, cwd: string): Substitutions {
    const substitutions: Substitutions = {
        files: planned.files
            .map((file) => convertToPosixPath(relative(cwd, join(source.root, file.path))))
            .map((path) => (path.startsWith('-') ? `./${path}` : path)),
        scope: planned.scope.folder.path,
        root: source.root,
        indent:
            planned.scope.settings.values.format.indent_style === 'space'
                ? planned.scope.settings.values.format.indent_width
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
@returns the working folder and command batches.
*/
export function prepareCommand(
    planned: PlannedCheck,
    expansion: { session: Session; command: string[]; setup: CommandSetup; toolPath: string },
): CommandLaunch {
    const { session, command, setup, toolPath } = expansion;
    const { root, cwd, files, substitutions, env } = setup;
    const commandArguments = expandCommand(session, planned, command, substitutions).with(0, toolPath);
    const commandLines = command.includes(FILES_PLACEHOLDER)
        ? buildCommandLines(planned, { session, command, substitutions, toolPath })
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
@returns the check result.
*/
export async function runCheckCommand(
    session: Session,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    const tool = planned.tool as Tool;
    const base = buildBaseResult(planned, session);
    const { setup } = prepareToolEnvironment(session, planned, tool.name, options);
    const command = [
        ...(stripCoverageArguments(planned, options) as string[]),
        ...listCopyPythonArguments(tool, setup.env),
    ];
    const { cwd } = setup;
    const missing = findMissingConfigFile(planned, { session, command, base, options });
    if (missing !== undefined) return missing;
    const availability = findTool(session, cwd, tool);
    if ('status' in availability) return { ...base, ...availability };
    const companion = findMissingOtherTool(session, planned, command, cwd);
    if (companion !== undefined) return { ...base, ...companion };
    return runInCopy({ session, planned, tool, command, toolPath: availability.path, setup, base, options });
}

/**
Runs each command group and merges the findings, keeping earlier findings when a later run fails.

@param session the repository and tools.
@param planned the check to run.
@param groups the files and command of each run.
@returns the merged result, or the first failure with the findings so far.
*/
export async function runCommandGroups(
    session: Session,
    planned: PlannedCheck,
    groups: CommandGroup[],
): Promise<CheckResult> {
    let merged = buildBaseResult(planned, session);
    for (const { files, command } of groups) {
        merged = mergeCheckResults(merged, await runCheckCommand(session, { ...planned, files }, { command }));
        if (!RAN_STATUSES.has(merged.status)) break;
    }
    return merged;
}
