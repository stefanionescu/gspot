import { runTool } from '#cli/tools/contracts.ts';
import { join, dirname, delimiter } from 'node:path';
import { emptyResult } from '#cli/execution/report.ts';
import { checkCompanions } from '#cli/planning/public.ts';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { coverageArguments } from '#cli/planning/contracts.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { copyIntoScratch } from '#cli/execution/copy/public.ts';
import { FILES_PLACEHOLDER } from '#cli/config/configurations.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import type { ExecutionFailure } from '#cli/types/tools/install.ts';
import { inspectTool, toolAvailability } from '#cli/tools/public.ts';
import { toolPin, checkToolPin } from '#cli/configurations/contracts.ts';
import { GspotError, environmentVariables } from '#cli/platform/public.ts';
import { openRoot, readText, assetPath } from '#cli/platform/root/public.ts';
import { batchedCommands } from '#cli/execution/command/arguments/contracts.ts';
import type { CheckInput, CheckResult, CheckRunOptions } from '#cli/types/execution/check.ts';

import {
    finishResult,
    toolDeadline,
    commandOutcome,
    executionFailure,
    recordInvocation,
} from '#cli/execution/command/contracts.ts';
import {
    substitute,
    isolatedFiles,
    perFileCommands,
    substituteValue,
    commandToolFiles,
} from '#cli/execution/command/arguments/public.ts';
import type {
    CheckTool,
    CommandRun,
    Substitutions,
    CommandRunState,
    PreparedCommand,
    CheckToolOptions,
    CheckToolProgram,
    CommandEnvironment,
} from '#cli/types/execution/command.ts';

async function runCommands(
    session: ToolSession,
    planned: PlannedCheck,
    tool: ToolPin,
    prepared: PreparedCommand,
    base: CheckResult,
): Promise<CheckResult> {
    const { check } = planned;
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
    return finishResult(base, check, state, argv, started);
}

function checkTool(
    input: CheckInput,
    name: string | undefined,
    options: Pick<PreparedCommand, 'cwd'> & Partial<Pick<PreparedCommand, 'env'>>,
): CheckTool {
    if (name === undefined) throw new Error('An empty command cannot run.');
    const tool = checkToolPin(toolPin(input.manifests.values(), name), input.check);
    const env = { ...tool.env, ...input.check.env, ...options.env };
    const inspection = inspectTool({ ...input, cwd: options.cwd }, { ...tool, env });
    const availability = toolAvailability(tool, inspection);
    if ('status' in availability) {
        if (availability.status === 'error') throw new Error(availability.note);
        throw new GspotError('tool', availability.note);
    }
    return { name: tool.name, path: availability.path, env };
}

// A nested tool runs from its selected installation even inside an isolated source copy.
function companionEnvironment(
    input: ToolSession | CheckInput,
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

// The result of a nested tool-file check whose tool file is not emitted yet, or undefined.
function missingToolFile(
    session: ToolSession,
    planned: PlannedCheck,
    command: string[],
    base: CheckResult,
): CheckResult | undefined {
    if (planned.check.nested_config_file === undefined) return undefined;
    using files = openRoot(session.root);
    const missing = commandToolFiles(session, planned, command).find((path) =>
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
        workspace === undefined && planned.check.run_in_copy === true
            ? await copyIntoScratch({
                  root: session.root,
                  paths: isolatedFiles(session, planned, command),
                  dependencies: [],
              })
            : undefined;
    const root = workspace ?? created?.path;
    const workspaceSession = root === undefined ? session : { ...session, root };
    const prepared = prepareCommand(
        workspaceSession,
        planned,
        command,
        root === undefined ? environment : commandEnvironment(workspaceSession, planned),
        toolPath,
    );
    prepared.env = companionEnvironment(session, checkCompanions(planned.scope, planned.check, command), prepared.env);
    const result = await runCommands(workspaceSession, planned, tool, prepared, base);
    if (root === undefined) return result;
    const reported = substitute(session, planned, command, environment.substitutions);
    reported[0] = toolPath;
    return { ...result, command: reported.filter((part) => typeof part === 'string') };
}

// A declared companion tool must be usable before this command runs.
function unavailableCompanion(
    session: ToolSession,
    planned: PlannedCheck,
    command: string[],
    cwd: string,
): ExecutionFailure | undefined {
    for (const name of checkCompanions(planned.scope, planned.check, command)) {
        const required = checkToolPin(toolPin(session.manifests.values(), name), planned.check);
        const availability = toolAvailability(required, inspectTool({ ...session, cwd }, required));
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
    const { check, scope } = planned;
    const runsInScope = check.cwd === 'scope' || (check.runs === 'scope' && check.cwd !== 'root');
    const cwd = runsInScope ? join(session.root, scope.scope.path) : session.root;
    const files = planned.files.map((file) =>
        scope.scope.path === '' || cwd === session.root ? file.path : file.path.slice(scope.scope.path.length + 1),
    );
    const substitutions: Substitutions = {
        files: files.map((path) => `${planned.check.path_prefix ?? ''}${path}`),
        scope: scope.scope.path,
        root: session.root,
        indent: scope.view.format.indent_style === 'space' ? scope.view.format.indent_width : 0,
    };
    if (planned.messageFile !== undefined) substitutions.messageFile = planned.messageFile;
    const env = Object.fromEntries(
        Object.entries({ ...planned.tool?.env, ...planned.check.env }).map(([name, value]) => [
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
export async function runCheckCommand(
    session: ToolSession,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    const command = coverageArguments(planned, options);
    const { tool } = planned;
    const base = emptyResult(planned);
    if (tool === undefined || command === undefined)
        return { ...base, status: 'error', note: 'This check has no command to run.' };
    const environment = commandEnvironment(session, planned);
    const { env, cwd } = environment;
    const inspection = inspectTool({ ...session, cwd }, { ...tool, env });
    const missing = missingToolFile(session, planned, command, base);
    if (missing !== undefined) return missing;
    const availability = toolAvailability(tool, inspection);
    if ('status' in availability) return { ...base, ...availability };
    const companion = unavailableCompanion(session, planned, command, cwd);
    if (companion !== undefined) return { ...base, ...companion };
    return runInWorkspace(
        { session, planned, tool, command, toolPath: availability.path, environment, base },
        options.workspace,
    );
}

/**
 * Run a check's tool through the shared execution boundaries.
 * @param input the check and its command session
 * @param command the executable name and arguments
 * @param options the working directory, environment, and standard input
 * @returns captured output after checking process failures
 */
export async function runCheckTool(
    input: CheckInput,
    command: string[] | CheckToolProgram,
    options: CheckToolOptions,
): Promise<SpawnResult> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const { name, path, env } = checkTool(input, Array.isArray(command) ? command[0] : command.tool, options);
    const seconds = toolDeadline(input.view);
    const argv = Array.isArray(command)
        ? [path, ...command.slice(1)]
        : [process.execPath, assetPath(command.entry), path];
    const result = await runTool(argv, {
        ...options,
        env: companionEnvironment(input, checkCompanions(input.selection, input.check), env),
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
