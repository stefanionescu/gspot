// Runs external tools with explicit file lists and configuration, and turns their output into findings.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { isCrash } from '#cli/run/broken-tool.ts';
import { pushBase } from '#cli/repository/staged.ts';
import type { SpawnResult } from '#types/platform.ts';
import { fileBatches } from '#cli/run/file-batches.ts';
import { parseOutput } from '#cli/run/parse-output.ts';
import { probeTool } from '#cli/platform/tool-probe.ts';
import type { ToolPin, CheckSpec } from '#types/manifest.ts';
import type { CheckResult, Finding } from '#types/finding.ts';
import { baselinePath, substitute, perFileCommands, substituteValue } from '#cli/run/command-parts.ts';
import type { ToolRunState, PreparedCommand, Substitutions, Session, PlannedCheck } from '#types/run.ts';

const TAIL_LINES = 20;

const TOOL_ENV = { NO_COLOR: '1', FORCE_COLOR: '0' };

const FILES_PLACEHOLDER = '{files}';

const DEFAULT_TOOL_SECONDS = 600;

const MILLISECONDS = 1000;

// ESLint opens a crash with a greeting and its version, and the cause is the line after those.
function isBanner(line: string): boolean {
    return line.trim() === '' || line.startsWith('Oops!') || line.startsWith('ESLint: ');
}

function firstLine(result: SpawnResult, placeholder: string): string {
    const text = result.stderr.trim() === '' ? result.stdout.trim() : result.stderr.trim();
    return text.split('\n').find((line) => !isBanner(line)) ?? placeholder;
}

function tailLines(result: SpawnResult, placeholder: string): string {
    const output = [result.stderr, result.stdout]
        .map((stream) => stream.trim().split('\n').slice(0, TAIL_LINES).join('\n'))
        .filter((stream) => stream !== '');
    return output.length === 0 ? placeholder : output.join('\n');
}

function missingResult(
    base: CheckResult,
    tool: ToolPin,
    probe: { found?: string; floor?: string; hint?: string },
    state: string,
): CheckResult {
    const hint = probe.hint ?? 'install it';
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    const note =
        state === 'outdated'
            ? `${tool.name} ${probe.found ?? '?'} is below ${probe.floor ?? '?'}. Run: ${hint}`
            : `${tool.name}${version} is not installed. Run: ${hint}`;
    return { ...base, status: 'missing', note };
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
        if (finding.file !== '' && !finding.file.startsWith(`${scopePath}/`))
            finding.file = `${scopePath}/${finding.file}`;
}

function countMatches(spec: CheckSpec, result: SpawnResult): number {
    if (spec.count_regex === undefined) return 0;
    const pattern = new RegExp(spec.count_regex, 'gu');
    return `${result.stdout}\n${result.stderr}`.matchAll(pattern).toArray().length;
}

function isBroken(spec: CheckSpec, result: SpawnResult): boolean {
    if (spec.tool_errors === undefined) return false;
    return new RegExp(spec.tool_errors, 'mu').test(`${result.stdout}\n${result.stderr}`);
}

function unexplainedFailure(spec: CheckSpec, tool: ToolPin, result: SpawnResult, file: string | undefined): Finding {
    const placeholder = `${tool.name} exited ${String(result.code)}`;
    const text = file === undefined ? tailLines(result, placeholder) : firstLine(result, placeholder);
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

function isPerFile(spec: CheckSpec): boolean {
    return spec.command?.includes('{file}') ?? false;
}

function collect(
    planned: PlannedCheck,
    tool: ToolPin,
    command: string[],
    result: SpawnResult,
    state: ToolRunState,
): void {
    const { spec, scope } = planned;
    const parsed = parseOutput(spec, result.stdout, result.stderr, state.root);
    if (parsed.length === 0 && result.code !== 0 && isPerFile(spec))
        parsed.push(unexplainedFailure(spec, tool, result, command.at(-1) ?? ''));
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
): string[][] {
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
    const isEveryFindingKept = state.isFailed || spec.count_regex !== undefined;
    const findings = isEveryFindingKept
        ? state.findings
        : state.findings.filter((finding) => finding.file !== '' || finding.line !== undefined);
    const status = state.isFailed || findings.length > 0 ? 'fail' : 'ok';
    return { ...base, status, duration: performance.now() - started, findings, command: argv };
}

async function runCommands(
    planned: PlannedCheck,
    tool: ToolPin,
    prepared: PreparedCommand,
    base: CheckResult,
): Promise<CheckResult> {
    const { spec } = planned;
    const { cwd, argv } = prepared;
    const state: ToolRunState = { root: prepared.root, cwd, findings: [], isFailed: false };
    const started = performance.now();
    for (const command of prepared.commands) {
        const seconds = planned.scope.view.limit('tool_seconds') ?? DEFAULT_TOOL_SECONDS;
        const result = await runToolCommand(planned, command, prepared);
        if (result.isTimedOut === true) {
            const note = `${tool.name} ran past ${String(seconds)} seconds and was stopped; raise limits.tool_seconds with a reason, or run it at a later stage`;
            return { ...base, status: 'error', duration: performance.now() - started, note, command: argv };
        }
        if (result.missing)
            return { ...base, status: 'missing', note: `${tool.name} could not be started: ${result.stderr.trim()}` };
        const parsed = parseOutput(spec, result.stdout, result.stderr, state.root);
        // A check the repository declares prints what its author chose, so only a shipped check is read for a crash.
        const isShipped = planned.manifest !== undefined;
        if (isBroken(spec, result) || (isShipped && isCrash(spec, result, parsed, [cwd, state.root]))) {
            const detail = tailLines(result, `${tool.name} exited ${String(result.code)}`);
            const note = `${tool.name} broke: exit ${String(result.code)}\n${detail}`;
            return { ...base, status: 'error', duration: performance.now() - started, note, command: argv };
        }
        collect(planned, tool, command, result, state);
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
    toolPath: string | undefined,
): PreparedCommand {
    const { scope } = planned;
    const cwd = workingDirectory(session, planned);
    const relative = relativizer(session, planned, cwd);
    const files = planned.files.map((file) => relative(file.path));
    const sub: Substitutions = {
        files,
        scope: scope.scope.path,
        root: session.root,
        indent: scope.view.format.indent_width,
    };
    if (planned.messageFile !== undefined) sub.messageFile = planned.messageFile;
    const parts = [...command, ...Object.values(planned.spec.env ?? {})];
    if (parts.some((part) => part.includes('{merge_base}'))) sub.mergeBase = pushBase(session.root);
    const argv = substitute(session, planned, command, sub);
    if (toolPath !== undefined) argv[0] = toolPath;
    const commands = command.includes(FILES_PLACEHOLDER)
        ? batchedCommands(session, planned, command, sub, toolPath)
        : perFileCommands(argv, files);
    const env = Object.fromEntries(
        Object.entries(planned.spec.env ?? {}).map(([name, value]) => [
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
 * @returns the check result with its findings
 */
export async function runToolCheck(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const { spec, tool, scope } = planned;
    const base: CheckResult = {
        check: spec.name,
        scope: scope.scope.path,
        status: 'ok',
        files: planned.files.length,
        duration: 0,
        findings: [],
        baselined: 0,
    };
    if (tool === undefined || spec.command === undefined)
        return { ...base, status: 'error', note: 'this check has no command to run' };
    const probe = probeTool(session.root, tool);
    if (probe.state === 'missing' || probe.state === 'outdated') return missingResult(base, tool, probe, probe.state);
    const prepared = prepareCommand(session, planned, spec.command, probe.path);
    return runCommands(planned, tool, prepared, base);
}

/**
 * Runs one of a check's side commands (its baseline or prune command) once over every file it claims.
 * @param session the session
 * @param planned the check
 * @param command the command with its placeholders
 * @returns the spawn result, or undefined when the tool is missing
 */
export async function runSideCommand(
    session: Session,
    planned: PlannedCheck,
    command: string[],
): Promise<SpawnResult | undefined> {
    const { tool } = planned;
    if (tool === undefined) return undefined;
    const probe = probeTool(session.root, tool);
    if (probe.state === 'missing' || probe.state === 'outdated') return undefined;
    const prepared = prepareCommand(session, planned, command, probe.path);
    const baseline = baselinePath(session, planned);
    if (baseline !== undefined) mkdirSync(dirname(baseline), { recursive: true });
    return runToolCommand(planned, prepared.argv, prepared);
}

/**
 * Runs a tool command with the shared output environment and configured deadline.
 * @param plannedCheck the check whose limits apply
 * @param command the expanded argument vector
 * @param prepared the command directory and expanded environment
 * @returns the completed process result
 */
export async function runToolCommand(
    plannedCheck: PlannedCheck,
    command: string[],
    prepared: PreparedCommand,
): Promise<SpawnResult> {
    const seconds = plannedCheck.scope.view.limit('tool_seconds') ?? DEFAULT_TOOL_SECONDS;
    return run(command, {
        cwd: prepared.cwd,
        env: { ...TOOL_ENV, ...prepared.env },
        timeoutMs: seconds * MILLISECONDS,
    });
}
