// Runs external tools with explicit file lists and configuration, and turns their output into findings.
import { runTool } from '#cli/tools/run.ts';
import { readText } from '#cli/platform/source.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { join, dirname, delimiter } from 'node:path';
import { openRoot } from '#cli/platform/root/open.ts';
import { emptyResult } from '#cli/execution/report.ts';
import { copyFiles } from '#cli/execution/copy/files.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { OutputPaths } from '#cli/types/parsers/output.ts';
import { checkCompanions } from '#cli/planning/requirements.ts';
import { fileBatches } from '#cli/execution/command/batches.ts';
import { FILES_PLACEHOLDER } from '#cli/config/parsers/command.ts';
import type { ExecutionFailure } from '#cli/types/tools/install.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { toolPin, checkToolPin } from '#cli/configurations/pins.ts';
import { inspectTool, toolAvailability } from '#cli/tools/inspect.ts';
import type { ToolPin, CheckSpec } from '#cli/types/configurations.ts';
import { checkedFindings, recordInvocation } from '#cli/execution/output.ts';
import type { SpawnResult, SpawnOptions } from '#cli/types/platform/runtime.ts';
import { toolDeadline, executionFailure } from '#cli/execution/command/failures.ts';
import type { ParsedFindings, CommandRunState } from '#cli/types/execution/output.ts';
import type { CheckResult, EngineInput, CheckRunOptions } from '#cli/types/execution/runtime.ts';

import {
    substitute,
    isolatedFiles,
    perFileCommands,
    substituteValue,
    commandConfigurations,
} from '#cli/execution/command/placeholders.ts';
import type {
    CommandRun,
    EngineTool,
    Substitutions,
    PreparedCommand,
    CommandInvocation,
    CommandEnvironment,
} from '#cli/types/execution/command.ts';

function batchedCommands(
    session: ToolSession,
    planned: PlannedCheck,
    command: string[],
    substitutions: Substitutions,
    toolPath: string | undefined,
): CommandInvocation[] {
    const fixed = substitute(session, planned, command, { ...substitutions, files: [] });
    if (toolPath !== undefined) fixed[0] = toolPath;
    return fileBatches(
        substitutions.files,
        fixed.filter((part) => typeof part === 'string'),
        process.platform,
    ).flatMap((files) => {
        const argv = substitute(session, planned, command, { ...substitutions, files });
        if (toolPath !== undefined) argv[0] = toolPath;
        return perFileCommands(argv, files);
    });
}

function finishResult(
    base: CheckResult,
    spec: CheckSpec,
    state: CommandRunState,
    argv: string[],
    started: number,
): CheckResult {
    const isEveryFindingKept =
        state.isFailed || spec.finding_count_pattern !== undefined || spec.output?.format === 'trufflehog-json';
    // Successful tools can print fileless progress; failed runs and counting checks must retain that output.
    const findings = isEveryFindingKept
        ? state.findings
        : state.findings.filter((finding) => finding.file !== '' || finding.line !== undefined);
    const status = state.isFailed || findings.length > 0 ? 'failed' : 'passed';
    return { ...base, status, duration: performance.now() - started, findings, command: argv };
}

// Parsed findings or the diagnostic that explains why the command output was refused.
function commandOutcome(planned: PlannedCheck, result: SpawnResult, paths: OutputPaths): ParsedFindings {
    try {
        return { findings: checkedFindings(planned, result, paths) };
    } catch (error) {
        if (error instanceof GspotError && error.code === 'output') return { note: error.message };
        throw error;
    }
}

async function runCommands(
    session: ToolSession,
    planned: PlannedCheck,
    tool: ToolPin,
    prepared: PreparedCommand,
    base: CheckResult,
): Promise<CheckResult> {
    const { spec } = planned;
    const { cwd, argv } = prepared;
    const state: CommandRunState = { root: prepared.root, cwd, findings: [], isFailed: false };
    const started = performance.now();
    for (const invocation of prepared.commands) {
        const seconds = toolDeadline(planned.scope.view);
        const result = await runTool(invocation.argv, {
            ...prepared,
            timeoutSeconds: seconds,
            cancelSignal: session.cancelSignal,
        });
        const failure = executionFailure(result, tool.name, planned.scope.view);
        if (failure !== undefined) return { ...base, ...failure, duration: performance.now() - started, command: argv };
        const parsed = commandOutcome(planned, result, { cwd, root: state.root });
        if (parsed.findings === undefined)
            return {
                ...base,
                status: 'error',
                duration: performance.now() - started,
                note: parsed.note,
                command: argv,
            };
        recordInvocation(planned, { invocation, result, findings: parsed.findings }, state);
    }
    return finishResult(base, spec, state, argv, started);
}

function engineTool(
    input: EngineInput,
    name: string,
    options: Pick<PreparedCommand, 'cwd'> & Partial<Pick<PreparedCommand, 'env'>>,
): EngineTool {
    const tool = checkToolPin(toolPin(input.manifests.values(), name), input.spec);
    const env = { ...tool.env, ...input.spec.env, ...options.env };
    const inspection = inspectTool({ ...input, cwd: options.cwd }, { ...tool, env });
    const availability = toolAvailability(tool, inspection);
    if ('status' in availability) {
        if (availability.status === 'error') throw new Error(availability.note);
        throw new GspotError('tool', availability.note);
    }
    return { path: availability.path, env };
}

// A nested tool runs from its selected installation even inside an isolated source copy.
function companionEnvironment(
    input: ToolSession | EngineInput,
    names: string[] | undefined,
    env: Record<string, string>,
): Record<string, string> {
    const directories = (names ?? [])
        .map((name) => inspectTool(input, toolPin(input.manifests.values(), name)).path)
        .filter((path) => path !== undefined)
        .map((path) => dirname(path));
    if (directories.length === 0) return env;
    return { ...env, PATH: [...directories, env['PATH'] ?? environmentVariables()['PATH'] ?? ''].join(delimiter) };
}

// The result of a nested-configuration check whose configuration is not generated yet, or undefined.
function missingConfiguration(
    session: ToolSession,
    planned: PlannedCheck,
    command: string[],
    base: CheckResult,
): CheckResult | undefined {
    if (planned.spec.nested_config_file === undefined) return undefined;
    using files = openRoot(session.root);
    const missing = commandConfigurations(session, planned, command).find((path) =>
        path.startsWith(`${DOT_GSPOT}/`)
            ? files.read(path) === undefined
            : readText(session.root, path, session.reads) === undefined,
    );
    if (missing === undefined) return undefined;
    return {
        ...base,
        status: 'error',
        note: `Required configuration ${missing} is missing. Run gspot apply before checking.`,
    };
}

// Runs in the supplied workspace or an isolated source copy when the check requires one.
// Reports the original repository command.
async function runInWorkspace(run: CommandRun, workspace: string | undefined): Promise<CheckResult> {
    const { session, planned, tool, command, toolPath, environment, base } = run;
    using created =
        workspace === undefined && planned.spec.run_in_copy === true
            ? copyFiles(session.root, isolatedFiles(session, planned, command))
            : undefined;
    const root = workspace ?? created?.root;
    const workspaceSession = root === undefined ? session : { ...session, root };
    const prepared = prepareCommand(
        workspaceSession,
        planned,
        command,
        root === undefined ? environment : commandEnvironment(workspaceSession, planned),
        toolPath,
    );
    prepared.env = companionEnvironment(session, checkCompanions(planned.scope, planned.spec), prepared.env);
    const result = await runCommands(workspaceSession, planned, tool, prepared, base);
    if (root === undefined) return result;
    const reported = substitute(session, planned, command, environment.substitutions);
    reported[0] = toolPath;
    return { ...result, command: reported.filter((part) => typeof part === 'string') };
}

// A declared companion tool must be usable before this command runs.
function unavailableCompanion(session: ToolSession, planned: PlannedCheck): ExecutionFailure | undefined {
    for (const name of checkCompanions(planned.scope, planned.spec)) {
        const required = checkToolPin(toolPin(session.manifests.values(), name), planned.spec);
        const availability = toolAvailability(required, inspectTool(session, required));
        if ('status' in availability) return availability;
    }
    return undefined;
}

/**
 * Resolve the scope's working directory and expand tool environment values.
 * @param session the repository or source workspace session
 * @param planned the selected check and files
 * @returns paths and environment shared by tool inspection and execution
 */
export function commandEnvironment(session: ToolSession, planned: PlannedCheck): CommandEnvironment {
    const { spec, scope } = planned;
    const runsInScope = spec.cwd === 'scope' || (spec.runs === 'scope' && spec.cwd !== 'root');
    const cwd = runsInScope ? join(session.root, scope.scope.path) : session.root;
    const files = planned.files.map((file) =>
        scope.scope.path === '' || cwd === session.root ? file.path : file.path.slice(scope.scope.path.length + 1),
    );
    const substitutions: Substitutions = {
        files: files.map((path) => `${planned.spec.path_prefix ?? ''}${path}`),
        scope: scope.scope.path,
        root: session.root,
        indent: scope.view.format.indent_style === 'space' ? scope.view.format.indent_width : 0,
    };
    if (planned.messageFile !== undefined) substitutions.messageFile = planned.messageFile;
    const env = Object.fromEntries(
        Object.entries({ ...planned.tool?.env, ...planned.spec.env }).map(([name, value]) => [
            name,
            substituteValue(session, planned, value, substitutions),
        ]),
    );
    return { root: session.root, cwd, files, substitutions, env };
}

/**
 * Expand scoped commands into bounded file batches for checks and corrections.
 * @param session the session rooted at the working copy
 * @param planned the planned check
 * @param command the command with placeholders
 * @param environment resolved paths and tool environment
 * @param toolPath the resolved executable
 * @returns the working directory and commands
 */
export function prepareCommand(
    session: ToolSession,
    planned: PlannedCheck,
    command: string[],
    environment: CommandEnvironment,
    toolPath?: string,
): PreparedCommand {
    const { root, cwd, files, substitutions, env } = environment;
    const argv = substitute(session, planned, command, substitutions);
    if (toolPath !== undefined) argv[0] = toolPath;
    const commands = command.includes(FILES_PLACEHOLDER)
        ? batchedCommands(session, planned, command, substitutions, toolPath)
        : perFileCommands(argv, files);
    return { root, cwd, argv: argv.filter((part) => typeof part === 'string'), commands, env };
}

/**
 * Inspect the selected tool and execute a check's expanded commands.
 * @param session the open repository session
 * @param planned the check to run
 * @param options optional command and source workspace supplied by the check
 * @returns the check result with attributed findings
 */
export async function runCommandCheck(
    session: ToolSession,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    const command = options.command ?? planned.spec.command;
    const { tool } = planned;
    const base = emptyResult(planned);
    if (tool === undefined || command === undefined)
        return { ...base, status: 'error', note: 'This check has no command to run.' };
    const environment = commandEnvironment(session, planned);
    const { env, cwd } = environment;
    const inspection = inspectTool({ ...session, cwd }, { ...tool, env });
    const missing = missingConfiguration(session, planned, command, base);
    if (missing !== undefined) return missing;
    const availability = toolAvailability(tool, inspection);
    if ('status' in availability) return { ...base, ...availability };
    const companion = unavailableCompanion(session, planned);
    if (companion !== undefined) return { ...base, ...companion };
    return runInWorkspace(
        { session, planned, tool, command, toolPath: availability.path, environment, base },
        options.workspace,
    );
}

/**
 * Run an engine's tool through the shared execution boundaries.
 * @param input the check and its command session
 * @param command the executable name and arguments
 * @param options the working directory, environment, and standard input
 * @returns captured output after checking process failures
 */
export async function runEngineTool(
    input: EngineInput,
    command: string[],
    options: Pick<PreparedCommand, 'cwd'> & Partial<Pick<PreparedCommand, 'env'>> & Pick<SpawnOptions, 'stdin'>,
): Promise<SpawnResult> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const name = command[0];
    if (name === undefined) throw new Error('An empty command cannot run.');
    const { path, env } = engineTool(input, name, options);
    const seconds = toolDeadline(input.view);
    const result = await runTool([path, ...command.slice(1)], {
        ...options,
        env: companionEnvironment(input, checkCompanions(input.selection, input.spec), env),
        timeoutSeconds: seconds,
        cancelSignal: input.cancelSignal,
    });
    const failure = executionFailure(result, name, input.view);
    if (failure?.status === 'missing') throw new GspotError('tool', failure.note);
    if (failure !== undefined) throw new Error(failure.note);
    // Tools on Windows end their lines with CRLF; every reader of check output splits on LF.
    return {
        ...result,
        stdout: result.stdout.replaceAll('\r\n', '\n'),
        stderr: result.stderr.replaceAll('\r\n', '\n'),
    };
}
