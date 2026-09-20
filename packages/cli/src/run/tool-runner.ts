// Runs external tools with explicit file lists and configuration, and turns their output into findings.
import { dirname, join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { existsSync, mkdirSync } from 'node:fs';
import { isCrash } from '#cli/run/broken-tool.ts';
import { toPlatform } from '#cli/platform/paths.ts';
import { pushBase } from '#cli/repository/staged.ts';
import type { SpawnResult } from '#types/platform.ts';
import { fileBatches } from '#cli/run/file-batches.ts';
import { parseOutput } from '#cli/run/parse-output.ts';
import { probeTool } from '#cli/platform/tool-probe.ts';
import type { CheckResult, Finding } from '#types/finding.ts';
import { configurationName } from '#cli/presets/read-manifests.ts';
import type { ToolPin, CheckSpec, ConfigurationTarget } from '#types/manifest.ts';
import { isWorkspace, targetInScope, toolBaselineFile } from '#cli/run/scope-paths.ts';
import { existingFileArguments, listArguments, settingsFilled } from '#cli/run/list-arguments.ts';
import type { ToolRunState, PreparedCommand, Substitutions, Session, PlannedCheck } from '#types/run.ts';

const CONFIG_PLACEHOLDER = /\{config:(?<name>[a-z0-9-]+)\}/gu;

const STUB_PLACEHOLDER = /\{stub:(?<name>[^}]+)\}/gu;

const WORKSPACE_PREFIX = '{workspace:';

const TAIL_LINES = 20;

const TOOL_ENV = { NO_COLOR: '1', FORCE_COLOR: '0' };

const FILES_PLACEHOLDER = '{files}';

const DEFAULT_TOOL_SECONDS = 600;

const MILLISECONDS = 1000;

function allConfigs(session: Session, planned: PlannedCheck): ConfigurationTarget[] {
    const own = planned.manifest?.configs ?? [];
    const every = session.manifests
        .values()
        .flatMap((manifest) => manifest.configs)
        .toArray();
    return [...own, ...every];
}

function configurationPath(session: Session, planned: PlannedCheck, name: string): string {
    const target = allConfigs(session, planned).find(
        (config) => config.fragment !== true && configurationName(config.target) === name,
    );
    if (!target) throw new Error(`Check ${planned.id} names {config:${name}} and no preset renders it.`);
    return targetInScope(planned.scope.scope.path, target);
}

function stubPath(session: Session, planned: PlannedCheck, name: string, scope: string): string {
    const target = allConfigs(session, planned).find((config) => config.stub?.path === name);
    const path = target?.stub?.path ?? name;
    return scope === '' ? path : `${scope}/${path}`;
}

// The tool's own baseline file, absolute, whether or not it exists yet. One file per repository: the tool runs from the root, so its paths are root-relative in every scope.
function baselinePath(session: Session, planned: PlannedCheck): string | undefined {
    const file = planned.spec.baseline_file;
    return file === undefined ? undefined : join(session.root, toolBaselineFile(file, planned.scope.scope.path));
}

// `--suppressions-location` only when the file exists: ESLint refuses a missing one, and a repository with no findings has none.
function suppressionsArguments(session: Session, planned: PlannedCheck): string[] {
    const path = baselinePath(session, planned);
    if (path === undefined || !existsSync(path)) return [];
    return ['--suppressions-location', toPlatform(path), '--pass-on-unpruned-suppressions'];
}

function expandPart(session: Session, planned: PlannedCheck, part: string, sub: Substitutions): string[] {
    const policyPart = listArguments(planned, part) ?? existingFileArguments(session.root, part);
    return policyPart ?? plainPart(session, planned, part, sub);
}

function plainPart(session: Session, planned: PlannedCheck, part: string, sub: Substitutions): string[] {
    if (part === '{files}') return sub.files.map((file) => toPlatform(file));
    if (part === '{suppressions}') return suppressionsArguments(session, planned);
    if (part === '{file}') return [];
    if (part.startsWith(WORKSPACE_PREFIX) && part.endsWith('}'))
        return isWorkspace(session.root, sub.scope) ? [part.slice(WORKSPACE_PREFIX.length, -1), sub.scope] : [];
    return [substituteOne(session, planned, part, sub)];
}

function substituteOne(session: Session, planned: PlannedCheck, part: string, sub: Substitutions): string {
    return settingsFilled(planned, part)
        .replaceAll(CONFIG_PLACEHOLDER, (_match, name: string) =>
            toPlatform(join(session.root, configurationPath(session, planned, name))),
        )
        .replaceAll(STUB_PLACEHOLDER, (_match, name: string) => toPlatform(stubPath(session, planned, name, sub.scope)))
        .replaceAll('{scope}', () => (sub.scope === '' ? '.' : sub.scope))
        .replaceAll('{root}', () => sub.root)
        .replaceAll('{indent}', () => String(sub.indent))
        .replaceAll('{message_file}', () => sub.messageFile ?? '')
        .replaceAll('{merge_base}', () => sub.mergeBase ?? '')
        .replaceAll('{baseline}', () => toPlatform(baselinePath(session, planned) ?? ''));
}

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

function perFileCommands(argv: string[], command: string[], files: string[]): string[][] {
    const slot = command.indexOf('{file}');
    if (slot === -1) return [argv];
    return files.map((file) => [...argv.slice(0, slot), toPlatform(file), ...argv.slice(slot + 1)]);
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
    return { check: spec.id, file: file?.replaceAll('\\', '/') ?? '', message: text, help: spec.fix, fixable: false };
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
    return fileBatches(sub.files, fixed, process.platform).map((files) => {
        const argv = substitute(session, planned, command, { ...sub, files });
        if (toolPath !== undefined) argv[0] = toolPath;
        return argv;
    });
}

function prepare(
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
    if (command.some((part) => part.includes('{merge_base}'))) sub.mergeBase = pushBase(session.root);
    const argv = substitute(session, planned, command, sub);
    if (toolPath !== undefined) argv[0] = toolPath;
    const commands = command.includes(FILES_PLACEHOLDER)
        ? batchedCommands(session, planned, command, sub, toolPath)
        : perFileCommands(argv, command, files);
    return { root: session.root, cwd, argv, commands };
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
        const result = await run(command, { cwd, env: TOOL_ENV, timeoutMs: seconds * MILLISECONDS });
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
 * Expands the placeholders of a manifest command into argv. the files placeholder expands to every file, in the platform's form.
 * @param session the session
 * @param planned the check being run
 * @param command the command as the manifest wrote it
 * @param sub the values the placeholders take
 * @returns the argv to spawn
 */
export function substitute(session: Session, planned: PlannedCheck, command: string[], sub: Substitutions): string[] {
    return command.flatMap((part) => expandPart(session, planned, part, sub));
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
        id: spec.id,
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
    const prepared = prepare(session, planned, spec.command, probe.path);
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
    const prepared = prepare(session, planned, command, probe.path);
    const baseline = baselinePath(session, planned);
    if (baseline !== undefined) mkdirSync(dirname(baseline), { recursive: true });
    return run(prepared.argv, { cwd: prepared.cwd });
}
