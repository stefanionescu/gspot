import { statSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { GspotError } from '#cli/platform/public.ts';
import { toolPath } from '#cli/platform/contracts.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { TAIL_LINES } from '#cli/config/execution/command.ts';
import type { ScopeView } from '#cli/types/policy/settings.ts';
import type { CheckResult } from '#cli/types/execution/check.ts';
import { FILE_PLACEHOLDER } from '#cli/config/configurations.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import type { ExecutionFailure } from '#cli/types/tools/install.ts';
import { DEFAULT_OUTPUT_FORMAT } from '#cli/config/parsers/output.ts';
import type { Finding, OutputPaths } from '#cli/types/parsers/output.ts';
import { parseOutput, outputFormats } from '#cli/parsers/output/public.ts';
import type { ToolPin, CheckDeclaration } from '#cli/types/configurations.ts';

import type {
    OutputCheck,
    ParsedFindings,
    CommandRunState,
    InvocationOutput,
    CommandInvocation,
} from '#cli/types/execution/command.ts';

function prefixScope(findings: Finding[], scopePath: string): void {
    for (const finding of findings)
        if (finding.file !== '' && !isAbsolute(finding.file) && !finding.file.startsWith(`${scopePath}/`))
            finding.file = `${scopePath}/${finding.file}`;
}

function countMatches(check: CheckDeclaration, result: SpawnResult): number {
    if (check.finding_count_pattern === undefined) return 0;
    const pattern = new RegExp(check.finding_count_pattern, 'gu');
    return `${result.stdout}\n${result.stderr}`.matchAll(pattern).toArray().length;
}

function unexplainedFailure(
    check: CheckDeclaration,
    tool: ToolPin,
    result: SpawnResult,
    file: string | undefined,
): Finding {
    const placeholder = `${tool.name} exited ${String(result.code)}`;
    let text: string;
    if (file === undefined) text = toolOutputDetail(result, placeholder);
    else {
        const output = result.stderr.trim() === '' ? result.stdout.trim() : result.stderr.trim();
        const header =
            tool.diagnostic_header_pattern === undefined ? undefined : new RegExp(tool.diagnostic_header_pattern, 'u');
        text = output.split('\n').find((line) => line.trim() !== '' && header?.test(line) !== true) ?? placeholder;
    }
    const { name, help } = check;
    return { check: name, file: file === undefined ? '' : toolPath(file), message: text, help, fixable: false };
}

function markFailure(
    check: CheckDeclaration,
    tool: ToolPin,
    result: SpawnResult,
    parsed: Finding[],
    state: CommandRunState,
): void {
    if (check.finding_count_pattern !== undefined) {
        if (countMatches(check, result) > 0) state.isFailed = true;
        return;
    }
    if (result.code === 0) return;
    state.isFailed = true;
    if (parsed.length === 0) state.findings.push(unexplainedFailure(check, tool, result, undefined));
}

// Gives every finding without a path the file the command ran over, when the format attributes them that way.
function attributeFile(parsed: Finding[], invocation: CommandInvocation, check: CheckDeclaration): void {
    if (invocation.file === undefined) return;
    // Regex file groups can name a rule or another identifier instead of a path.
    if (check.output?.format === 'regex' && (check.output.file_type ?? 'path') !== 'path') return;
    for (const finding of parsed) if (finding.file === '') finding.file = invocation.file;
}

function isOnDisk(file: string, roots: string[]): boolean {
    if (file === '') return false;
    return roots.some(
        (root) => statSync(isAbsolute(file) ? file : join(root, file), { throwIfNoEntry: false }) !== undefined,
    );
}

function redactedFindings(
    check: CheckDeclaration,
    result: SpawnResult,
    paths: OutputPaths,
    broken: boolean,
): Finding[] {
    if ((result.code !== 0 && check.exit_codes?.includes(result.code) !== true) || broken)
        throw new GspotError('output', `TruffleHog failed with exit ${String(result.code)}; raw output was withheld.`);
    const findings = parseOutput(check, result.stdout, result.stderr, paths);
    if (result.code !== 0 && findings.length === 0)
        throw new GspotError(
            'output',
            'TruffleHog reported findings without valid structured data; raw output was withheld.',
        );
    return findings;
}

function parsedFindings(check: CheckDeclaration, result: SpawnResult, paths: OutputPaths, broken: boolean): Finding[] {
    if (outputFormats[(check.output ?? DEFAULT_OUTPUT_FORMAT).format].withholdOutput)
        return redactedFindings(check, result, paths, broken);
    if (broken) return [];
    return parseOutput(check, result.stdout, result.stderr, paths);
}

function outputFailure(planned: OutputCheck, result: SpawnResult): never {
    const name = planned.tool?.name ?? planned.check.name;
    const detail = toolOutputDetail(result, `${name} exited ${String(result.code)}`);
    throw new GspotError('output', `${name} broke: exit ${String(result.code)}\n${detail}`);
}

/**
 * Whether one command of a check crashed: it exited nonzero, it runs over many files, and nothing it printed names a real file.
 * @param check the check
 * @param result what the command returned
 * @param parsed the findings read from its output
 * @param paths the working directory and repository root
 * @returns true for a crash
 */
function isToolBroken(check: CheckDeclaration, result: SpawnResult, parsed: Finding[], paths: OutputPaths): boolean {
    if (result.code === 0 || (check.command?.includes(FILE_PLACEHOLDER) ?? false)) return false;
    const output = check.output ?? DEFAULT_OUTPUT_FORMAT;
    if (check.finding_count_pattern !== undefined || !outputFormats[output.format].namesFiles(output)) return false;
    return parsed.every((finding) => !isOnDisk(finding.file, [paths.cwd, paths.root]));
}

/**
 * Collect the status and findings.
 * @param base the initial result
 * @param check the output declaration
 * @param state the collected findings and failure state
 * @param argv the command
 * @param started the start time
 * @returns the completed result
 */
export function finishResult(
    base: CheckResult,
    check: CheckDeclaration,
    state: CommandRunState,
    argv: string[],
    started: number,
): CheckResult {
    const output = check.output ?? DEFAULT_OUTPUT_FORMAT;
    const descriptor = outputFormats[output.format];
    const isEveryFindingKept =
        state.isFailed ||
        check.finding_count_pattern !== undefined ||
        descriptor.withholdOutput ||
        descriptor.namesFiles(output);
    // Successful tools can print fileless progress; failed runs and counting checks must retain that output.
    const findings = isEveryFindingKept
        ? state.findings
        : state.findings.filter((finding) => finding.file !== '' || finding.line !== undefined);
    const status = state.isFailed || findings.length > 0 ? 'failed' : 'passed';
    return { ...base, status, duration: performance.now() - started, findings, command: argv };
}

/**
 * Parse output or report its refusal.
 * @param planned the check
 * @param result the process result
 * @param paths the source and working paths
 * @returns findings or a refusal note
 */
export function commandOutcome(planned: PlannedCheck, result: SpawnResult, paths: OutputPaths): ParsedFindings {
    try {
        return { findings: checkedFindings(planned, result, paths) };
    } catch (error) {
        if (error instanceof GspotError && error.code === 'output') return { note: error.message };
        throw error;
    }
}

/**
 * Records a process outcome and attributes its findings to their file and scope.
 * @param planned the check
 * @param output the command, captured process result, and parsed findings
 * @param state the run state
 */
export function recordInvocation(planned: PlannedCheck, output: InvocationOutput, state: CommandRunState): void {
    const { invocation, result, findings } = output;
    const { check, scope } = planned;
    const tool = planned.tool;
    if (tool === undefined) throw new Error('Cannot record tool output without a selected tool.');
    const parsed =
        findings.length === 0 && result.code !== 0 && invocation.file !== undefined
            ? [unexplainedFailure(check, tool, result, invocation.file)]
            : findings.map((finding) => ({ ...finding }));
    attributeFile(parsed, invocation, check);
    if (scope.scope.path !== '' && state.cwd !== state.root) prefixScope(parsed, scope.scope.path);
    state.findings.push(...parsed);
    markFailure(check, tool, result, parsed, state);
}

/**
 * Parse findings while rejecting crashes and withholding secret-scanner diagnostics.
 * @param planned the selected check
 * @param result captured output
 * @param paths the working directory and repository root
 * @returns structured findings
 */
export function checkedFindings(planned: OutputCheck, result: SpawnResult, paths: OutputPaths): Finding[] {
    const { check } = planned;
    const broken = hasToolError(check, planned.tool, result);
    const parsed = parsedFindings(check, result, paths, broken);
    const verifyFiles =
        planned.manifest !== undefined || outputFormats[(check.output ?? DEFAULT_OUTPUT_FORMAT).format].verifyFiles;
    if (broken || (verifyFiles && isToolBroken(check, result, parsed, paths))) outputFailure(planned, result);
    return parsed;
}

/**
 * Classify process failures consistently for command checks and built-in checks.
 * @param result the completed process
 * @param name the tool name
 * @param view the effective check settings
 * @returns the failure, or undefined when output can be interpreted
 */
export function executionFailure(
    result: SpawnResult,
    name: string,
    view: Pick<ScopeView, 'settings'>,
): ExecutionFailure | undefined {
    if (result.isCanceled === true) return { status: 'error', note: `${name} was canceled.` };
    if (result.isTimedOut === true)
        return { status: 'error', note: `${name} ran past ${String(toolDeadline(view))} seconds and was stopped.` };
    if (result.missing) return { status: 'missing', note: `${name} could not be started: ${result.stderr.trim()}` };
    if (result.isErrored === true)
        return {
            status: 'error',
            note: `${name} failed during process launch, capture, or termination: ${result.stderr.trim()}`,
        };
    return undefined;
}

/**
 * Reject exits outside a declared contract and match fatal diagnostics during checks and corrections.
 * @param check the findings exits and the check pattern that takes precedence over the tool pattern.
 * @param tool the tool the check runs, with the pattern every check of it shares.
 * @param result the completed process.
 * @returns true when an exit violates the declared contract or output reports a crash.
 */
export function hasToolError(check: CheckDeclaration, tool: ToolPin | undefined, result: SpawnResult): boolean {
    if (result.code !== 0 && check.exit_codes !== undefined && !check.exit_codes.includes(result.code)) return true;
    const pattern = check.crash_pattern ?? tool?.crash_pattern;
    return pattern !== undefined && new RegExp(pattern, 'mu').test(`${result.stdout}\n${result.stderr}`);
}

/**
 * Bound diagnostics from tools that do not require secret redaction.
 * @param result captured output
 * @param placeholder the text used when both streams are empty
 * @returns the bounded diagnostic
 */
export function toolOutputDetail(result: SpawnResult, placeholder: string): string {
    const output = [result.stderr, result.stdout]
        .map((stream) => stream.trim().split('\n').slice(-TAIL_LINES).join('\n'))
        .filter((stream) => stream !== '');
    return output.length === 0 ? placeholder : output.join('\n');
}

/**
 * Resolve the configured process deadline from effective check settings.
 * @param view the effective check settings
 * @returns the deadline in seconds
 */
export function toolDeadline(view: Pick<ScopeView, 'settings'>): number {
    return Number(view.settings['tool_timeout_seconds']);
}
