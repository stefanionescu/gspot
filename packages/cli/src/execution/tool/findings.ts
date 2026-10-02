// What one tool run accumulates from its spawns: findings attributed to files and scopes, and whether it failed.
import { statSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { toolPath } from '#cli/platform/paths.ts';
import type { Finding } from '#cli/types/checks.ts';
import { GspotError } from '#cli/platform/errors.ts';
import type { SpawnResult } from '#cli/types/platform.ts';
import { parseOutput } from '#cli/execution/tool/formats.ts';
import type { ToolPin, CheckSpec, OutputFormat } from '#cli/types/kits.ts';
import type { PlannedCheck, ToolRunState, ToolInvocation } from '#cli/types/execution/execution.ts';

import {
    TAIL_LINES,
    FILELESS_FORMATS,
    FINDING_EXIT_CODES,
    TRUFFLEHOG_FINDINGS,
} from '#cli/config/execution/execution.ts';

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
    let text: string;
    if (file === undefined) text = toolOutputDetail(result, placeholder);
    else {
        const output = result.stderr.trim() === '' ? result.stdout.trim() : result.stderr.trim();
        text =
            output
                .split('\n')
                .find((line) => !(line.trim() === '' || line.startsWith('Oops!') || line.startsWith('ESLint: '))) ??
            placeholder;
    }
    const { name, help } = spec;
    return { check: name, file: file === undefined ? '' : toolPath(file), message: text, help, fixable: false };
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

// Gives every finding without a path the file the command ran over, when the format attributes them that way.
function attributeFile(parsed: Finding[], invocation: ToolInvocation, spec: CheckSpec): void {
    if (invocation.file === undefined) return;
    // Regex file groups can name a rule or another identifier instead of a path.
    if (spec.output?.format === 'regex' && (spec.output.file_is ?? 'path') !== 'path') return;
    for (const finding of parsed) if (finding.file === '') finding.file = invocation.file;
}

// Whether the findings of this output name files of the repository: a link target, a coverage floor and a plain line do not.
function isFileNamed(output: OutputFormat | undefined): boolean {
    if (output === undefined || ['eslint-json', 'typos-json', 'markdownlint-json'].includes(output.format)) return true;
    if (FILELESS_FORMATS.has(output.format) || (output.file_is ?? 'path') !== 'path') return false;
    if (output.pattern !== undefined) return output.pattern.includes('(?<file>');
    return output.fields?.file !== undefined;
}

function isOnDisk(file: string, roots: string[]): boolean {
    if (file === '') return false;
    return roots.some(
        (root) => statSync(isAbsolute(file) ? file : join(root, file), { throwIfNoEntry: false }) !== undefined,
    );
}

function redactedFindings(spec: CheckSpec, result: SpawnResult, root: string, broken: boolean): Finding[] {
    if ((result.code !== 0 && result.code !== TRUFFLEHOG_FINDINGS) || broken)
        throw new GspotError(
            'tool-output',
            `TruffleHog failed with exit ${String(result.code)}; raw output was withheld.`,
        );
    const findings = parseOutput(spec, result.stdout, result.stderr, root);
    if (result.code === TRUFFLEHOG_FINDINGS && findings.length === 0)
        throw new GspotError(
            'tool-output',
            'TruffleHog reported findings without valid structured data; raw output was withheld.',
        );
    return findings;
}

function parsedFindings(spec: CheckSpec, result: SpawnResult, roots: [string, string], broken: boolean): Finding[] {
    if (spec.output?.format === 'trufflehog-json') return redactedFindings(spec, result, roots[1], broken);
    if (broken) return [];
    return parseOutput(spec, result.stdout, result.stderr, roots[1], roots[0]);
}

function outputFailure(planned: PlannedCheck, result: SpawnResult): never {
    const name = planned.tool?.name ?? planned.spec.name;
    const detail = toolOutputDetail(result, `${name} exited ${String(result.code)}`);
    throw new GspotError('tool-output', `${name} broke: exit ${String(result.code)}\n${detail}`);
}

/**
 * Whether one command of a check crashed: it exited nonzero, it runs over many files, and nothing it printed names a real file.
 * @param spec the check
 * @param result what the command returned
 * @param parsed the findings read from its output
 * @param roots the folders a finding path may be relative to
 * @returns true for a crash
 */
function isCrash(spec: CheckSpec, result: SpawnResult, parsed: Finding[], roots: string[]): boolean {
    if (result.code === 0 || (spec.command?.includes('{file}') ?? false)) return false;
    return isToolBroken(spec, parsed, roots);
}

/**
 * The note for a tool that cannot run: too old for its floor, or not installed.
 * @param tool the pin
 * @param inspection what the inspection found
 * @param inspection.found the version the tool reported
 * @param inspection.floor the lowest version the configuration accepts
 * @param inspection.hint how to install the tool
 * @param state the inspection state
 * @returns the note
 */
export function missingNote(
    tool: ToolPin,
    inspection: {
        found?: string;
        floor?: string;
        hint?: string;
    },
    state: string,
): string {
    const hint = inspection.hint ?? 'Install the configured tool.';
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    return state === 'outdated'
        ? `${tool.name} ${inspection.found ?? '?'} is below ${inspection.floor ?? '?'}. ${hint}`
        : `${tool.name}${version} is not installed. ${hint}`;
}

/**
 * Records a process outcome and attributes its findings to their file and scope.
 * @param planned the check
 * @param invocation the command that ran, with the file it ran over
 * @param result what the command printed and how it exited
 * @param state the run state
 * @param parsed the findings parsed from the output
 */
export function collect(
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
    attributeFile(parsed, invocation, spec);
    if (scope.scope.path !== '' && state.cwd !== state.root) prefixScope(parsed, scope.scope.path);
    state.findings.push(...parsed);
    markFailure(spec, tool, result, parsed, state);
}

/**
 * Whether a run that exited nonzero produced nothing that points at a real file.
 * @param spec the check.
 * @param parsed the findings read from the output.
 * @param roots the folders a finding path may be relative to: the working folder of the tool, then the repository root.
 * @returns true when the tool broke.
 */
export function isToolBroken(spec: CheckSpec, parsed: Finding[], roots: string[]): boolean {
    if (spec.count_regex !== undefined || !isFileNamed(spec.output)) return false;
    return parsed.every((finding) => !isOnDisk(finding.file, roots));
}

/**
 * Classify process failures consistently for direct checks and adapters.
 * @param result the completed process
 * @param name the tool name
 * @param seconds the configured deadline
 * @returns the failure, or undefined when output can be interpreted
 */
export function executionFailure(
    result: SpawnResult,
    name: string,
    seconds: number,
): { status: 'error' | 'missing'; note: string } | undefined {
    if (result.isCanceled === true) return { status: 'error', note: `${name} was canceled.` };
    if (result.isTimedOut === true)
        return { status: 'error', note: `${name} ran past ${String(seconds)} seconds and was stopped.` };
    if (result.missing) return { status: 'missing', note: `${name} could not be started: ${result.stderr.trim()}` };
    if (result.isErrored === true)
        return { status: 'error', note: `${name} failed during process launch, capture, or termination.` };
    return undefined;
}

/**
 * Match declared fatal diagnostics from a check or its tool during checks and corrections.
 * @param spec the check, whose own pattern comes first.
 * @param tool the tool the check runs, with the pattern every check of it shares.
 * @param result the completed process.
 * @returns true when the output says the tool fell over.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Checks and fixes decide that a tool crashed by the same declared pattern.
export function hasToolError(spec: CheckSpec, tool: ToolPin | undefined, result: SpawnResult): boolean {
    const pattern = spec.tool_errors ?? tool?.crash_pattern;
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
 * Parse findings while rejecting crashes and withholding secret-scanner diagnostics.
 * @param planned the selected check
 * @param result captured output
 * @param roots the working directory followed by the repository root
 * @returns structured findings
 */
export function checkedFindings(planned: PlannedCheck, result: SpawnResult, roots: [string, string]): Finding[] {
    const { spec } = planned;
    const specificCodes = FINDING_EXIT_CODES.get(spec.output?.format);
    const accepted = [spec.findings_exit_codes, specificCodes];
    const broken =
        (result.code !== 0 && accepted.some((codes) => codes !== undefined && !codes.includes(result.code))) ||
        hasToolError(spec, planned.tool, result);
    const parsed = parsedFindings(spec, result, roots, broken);
    const verifyFiles = planned.manifest !== undefined || specificCodes !== undefined;
    if (broken || (verifyFiles && isCrash(spec, result, parsed, roots))) outputFailure(planned, result);
    return parsed;
}
