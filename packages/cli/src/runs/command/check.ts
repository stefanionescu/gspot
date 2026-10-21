import { join, relative } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import { RAN_STATUSES } from '#cli/config/runs/run.ts';
import { copyIntoScratch } from '#cli/runs/copy/files.ts';
import { getToolTimeoutSeconds } from '#cli/tools/run.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { buildInvocations } from '#cli/runs/command/batches.ts';
import type { ScratchFolder } from '#cli/types/system/files.ts';
import type { ExecutionFailure } from '#cli/types/tools/run.ts';
import { stripCoverageArguments } from '#cli/planning/checks.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { listCompanionTools } from '#cli/planning/needed-tools.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { buildBaseResult, mergeCheckResults } from '#cli/runs/report.ts';
import type { CheckResult, CheckRunOptions } from '#cli/types/runs/check.ts';
import { buildScratchPythonEnvironment } from '#cli/install/python/project.ts';
import { INTERPRETER_FLAGS, PYTHON_EXECUTABLE } from '#cli/config/runs/command.ts';
import { convertToPosixPath, buildVenvExecutablePath } from '#cli/system/paths.ts';
import { FILES_PLACEHOLDER, PYTHON_CONFIGURATION } from '#cli/config/configurations.ts';
import { findTool, runToolProcess, buildCompanionEnvironment } from '#cli/runs/command/tool.ts';
import { buildCheckResult, recordInvocation, parseCommandFindings } from '#cli/runs/command/output.ts';

import type {
    CommandRun,
    CommandGroup,
    Substitutions,
    CommandRunState,
    PreparedCommand,
    CommandEnvironment,
} from '#cli/types/runs/command.ts';
import {
    expandCommand,
    listScratchFiles,
    replacePlaceholders,
    buildFileInvocations,
    listCommandToolFiles,
} from '#cli/runs/command/placeholders.ts';

async function runCommands(
    planned: PlannedCheck,
    {
        cancelSignal,
        tool,
        prepared,
        base,
    }: { cancelSignal: AbortSignal | undefined; tool: ToolDeclaration; prepared: PreparedCommand; base: CheckResult },
): Promise<CheckResult> {
    const { check } = planned;
    const { cwd, commandArguments } = prepared;
    const state: CommandRunState = { root: prepared.root, cwd, findings: [], isFailed: false };
    const started = performance.now();
    for (const invocation of prepared.commands) {
        const { result, failure } = await runToolProcess(invocation.commandArguments, {
            ...prepared,
            cancelSignal,
            timeoutSeconds: getToolTimeoutSeconds(planned.selection.view),
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
        recordInvocation(planned, tool, { invocation, result, findings: parsed.findings }, state);
    }
    return buildCheckResult(check, { base, state, commandArguments, started });
}

function findMissingToolFile(
    planned: PlannedCheck,
    {
        session,
        command,
        base,
        options,
    }: { session: Session; command: string[]; base: CheckResult; options: CheckRunOptions },
): CheckResult | undefined {
    const paths = options.toolFiles?.(session, planned) ?? [];
    using files = openFiles(session.root);
    const missing = [...paths, ...listCommandToolFiles(session, planned, command)].find((path) =>
        isInGspotFolder(path) ? files.read(path) === undefined : findCachedText(session.reads, path) === undefined,
    );
    if (missing === undefined) return undefined;
    return {
        ...base,
        status: 'error',
        note: `The tool file ${missing} is missing. Run gspot apply.`,
    };
}

// Reports the repository command, not the scratch copy command.
async function runInScratch(run: CommandRun): Promise<CheckResult> {
    const { session, planned, tool, command, toolPath, environment, base, options } = run;
    using copy =
        options.scratchRoot === undefined && planned.check.run_in_copy === true
            ? await copyCheckFiles(planned, { session, command, options })
            : undefined;
    const folder = options.scratchRoot ?? copy?.path;
    const prepared =
        folder === undefined
            ? prepareCommand(planned, { session, command, environment, toolPath })
            : prepareCommandIn(folder, planned, { session, command, toolPath, options });
    prepared.env = buildCompanionEnvironment(
        session,
        listCompanionTools(planned.selection, planned.check, command),
        prepared.env,
    );
    const result = await runCommands(planned, { cancelSignal: session.cancelSignal, tool, prepared, base });
    if (folder === undefined) return result;
    const reported = expandCommand(session, planned, command, environment.substitutions).with(0, toolPath);
    return { ...result, command: reported.filter((part) => typeof part === 'string') };
}

function findUnavailableCompanion(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    cwd: string,
): ExecutionFailure | undefined {
    for (const name of listCompanionTools(planned.selection, planned.check, command)) {
        const required = getToolDeclaration(session.manifests.values(), name);
        const availability = findTool(session, cwd, required);
        if ('status' in availability) return availability;
    }
    return undefined;
}

// A type checker that reads its environment from its settings file gets the interpreter of a scratch copy's project.
function listInterpreterArguments(tool: ToolDeclaration, env: Record<string, string>): string[] {
    const flag = Object.hasOwn(INTERPRETER_FLAGS, tool.name) ? INTERPRETER_FLAGS[tool.name] : undefined;
    const environment = env['UV_PROJECT_ENVIRONMENT'];
    return flag === undefined || environment === undefined
        ? []
        : [flag, buildVenvExecutablePath(environment, PYTHON_EXECUTABLE)];
}

/**
 * Copy a check's source, dependencies and tool files into a scratch folder.
 *
 * @param planned the check to run.
 * @param copy the repository, command, and implementation overrides.
 * @param copy.session the repository and its tools.
 * @param copy.command the executable and authored arguments.
 * @param copy.options the implementation overrides.
 * @returns the disposable scratch folder.
 */
export async function copyCheckFiles(
    planned: PlannedCheck,
    { session, command, options }: { session: Session; command: string[]; options: CheckRunOptions },
): Promise<ScratchFolder> {
    return copyIntoScratch({
        root: session.root,
        paths: [...listScratchFiles(session, planned, command), ...(options.toolFiles?.(session, planned) ?? [])],
        dependencies: [],
        cancelSignal: session.cancelSignal,
    });
}

/**
 * Prepare a check command in another working folder.
 *
 * @param folder the working copy of the repository.
 * @param planned the check to run.
 * @param expansion the repository, command, tool, and implementation overrides.
 * @param expansion.session the repository and its tools.
 * @param expansion.command the executable and authored arguments.
 * @param expansion.toolPath the resolved executable path.
 * @param expansion.options the implementation overrides.
 * @returns the command expanded for that folder.
 */
export function prepareCommandIn(
    folder: string,
    planned: PlannedCheck,
    {
        session,
        command,
        toolPath,
        options,
    }: { session: Session; command: string[]; toolPath: string; options: CheckRunOptions },
): PreparedCommand {
    const selected = { ...session, root: folder };
    return prepareCommand(planned, {
        session: selected,
        command,
        environment: buildCommandEnvironment(selected, planned, options),
        toolPath,
    });
}

/**
 * Select the command's tool declaration and build its environment.
 *
 * @param session the repository and its tools.
 * @param planned the check and its selected scope.
 * @param name the executable that the command runs.
 * @param options the implementation overrides.
 * @returns the tool declaration and its expanded environment.
 */
export function prepareToolEnvironment(
    session: Session,
    planned: PlannedCheck,
    name: string,
    options: CheckRunOptions,
): { tool: ToolDeclaration; environment: CommandEnvironment } {
    const tool = planned.tool?.name === name ? planned.tool : getToolDeclaration(session.manifests.values(), name);
    const environment = buildCommandEnvironment(session, { ...planned, tool }, options);
    return { tool, environment };
}

/**
 * Resolves the working folder and expands the tool environment values.
 *
 * @param session the repository or its scratch copy.
 * @param planned the check and its files.
 * @param options the overrides from the check implementation.
 * @returns the paths and environment for the tool.
 */
export function buildCommandEnvironment(
    session: Session,
    planned: PlannedCheck,
    options: CheckRunOptions,
): CommandEnvironment {
    const { check, selection } = planned;
    const runsInScope = check.cwd === 'scope' || (check.runs === 'scope' && check.cwd !== 'root');
    const cwd = runsInScope ? join(session.root, selection.scope.path) : session.root;
    const substitutions = buildCommandSubstitutions(session, planned, cwd);
    const files = substitutions.files;
    if (options.arguments !== undefined) substitutions.files = options.arguments(session, planned);
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
        planned.manifest?.configuration.name === PYTHON_CONFIGURATION
            ? buildScratchPythonEnvironment(session, selection.scope.path)
            : {};
    return { root: session.root, cwd, files, substitutions, env: { ...env, ...python } };
}

/**
 * Computes the placeholder values from the scope and working folder.
 *
 * @param source the repository and settings.
 * @param planned the check and its files.
 * @param cwd the folder that the tool runs in.
 * @returns the placeholder values, with paths relative to cwd.
 */
export function buildCommandSubstitutions(source: Session, planned: PlannedCheck, cwd: string): Substitutions {
    const substitutions: Substitutions = {
        files: planned.files.map((file) => convertToPosixPath(relative(cwd, join(source.root, file.path)))),
        scope: planned.selection.scope.path,
        root: source.root,
        indent:
            planned.selection.view.values.format.indent_style === 'space'
                ? planned.selection.view.values.format.indent_width
                : 0,
    };
    if (planned.messageFile !== undefined) substitutions.messageFile = planned.messageFile;
    return substitutions;
}

/**
 * Expands a check or fix command into file batches that fit the command line.
 *
 * @param planned the check to run.
 * @param commandRun what to run.
 * @param commandRun.session the repository and its tools.
 * @param commandRun.command the executable and authored arguments.
 * @param commandRun.environment the working paths and tool variables.
 * @param commandRun.toolPath the resolved executable path.
 * @returns the working folder and command batches.
 */
export function prepareCommand(
    planned: PlannedCheck,
    commandRun: { session: Session; command: string[]; environment: CommandEnvironment; toolPath: string },
): PreparedCommand {
    const { session, command, environment, toolPath } = commandRun;
    const { root, cwd, files, substitutions, env } = environment;
    const commandArguments = expandCommand(session, planned, command, substitutions).with(0, toolPath);
    const commands = command.includes(FILES_PLACEHOLDER)
        ? buildInvocations(planned, { session, command, substitutions, toolPath })
        : buildFileInvocations(commandArguments, files);
    return { root, cwd, commandArguments: commandArguments.filter((part) => typeof part === 'string'), commands, env };
}

/**
 * Finds the tool and runs the expanded commands of a check.
 *
 * @param session the repository and its tools.
 * @param planned the check to run.
 * @param options the command and scratch folder overrides.
 * @returns the check result.
 */
export async function runCheckCommand(
    session: Session,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    const tool = planned.tool as ToolDeclaration;
    const base = buildBaseResult(planned, session);
    const { environment } = prepareToolEnvironment(session, planned, tool.name, options);
    const command = [
        ...(stripCoverageArguments(planned, options) as string[]),
        ...listInterpreterArguments(tool, environment.env),
    ];
    const { cwd } = environment;
    const missing = findMissingToolFile(planned, { session, command, base, options });
    if (missing !== undefined) return missing;
    const availability = findTool(session, cwd, tool);
    if ('status' in availability) return { ...base, ...availability };
    const companion = findUnavailableCompanion(session, planned, command, cwd);
    if (companion !== undefined) return { ...base, ...companion };
    return runInScratch({ session, planned, tool, command, toolPath: availability.path, environment, base, options });
}

/**
 * Runs each command group and merges the findings, keeping earlier findings when a later run fails.
 *
 * @param session the repository and tools.
 * @param planned the check to run.
 * @param groups the files and command of each run.
 * @returns the merged result, or the first failure with the findings so far.
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
