import { join, relative } from 'node:path';
import { createCopy } from '#cli/runs/copy/files.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { listOtherTools } from '#cli/planning/tools.ts';
import { RAN_STATUSES } from '#cli/config/runs/check.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import type { ProcessFailure } from '#cli/types/tools/run.ts';
import { stripCoverageArguments } from '#cli/planning/checks.ts';
import { buildCommandLines } from '#cli/runs/command/batches.ts';
import type { TemporaryFolder } from '#cli/types/system/files.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/files/names.ts';
import { buildBaseResult, mergeCheckResults } from '#cli/runs/report.ts';
import { PYTHON_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { FILES_PLACEHOLDER } from '#cli/config/runs/command/placeholders.ts';
import type { CheckResult, CheckRunOptions } from '#cli/types/runs/check.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';
import { PYTHON_ENVIRONMENT_CHECKS } from '#cli/config/runs/command/check.ts';
import { listCopyPythonArguments, buildCopyPythonEnvironment } from '#cli/tools/uv.ts';
import { addCommandLine, buildCheckResult, parseCommandFindings } from '#cli/runs/command/output.ts';
import { runToolProcess, readToolAvailability, buildOtherToolEnvironment } from '#cli/runs/command/tool.ts';

import type {
    FolderRun,
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
        session,
        verbose,
        tool,
        launch,
        base,
    }: {
        session: Session;
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
        const { result, failure } = await runToolProcess(commandLine.commandArguments, {
            ...launch,
            cancelSignal: session.cancelSignal,
            timeoutSeconds: session.timeoutSeconds,
            name: tool.name,
        });
        if (failure !== undefined)
            return {
                ...base,
                ...failure,
                duration: Math.round(performance.now() - started),
                command: commandArguments,
            };
        const parsed = parseCommandFindings(planned, result, { cwd, root: state.root }, { verbose });
        if (parsed.findings === undefined)
            return {
                ...base,
                status: 'error',
                duration: Math.round(performance.now() - started),
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
        configFiles,
    }: { session: Session; command: string[]; base: CheckResult; configFiles: string[] },
): CheckResult | undefined {
    using files = openFiles(session.root);
    const missing = [...configFiles, ...listCommandConfigFiles(session, planned, command)].find(
        (path) =>
            (path.startsWith(`${GSPOT_FOLDER}/`) ? files.read(path) : findCachedText(session.reads, path)) ===
            undefined,
    );
    if (missing === undefined) return undefined;
    return { ...base, status: 'error', note: `The config file ${missing} is missing. Run gspot apply.` };
}

async function runInFolder(run: FolderRun): Promise<CheckResult> {
    const { session, planned, tool, command, toolPath, setup, base, options, configFiles } = run;
    using copy =
        options.copyRoot === undefined && planned.check.run_in_copy === true
            ? await createCommandCopy(planned, { session, root: session.root, command, configFiles })
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
        const required = getTool(session.configurations.values(), name);
        const availability = readToolAvailability(session, cwd, required);
        if ('status' in availability) return availability;
    }
    return undefined;
}

/**
Copy a check's source, dependencies and config files into a temporary folder.

@param planned the check to run.
@param copy the repository, the folder to copy from, the command, and config files.
@param copy.session the repository and its tools.
@param copy.root the folder to copy from: the repository, or a copy of it.
@param copy.command the executable and authored arguments.
@param copy.configFiles the config files that the check code lists.
@returns the disposable temporary folder.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in 2 files share it.
export async function createCommandCopy(
    planned: PlannedCheck,
    {
        session,
        root,
        command,
        configFiles,
    }: { session: Session; root: string; command: string[]; configFiles: string[] },
): Promise<TemporaryFolder> {
    return createCopy({
        root,
        paths: [...listCopyFiles(session, planned, command), ...configFiles],
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
    return prepareCommand(planned, {
        session,
        command,
        setup: buildCommandSetup(session, planned, { options, root: folder }),
        toolPath,
    });
}

/**
Resolves the working folder and expands the tool environment values.

@param session the repository and its settings.
@param planned the check and its files.
@param setup the overrides from the check code, and the folder where the command runs.
@param setup.options the overrides from the check code.
@param setup.root the repository, or the copy of it that the command runs in.
@returns the paths and environment for the tool.
*/
export function buildCommandSetup(
    session: Session,
    planned: PlannedCheck,
    { options, root }: { options: CheckRunOptions; root: string },
): CommandSetup {
    const { check, scope } = planned;
    const usesScopeFolder = check.cwd === 'scope' || (check.runs === 'scope' && check.cwd !== 'root');
    const cwd = usesScopeFolder ? join(root, scope.folder.path) : root;
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
            ? buildCopyPythonEnvironment({ root, toolsRoot: session.toolsRoot }, scope.folder.path)
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
        scope: planned.scope.folder.path,
        root,
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

function findMissingProjectEnvironment(session: Session, planned: PlannedCheck): ProcessFailure | undefined {
    if (!PYTHON_ENVIRONMENT_CHECKS.has(planned.check.id)) return undefined;
    const scope = planned.scope.folder.path;
    const project = joinScope(scope, PYPROJECT_TOML);
    if (session.repository.files.every((file) => file.path !== project)) return undefined;
    using files = openFiles(session.toolsRoot);
    return files.readStats(joinScope(scope, PYTHON_ENVIRONMENT_FOLDER))?.isDirectory() === true
        ? undefined
        : { status: 'missing', note: 'The project environment .venv is missing. Run uv sync, then check again.' };
}

/**
Finds the tool and runs the expanded commands of a check.

@param session the repository and its tools.
@param planned the check to run.
@param options the command and copy folder overrides.
@returns the check result.
*/
export async function runCommandCheck(
    session: CheckSession,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    const tool = planned.tool as Tool;
    const base = buildBaseResult(planned, session);
    const environment = findMissingProjectEnvironment(session, planned);
    if (environment !== undefined) return { ...base, ...environment };
    const setup = buildCommandSetup(session, planned, { options, root: session.root });
    const command = [
        ...(stripCoverageArguments(planned, options) as string[]),
        ...listCopyPythonArguments(tool, setup.env),
    ];
    const { cwd } = setup;
    const configFiles = options.listConfigFiles?.(session, planned) ?? [];
    const missing = findMissingConfigFile(planned, { session, command, base, configFiles });
    if (missing !== undefined) return missing;
    const availability = readToolAvailability(session, cwd, tool);
    if ('status' in availability) return { ...base, ...availability };
    const companion = findMissingOtherTool(session, planned, command, cwd);
    return companion === undefined
        ? runInFolder({
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
        : { ...base, ...companion };
}

/**
Runs each command group and merges the findings, keeping earlier findings when a later run fails.

@param session the repository and tools.
@param planned the check to run.
@param groups the files and command of each run.
@returns the merged result, or the first failure with the findings so far.
*/
export async function runCommandGroups(
    session: CheckSession,
    planned: PlannedCheck,
    groups: CommandGroup[],
): Promise<CheckResult> {
    let merged = buildBaseResult(planned, session);
    for (const { files, command } of groups) {
        merged = mergeCheckResults(merged, await runCommandCheck(session, { ...planned, files }, { command }));
        if (!RAN_STATUSES.has(merged.status)) break;
    }
    return merged;
}
