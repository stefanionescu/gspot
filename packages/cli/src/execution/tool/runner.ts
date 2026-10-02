// Runs external tools with explicit file lists and configuration, and turns their output into findings.
import { join } from 'node:path';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { runToolCommand } from '#cli/tools/command.ts';
import type { ToolPin, CheckSpec } from '#cli/types/kits.ts';
import { TOOL_DEADLINE } from '#cli/config/policy/policy.ts';
import { fileBatches } from '#cli/execution/tool/batches.ts';
import { toolPin, inspectTool } from '#cli/tools/inspect.ts';
import { FILES_PLACEHOLDER } from '#cli/config/execution/tool.ts';
import { createFileWorkspace } from '#cli/execution/tool/workspace.ts';
import type { Session, ToolInspection } from '#cli/types/tools/tools.ts';
import type { SpawnResult, SpawnOptions } from '#cli/types/platform/platform.ts';
import type { ToolRun, ToolRunState, Substitutions, ToolInvocation } from '#cli/types/execution/tool.ts';
import { collect, missingNote, checkedFindings, executionFailure } from '#cli/execution/tool/findings.ts';

import {
    substitute,
    perFileCommands,
    substituteValue,
    commandConfigurations,
} from '#cli/execution/tool/placeholders.ts';
import type {
    Finding,
    CheckResult,
    EngineInput,
    PlannedCheck,
    PreparedCommand,
} from '#cli/types/execution/execution.ts';

function workingDirectory(session: Session, planned: PlannedCheck): string {
    const { spec, scope } = planned;
    const isInScope = spec.cwd === 'scope' || (spec.runs === 'scope' && spec.cwd !== 'root');
    return isInScope ? join(session.root, scope.scope.path) : session.root;
}

function batchedCommands(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    sub: Substitutions,
    toolPath: string | undefined,
): ToolInvocation[] {
    const fixed = substitute(session, planned, command, { ...sub, files: [] });
    if (toolPath !== undefined) fixed[0] = toolPath;
    return fileBatches(
        sub.files,
        fixed.filter((part) => typeof part === 'string'),
        process.platform,
    ).flatMap((files) => {
        const argv = substitute(session, planned, command, { ...sub, files });
        if (toolPath !== undefined) argv[0] = toolPath;
        return perFileCommands(argv, files);
    });
}

function finished(
    base: CheckResult,
    spec: CheckSpec,
    state: ToolRunState,
    argv: string[],
    started: number,
): CheckResult {
    const isEveryFindingKept =
        state.isFailed || spec.count_pattern !== undefined || spec.output?.format === 'trufflehog-json';
    const findings = isEveryFindingKept
        ? state.findings
        : state.findings.filter((finding) => finding.file !== '' || finding.line !== undefined);
    const status = state.isFailed || findings.length > 0 ? 'fail' : 'ok';
    return { ...base, status, duration: performance.now() - started, findings, command: argv };
}

// The findings a tool's output holds, or the note about output the adapter refused.
function parsedFindings(
    planned: PlannedCheck,
    result: SpawnResult,
    roots: [string, string],
): { findings: Finding[]; note?: undefined } | { findings?: undefined; note: string } {
    try {
        return { findings: checkedFindings(planned, result, roots) };
    } catch (error) {
        if (error instanceof GspotError && error.code === 'tool-output') return { note: error.message };
        throw error;
    }
}

async function runCommands(
    session: Session,
    planned: PlannedCheck,
    tool: ToolPin,
    prepared: PreparedCommand,
    base: CheckResult,
): Promise<CheckResult> {
    const { spec } = planned;
    const { cwd, argv } = prepared;
    const state: ToolRunState = { root: prepared.root, cwd, findings: [], isFailed: false };
    const started = performance.now();
    for (const invocation of prepared.commands) {
        const seconds = Number(planned.scope.view.settings['timeout'] ?? TOOL_DEADLINE.default);
        const result = await runToolCommand(planned.scope.view, invocation.argv, prepared, session.cancelSignal);
        const failure = executionFailure(result, tool.name, seconds);
        if (failure !== undefined) return { ...base, ...failure, duration: performance.now() - started, command: argv };
        const parsed = parsedFindings(planned, result, [cwd, state.root]);
        if (parsed.findings === undefined)
            return {
                ...base,
                status: 'error',
                duration: performance.now() - started,
                note: parsed.note,
                command: argv,
            };
        collect(planned, invocation, result, state, parsed.findings);
    }
    return finished(base, spec, state, argv, started);
}

function adapterTool(
    input: EngineInput,
    name: string,
    options: Pick<PreparedCommand, 'cwd'> & Partial<Pick<PreparedCommand, 'env'>>,
): {
    path: string;
    env: Record<string, string>;
} {
    const tool = toolPin(input.manifests.values(), name);
    const env = { ...tool.env, ...input.spec.env, ...options.env };
    const inspection = inspectTool({ ...input, cwd: options.cwd }, { ...tool, env });
    if (inspection.state === 'error') throw new Error(inspection.note ?? `${name} version inspection failed.`);
    if (inspection.state === 'missing' || inspection.state === 'outdated' || inspection.path === undefined) {
        throw new GspotError('missing-tool', missingNote(tool, inspection, inspection.state));
    }
    return { path: inspection.path, env };
}

// The result of a nested-configuration check whose configuration is not generated yet, or undefined.
function missingConfiguration(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    base: CheckResult,
): CheckResult | undefined {
    if (planned.spec.nested_config === undefined) return undefined;
    using files = openRoot(session.root);
    const missing = commandConfigurations(session, planned, command).find((path) => files.read(path) === undefined);
    if (missing === undefined) return undefined;
    return {
        ...base,
        status: 'error',
        note: `Required configuration ${missing} is missing. Run gspot apply before checking.`,
    };
}

// Runs in the supplied workspace or an isolated source copy when the check requires one.
// Reports the original repository command.
async function runInWorkspace(run: ToolRun, workspace: string | undefined): Promise<CheckResult> {
    const { session, planned, tool, command, inspection, base } = run;
    using created = isolatedWorkspace(session, planned, command, workspace);
    const root = workspace ?? created?.root;
    const execution = root === undefined ? session : { ...session, root };
    const prepared = prepareCommand(execution, planned, command, inspection.path);
    const result = await runCommands(execution, planned, tool, prepared, base);
    if (root === undefined) return result;
    const reported = prepareCommand(session, planned, command, inspection.path);
    return { ...result, command: reported.argv.filter((part) => typeof part === 'string') };
}

// The result of a check that cannot run: its configuration is not generated, or its tool cannot be used.
function unrunnableResult(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    base: CheckResult,
    inspection: ToolInspection,
): CheckResult | undefined {
    const tool = planned.tool;
    if (tool === undefined) return undefined;
    const own = missingConfiguration(session, planned, command, base) ?? unavailableTool(base, tool, inspection);
    if (own !== undefined) return own;
    for (const name of planned.spec.requires_tools ?? []) {
        const required = toolPin(session.manifests.values(), name);
        const unavailable = unavailableTool(base, required, inspectTool(session, required));
        if (unavailable !== undefined) return unavailable;
    }
    return undefined;
}

// The result of a check whose tool cannot run: the inspection failed, or the tool is missing or too old.
function unavailableTool(base: CheckResult, tool: ToolPin, inspection: ToolInspection): CheckResult | undefined {
    if (inspection.state === 'error')
        return { ...base, status: 'error', note: inspection.note ?? 'The version inspection failed.' };
    if (inspection.state === 'missing' || inspection.state === 'outdated')
        return { ...base, status: 'missing', note: missingNote(tool, inspection, inspection.state) };
    return undefined;
}

// A workspace of the selected files and configurations, when the check isolates its files and none was given.
function isolatedWorkspace(session: Session, planned: PlannedCheck, command: string[], workspace: string | undefined) {
    if (workspace !== undefined || planned.spec.isolated_files !== true) return undefined;
    return createFileWorkspace(session.root, [
        ...planned.files.map(({ path }) => path),
        ...commandConfigurations(session, planned, command),
    ]);
}

/**
 * Prepares scoped commands with bounded file batches for checks and corrections.
 * @param session the session rooted at the working copy
 * @param planned the planned check
 * @param command the command with placeholders
 * @param toolPath the resolved executable
 * @returns the working directory and commands
 */
export function prepareCommand(
    session: Session,
    planned: PlannedCheck,
    command: string[],
    toolPath?: string,
): PreparedCommand {
    const { scope } = planned;
    const cwd = workingDirectory(session, planned);
    const files = planned.files.map((file) =>
        scope.scope.path === '' || cwd === session.root ? file.path : file.path.slice(scope.scope.path.length + 1),
    );
    const sub: Substitutions = {
        files: files.map((path) => `${planned.spec.file_prefix ?? ''}${path}`),
        scope: scope.scope.path,
        root: session.root,
        indent: scope.view.format.indent_width,
    };
    if (planned.messageFile !== undefined) sub.messageFile = planned.messageFile;
    const argv = substitute(session, planned, command, sub);
    if (toolPath !== undefined) argv[0] = toolPath;
    const commands = command.includes(FILES_PLACEHOLDER)
        ? batchedCommands(session, planned, command, sub, toolPath)
        : perFileCommands(argv, files);
    const env = Object.fromEntries(
        Object.entries({ ...planned.tool?.env, ...planned.spec.env }).map(([name, value]) => [
            name,
            substituteValue(session, planned, value, sub),
        ]),
    );
    return { root: session.root, cwd, argv: argv.filter((part) => typeof part === 'string'), commands, env };
}
/**
 * Runs one planned tool check: inspects the tool, expands the command, spawns it once or per file, parses the output.
 * @param session the session.
 * @param planned the check to run.
 * @param command the command prepared by an adapter, or the command of the definition.
 * @param workspace a copy of the repository the command runs in; the tool is found in the repository.
 * @returns the check result with its findings.
 */
export async function runToolCheck(
    session: Session,
    planned: PlannedCheck,
    command = planned.spec.command,
    workspace?: string,
): Promise<CheckResult> {
    const { spec, tool, scope } = planned;
    const base: CheckResult = {
        check: spec.name,
        scope: scope.scope.path,
        status: 'ok',
        files: planned.files.length,
        duration: 0,
        findings: [],
    };
    if (tool === undefined || command === undefined)
        return { ...base, status: 'error', note: 'this check has no command to run' };
    const { env, cwd } = prepareCommand(session, planned, command);
    const inspection = inspectTool({ ...session, cwd }, { ...tool, env });
    const unrunnable = unrunnableResult(session, planned, command, base, inspection);
    if (unrunnable !== undefined) return unrunnable;
    return runInWorkspace({ session, planned, tool, command, inspection, base }, workspace);
}

/**
 * Run an adapter command through the shared execution boundaries.
 * @param input the check and its command session
 * @param command the executable name and arguments
 * @param options the working directory, environment, and standard input
 * @returns captured output after checking process failures
 */
export async function runCheckCommand(
    input: EngineInput,
    command: string[],
    options: Pick<PreparedCommand, 'cwd'> & Partial<Pick<PreparedCommand, 'env'>> & Pick<SpawnOptions, 'stdin'>,
): Promise<SpawnResult> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const name = command[0];
    if (name === undefined) throw new Error('An empty command cannot run.');
    const { path, env } = adapterTool(input, name, options);
    const result = await runToolCommand(
        input.view,
        [path, ...command.slice(1)],
        { ...options, env },
        input.cancelSignal,
    );
    const failure = executionFailure(result, name, Number(input.view.settings['timeout'] ?? TOOL_DEADLINE.default));
    if (failure?.status === 'missing') throw new GspotError('missing-tool', failure.note);
    if (failure !== undefined) throw new Error(failure.note);
    // Tools on Windows end their lines with CRLF; every reader of check output splits on LF.
    return {
        ...result,
        stdout: result.stdout.replaceAll('\r\n', '\n'),
        stderr: result.stderr.replaceAll('\r\n', '\n'),
    };
}
