// Telling a tool that found something from a tool that fell over: a crash must never pass for a finding.
import type { Finding } from '#cli/checks/result.ts';
import type { OutputFormat } from '#cli/configurations/output-format.ts';
import type { ToolPin } from '#cli/configurations/manifests.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import { ToolOutputError, parseOutput } from '#cli/execution/output/parse.ts';
import type { PlannedCheck } from '#cli/execution/plan.ts';
import type { SpawnResult } from '#cli/platform/spawn.ts';
import { statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

// These formats have no file in their findings by design, so a finding with no file says nothing about the tool.
const FILELESS_FORMATS = new Set(['lines', 'none']);

// Whether the findings of this output name files of the repository: a link target, a coverage floor and a plain line do not.
function isFileNamed(output: OutputFormat | undefined): boolean {
    if (output === undefined || ['eslint-json', 'typos-json', 'markdownlint-json'].includes(output.format)) return true;
    if (FILELESS_FORMATS.has(output.format) || (output.file_is ?? 'path') !== 'path') return false;
    return output.pattern?.includes('(?<file>') ?? output.fields?.file !== undefined;
}

function isOnDisk(file: string, roots: string[]): boolean {
    if (file === '') return false;
    return roots.some(
        (root) => statSync(isAbsolute(file) ? file : join(root, file), { throwIfNoEntry: false }) !== undefined,
    );
}

/**
 * Whether a run that exited nonzero produced nothing that points at a real file.
 * @param spec the check
 * @param parsed the findings read from the output
 * @param roots the folders a finding path may be relative to: the working folder of the tool, then the repository root
 * @returns true when the tool broke
 */
export function isToolBroken(spec: CheckSpec, parsed: Finding[], roots: string[]): boolean {
    if (spec.count_regex !== undefined || !isFileNamed(spec.output)) return false;
    return parsed.every((finding) => !isOnDisk(finding.file, roots));
}

/**
 * Whether one command of a check crashed: it exited nonzero, it runs over many files, and nothing it printed names a real file.
 * @param spec the check
 * @param result what the command returned
 * @param parsed the findings read from its output
 * @param roots the folders a finding path may be relative to
 * @returns true for a crash
 */
export function isCrash(spec: CheckSpec, result: SpawnResult, parsed: Finding[], roots: string[]): boolean {
    if (result.code === 0 || (spec.command?.includes('{file}') ?? false)) return false;
    return isToolBroken(spec, parsed, roots);
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

const TAIL_LINES = 20;
const TRUFFLEHOG_FINDINGS = 183;
const TYPOS_FINDINGS = 2;

/**
 * Match the declared fatal diagnostics of a check or of the tool it runs, for checks and corrections.
 * @param spec the check, whose own pattern comes first
 * @param tool the tool the check runs, with the pattern every check of it shares
 * @param result the completed process
 * @returns true when the output says the tool fell over
 */
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
    const isTypos = spec.output?.format === 'typos-json';
    const isMarkdownlint = spec.output?.format === 'markdownlint-json';
    const broken =
        (result.code !== 0 &&
            spec.findings_exit_codes !== undefined &&
            !spec.findings_exit_codes.includes(result.code)) ||
        (isTypos && result.code !== 0 && result.code !== TYPOS_FINDINGS) ||
        (isMarkdownlint && result.code !== 0 && result.code !== 1) ||
        hasToolError(spec, planned.tool, result);
    const parsed =
        spec.output?.format === 'trufflehog-json'
            ? redactedFindings(spec, result, roots[1], broken)
            : broken
              ? []
              : parseOutput(spec, result.stdout, result.stderr, roots[1], roots[0]);
    if (
        broken ||
        ((planned.manifest !== undefined || isTypos || isMarkdownlint) && isCrash(spec, result, parsed, roots))
    ) {
        const name = planned.tool?.name ?? spec.name;
        const detail = toolOutputDetail(result, `${name} exited ${String(result.code)}`);
        throw new ToolOutputError(`${name} broke: exit ${String(result.code)}\n${detail}`);
    }
    return parsed;
}

function redactedFindings(spec: CheckSpec, result: SpawnResult, root: string, broken: boolean): Finding[] {
    if ((result.code !== 0 && result.code !== TRUFFLEHOG_FINDINGS) || broken)
        throw new ToolOutputError(`TruffleHog failed with exit ${String(result.code)}; raw output was withheld.`);
    const findings = parseOutput(spec, result.stdout, result.stderr, root);
    if (result.code === TRUFFLEHOG_FINDINGS && findings.length === 0)
        throw new ToolOutputError(
            'TruffleHog reported findings without valid structured data; raw output was withheld.',
        );
    return findings;
}
