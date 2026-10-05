// What one tool run accumulates from its spawns: findings attributed to files and scopes, and whether it failed.
import { statSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { toolPath } from '#cli/platform/paths.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { parseOutput } from '#cli/parsers/output/parse.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { FILELESS_FORMATS } from '#cli/config/execution/output.ts';
import { FILE_PLACEHOLDER } from '#cli/config/execution/command.ts';
import type { ToolPin, CheckSpec } from '#cli/types/configurations.ts';
import type { CommandInvocation } from '#cli/types/execution/command.ts';
import type { OutputSpec, OutputPaths } from '#cli/types/parsers/output.ts';
import type { Finding, PlannedCheck } from '#cli/types/execution/runtime.ts';
import { hasToolError, toolOutputDetail } from '#cli/execution/command/failures.ts';
import type { OutputCheck, CommandRunState, InvocationOutput } from '#cli/types/execution/output.ts';

function prefixScope(findings: Finding[], scopePath: string): void {
    for (const finding of findings)
        if (finding.file !== '' && !isAbsolute(finding.file) && !finding.file.startsWith(`${scopePath}/`))
            finding.file = `${scopePath}/${finding.file}`;
}

function countMatches(spec: CheckSpec, result: SpawnResult): number {
    if (spec.finding_count_pattern === undefined) return 0;
    const pattern = new RegExp(spec.finding_count_pattern, 'gu');
    return `${result.stdout}\n${result.stderr}`.matchAll(pattern).toArray().length;
}

function unexplainedFailure(spec: CheckSpec, tool: ToolPin, result: SpawnResult, file: string | undefined): Finding {
    const placeholder = `${tool.name} exited ${String(result.code)}`;
    let text: string;
    if (file === undefined) text = toolOutputDetail(result, placeholder);
    else {
        const output = result.stderr.trim() === '' ? result.stdout.trim() : result.stderr.trim();
        const header =
            tool.diagnostic_header_pattern === undefined ? undefined : new RegExp(tool.diagnostic_header_pattern, 'u');
        text = output.split('\n').find((line) => line.trim() !== '' && header?.test(line) !== true) ?? placeholder;
    }
    const { name, help } = spec;
    return { check: name, file: file === undefined ? '' : toolPath(file), message: text, help, fixable: false };
}

function markFailure(
    spec: CheckSpec,
    tool: ToolPin,
    result: SpawnResult,
    parsed: Finding[],
    state: CommandRunState,
): void {
    if (spec.finding_count_pattern !== undefined) {
        if (countMatches(spec, result) > 0) state.isFailed = true;
        return;
    }
    if (result.code === 0) return;
    state.isFailed = true;
    if (parsed.length === 0) state.findings.push(unexplainedFailure(spec, tool, result, undefined));
}

// Gives every finding without a path the file the command ran over, when the format attributes them that way.
function attributeFile(parsed: Finding[], invocation: CommandInvocation, spec: CheckSpec): void {
    if (invocation.file === undefined) return;
    // Regex file groups can name a rule or another identifier instead of a path.
    if (spec.output?.format === 'regex' && (spec.output.file_type ?? 'path') !== 'path') return;
    for (const finding of parsed) if (finding.file === '') finding.file = invocation.file;
}

// Whether the findings of this output name files of the repository: a link target, a coverage floor and a plain line do not.
function isFileNamed(output: OutputSpec | undefined): boolean {
    if (output === undefined || ['eslint', 'typos', 'markdownlint'].includes(output.format)) return true;
    if (FILELESS_FORMATS.has(output.format) || (output.file_type ?? 'path') !== 'path') return false;
    if (output.pattern !== undefined) return output.pattern.includes('(?<file>');
    return output.fields?.file !== undefined;
}

function isOnDisk(file: string, roots: string[]): boolean {
    if (file === '') return false;
    return roots.some(
        (root) => statSync(isAbsolute(file) ? file : join(root, file), { throwIfNoEntry: false }) !== undefined,
    );
}

function redactedFindings(spec: CheckSpec, result: SpawnResult, paths: OutputPaths, broken: boolean): Finding[] {
    if ((result.code !== 0 && spec.exit_codes?.includes(result.code) !== true) || broken)
        throw new GspotError('output', `TruffleHog failed with exit ${String(result.code)}; raw output was withheld.`);
    const findings = parseOutput(spec, result.stdout, result.stderr, paths);
    if (result.code !== 0 && findings.length === 0)
        throw new GspotError(
            'output',
            'TruffleHog reported findings without valid structured data; raw output was withheld.',
        );
    return findings;
}

function parsedFindings(spec: CheckSpec, result: SpawnResult, paths: OutputPaths, broken: boolean): Finding[] {
    if (spec.output?.format === 'trufflehog-json') return redactedFindings(spec, result, paths, broken);
    if (broken) return [];
    return parseOutput(spec, result.stdout, result.stderr, paths);
}

function outputFailure(planned: OutputCheck, result: SpawnResult): never {
    const name = planned.tool?.name ?? planned.spec.name;
    const detail = toolOutputDetail(result, `${name} exited ${String(result.code)}`);
    throw new GspotError('output', `${name} broke: exit ${String(result.code)}\n${detail}`);
}

/**
 * Whether one command of a check crashed: it exited nonzero, it runs over many files, and nothing it printed names a real file.
 * @param spec the check
 * @param result what the command returned
 * @param parsed the findings read from its output
 * @param paths the working directory and repository root
 * @returns true for a crash
 */
function isToolBroken(spec: CheckSpec, result: SpawnResult, parsed: Finding[], paths: OutputPaths): boolean {
    if (result.code === 0 || (spec.command?.includes(FILE_PLACEHOLDER) ?? false)) return false;
    if (spec.finding_count_pattern !== undefined || !isFileNamed(spec.output)) return false;
    return parsed.every((finding) => !isOnDisk(finding.file, [paths.cwd, paths.root]));
}

/**
 * Records a process outcome and attributes its findings to their file and scope.
 * @param planned the check
 * @param output the command, captured process result, and parsed findings
 * @param state the run state
 */
export function recordInvocation(planned: PlannedCheck, output: InvocationOutput, state: CommandRunState): void {
    const { invocation, result, findings } = output;
    const { spec, scope } = planned;
    const tool = planned.tool;
    if (tool === undefined) throw new Error('Cannot record tool output without a selected tool.');
    const parsed =
        findings.length === 0 && result.code !== 0 && invocation.file !== undefined
            ? [unexplainedFailure(spec, tool, result, invocation.file)]
            : findings.map((finding) => ({ ...finding }));
    attributeFile(parsed, invocation, spec);
    if (scope.scope.path !== '' && state.cwd !== state.root) prefixScope(parsed, scope.scope.path);
    state.findings.push(...parsed);
    markFailure(spec, tool, result, parsed, state);
}

/**
 * Parse findings while rejecting crashes and withholding secret-scanner diagnostics.
 * @param planned the selected check
 * @param result captured output
 * @param paths the working directory and repository root
 * @returns structured findings
 */
export function checkedFindings(planned: OutputCheck, result: SpawnResult, paths: OutputPaths): Finding[] {
    const { spec } = planned;
    const broken = hasToolError(spec, planned.tool, result);
    const parsed = parsedFindings(spec, result, paths, broken);
    const verifyFiles =
        planned.manifest !== undefined || spec.output?.format === 'typos' || spec.output?.format === 'markdownlint';
    if (broken || (verifyFiles && isToolBroken(spec, result, parsed, paths))) outputFailure(planned, result);
    return parsed;
}
