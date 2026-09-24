import { isAbsolute, join } from 'node:path';
import type { Session } from '#cli/run/session.ts';
import type { PlannedCheck } from '#cli/run/plan.ts';
import type { EngineInput } from '#cli/run/engines.ts';
import { fileBatches } from '#cli/run/file-batches.ts';
import { ToolOutputError } from '#cli/run/parse-output.ts';
import { MissingToolError } from '#cli/tools/missing-tool.ts';
import { probeTool, toolPin } from '#cli/tools/tool-probe.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { createFileWorkspace } from '#cli/run/file-workspace.ts';
// Runs external tools with explicit file lists and configuration, and turns their output into findings.
import type { CheckResult, Finding } from '#cli/output/schema.ts';
import type { ToolPin } from '#cli/configurations/read-manifests.ts';
import type { SpawnOptions, SpawnResult } from '#cli/platform/spawn.ts';
import { runToolCommand, toolDeadlineSeconds } from '#cli/tools/command.ts';
import type { Substitutions, ToolInvocation } from '#cli/run/command-expansion.ts';
import { checkedFindings, executionFailure, toolOutputDetail } from '#cli/run/broken-tool.ts';
import { commandConfigurations, perFileCommands, substitute, substituteValue } from '#cli/run/command-expansion.ts';

/** What one tool run accumulates across its spawns. */
type ToolRunState = { root: string; cwd: string; findings: Finding[]; isFailed: boolean };

const FILES_PLACEHOLDER = '{files}';
function firstLine(result: SpawnResult, placeholder: string): string {
    const text = result.stderr.trim() === '' ? result.stdout.trim() : result.stderr.trim();
    return (
        text
            .split('\n')
            .find((line) => !(line.trim() === '' || line.startsWith('Oops!') || line.startsWith('ESLint: '))) ??
        placeholder
    );
}

function missingNote(
    tool: ToolPin,
    probe: {
        found?: string;
        floor?: string;
        hint?: string;
    },
    state: string,
): string {
    const hint = probe.hint ?? 'Install the configured tool.';
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    return state === 'outdated'
        ? `${tool.name} ${probe.found ?? '?'} is below ${probe.floor ?? '?'}. ${hint}`
        : `${tool.name}${version} is not installed. ${hint}`;
}

function workingDirectory(session: Session, planned: PlannedCheck): string {
    const { spec, scope } = planned;
    const isInScope = spec.cwd === 'scope' || (spec.runs === 'per-scope' && spec.cwd !== 'root');
    return isInScope ? join(session.root, scope.scope.path) : session.root;
}

function relativizer(session: Session, planned: PlannedCheck, cwd: string): (path: string) => string {
    const scopePath = planned.scope.scope.path;
    if (scopePath === '' || cwd === session.root) return (path) => path;
    return (path) => path.slice(scopePath.length + 1);
}

function prefixScope(findings: Finding[], scopePath: string): void {
    for (const finding of findings)
        if (finding.file !== '' && !isAbsolute(finding.file) && !finding.file.startsWith(`${scopePath}/`))
            finding.file = `${scopePath}/${finding.file}`;
}

function countMatches(spec: CheckSpec, result: SpawnResult): number {
    if (spec.count_regex === undefined) return 0;
    const pattern = new RegExp(spec.count_regex, 'gu');
    return `${result.stdout}\n${result.stderr}`.matchAll(pattern).toArray().length;
}

function unexplainedFailure(spec: CheckSpec, tool: ToolPin, result: SpawnResult, file: string | undefined): Finding {
    const placeholder = `${tool.name} exited ${String(result.code)}`;
    const text = file === undefined ? toolOutputDetail(result, placeholder) : firstLine(result, placeholder);
    const { name, help } = spec;
    return { check: name, file: file?.replaceAll('\\', '/') ?? '', message: text, help, fixable: false };
}

function markFailure(
    spec: CheckSpec,
    tool: ToolPin,
    result: SpawnResult,
    parsed: Finding[],
    state: ToolRunState,
): void {
    if (spec.count_regex !== undefined) {
        if (countMatches(spec, result) > 0) state.isFailed = true;
        return;
    }
    if (result.code === 0) return;
    state.isFailed = true;
    if (parsed.length === 0) state.findings.push(unexplainedFailure(spec, tool, result, undefined));
}

function collect(
    planned: PlannedCheck,
    invocation: ToolInvocation,
    result: SpawnResult,
    state: ToolRunState,
    parsed: Finding[],
): void {
    const { spec, scope } = planned;
    const tool = planned.tool;
    if (tool === undefined) throw new Error('Cannot collect tool output without a selected tool.');
    if (parsed.length === 0 && result.code !== 0 && invocation.file !== undefined)
        parsed.push(unexplainedFailure(spec, tool, result, invocation.file));
    if (invocation.file !== undefined && spec.output?.format === 'regex' && (spec.output.file_is ?? 'path') === 'path')
        for (const finding of parsed) if (finding.file === '') finding.file = invocation.file;
    if (scope.scope.path !== '' && state.cwd !== state.root) prefixScope(parsed, scope.scope.path);
    state.findings.push(...parsed);
    markFailure(spec, tool, result, parsed, state);
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
        state.isFailed || spec.count_regex !== undefined || spec.output?.format === 'trufflehog-json';
    const findings = isEveryFindingKept
        ? state.findings
        : state.findings.filter((finding) => finding.file !== '' || finding.line !== undefined);
    const status = state.isFailed || findings.length > 0 ? 'fail' : 'ok';
    return { ...base, status, duration: performance.now() - started, findings, command: argv };
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
        const seconds = toolDeadlineSeconds(planned.scope.view);
        const result = await runToolCommand(planned.scope.view, invocation.argv, prepared, session.cancelSignal);
        const failure = executionFailure(result, tool.name, seconds);
        if (failure !== undefined) return { ...base, ...failure, duration: performance.now() - started, command: argv };
        let parsed: Finding[];
        try {
            parsed = checkedFindings(planned, result, [cwd, state.root]);
        } catch (error) {
            if (!(error instanceof ToolOutputError)) throw error;
            return {
                ...base,
                status: 'error',
                duration: performance.now() - started,
                note: error.message,
                command: argv,
            };
        }
        collect(planned, invocation, result, state, parsed);
    }
    return finished(base, spec, state, argv, started);
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
    const relative = relativizer(session, planned, cwd);
    const files = planned.files.map((file) => relative(file.path));
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
 * Runs one planned tool check: probes the tool, expands the command, spawns it once or per file, parses the output.
 * @param session the session
 * @param planned the check to run
 * @param command the command prepared by an adapter, or the command of the definition
 * @returns the check result with its findings
 */
export async function runToolCheck(
    session: Session,
    planned: PlannedCheck,
    command = planned.spec.command,
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
    if (spec.nested_config !== undefined) {
        const files = openConfinedRoot(session.root);
        try {
            for (const path of commandConfigurations(session, planned, command))
                if (files.read(path) === undefined)
                    return {
                        ...base,
                        status: 'error',
                        note: `Required configuration ${path} is missing. Run gspot apply before checking.`,
                    };
        } finally {
            files.close();
        }
    }
    const { env, cwd } = prepareCommand(session, planned, command);
    const probe = probeTool({ ...session, cwd }, { ...tool, env });
    if (probe.state === 'error') return { ...base, status: 'error', note: probe.note ?? 'The version probe failed.' };
    if (probe.state === 'missing' || probe.state === 'outdated')
        return { ...base, status: 'missing', note: missingNote(tool, probe, probe.state) };
    using workspace =
        spec.isolated_files === true
            ? createFileWorkspace(session.root, [
                  ...planned.files.map(({ path }) => path),
                  ...commandConfigurations(session, planned, command),
              ])
            : undefined;
    const execution = workspace === undefined ? session : { ...session, root: workspace.root };
    const prepared = prepareCommand(execution, planned, command, probe.path);
    const result = await runCommands(execution, planned, tool, prepared, base);
    if (workspace !== undefined)
        result.command = prepareCommand(session, planned, command, probe.path).argv.filter(
            (part) => typeof part === 'string',
        );
    return result;
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
    const failure = executionFailure(result, name, toolDeadlineSeconds(input.view));
    if (failure?.status === 'missing') throw new MissingToolError(failure.note);
    if (failure !== undefined) throw new Error(failure.note);
    return result;
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
    const probe = probeTool({ ...input, cwd: options.cwd }, { ...tool, env });
    if (probe.state === 'error') throw new Error(probe.note ?? `${name} version probe failed.`);
    if (probe.state === 'missing' || probe.state === 'outdated' || probe.path === undefined) {
        throw new MissingToolError(missingNote(tool, probe, probe.state));
    }
    return { path: probe.path, env };
}

export type PreparedCommand = {
    root: string;
    cwd: string;
    argv: string[];
    commands: ToolInvocation[];
    env: Record<string, string>;
};
