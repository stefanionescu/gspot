import { statSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { join, relative, isAbsolute } from 'node:path';
import { TAIL_LINES } from '#cli/config/runs/command.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { OUT_OF_MEMORY } from '#cli/config/runs/output.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { OutputPaths } from '#cli/types/runs/output.ts';
import { FILE_PLACEHOLDER } from '#cli/config/configurations.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { Finding, CheckResult } from '#cli/types/runs/check.ts';
import { parseOutput, outputFormats } from '#cli/runs/output/formats.ts';
import type { ToolDeclaration, CheckDeclaration } from '#cli/types/configurations.ts';

import type {
    OutputCheck,
    ParsedFindings,
    CommandRunState,
    InvocationOutput,
    CommandInvocation,
} from '#cli/types/runs/command.ts';

function buildUnexplainedFailure(
    check: CheckDeclaration,
    tool: ToolDeclaration,
    result: SpawnResult,
    file: string | undefined,
): Finding {
    const placeholder = `${tool.name} exited ${String(result.code)}`;
    let text: string;
    if (file === undefined) text = formatOutputTail(result, placeholder);
    else {
        const output = result.stderr.trim() === '' ? result.stdout.trim() : result.stderr.trim();
        const header =
            tool.finding_header_pattern === undefined ? undefined : new RegExp(tool.finding_header_pattern, 'u');
        text = output.split('\n').find((line) => line.trim() !== '' && header?.test(line) !== true) ?? placeholder;
    }
    const { name, help } = check;
    return {
        check: name,
        file: file === undefined ? '' : convertToPosixPath(file),
        message: text,
        help,
        fixable: false,
    };
}

function setFindingFiles(parsed: Finding[], invocation: CommandInvocation, paths: OutputPaths): void {
    if (invocation.file === undefined) return;
    const file = convertToPosixPath(relative(paths.root, join(paths.cwd, invocation.file)));
    for (const finding of parsed) if (finding.file === '') finding.file = file;
}

function isOnDisk(file: string, roots: string[]): boolean {
    if (file === '') return false;
    return roots.some(
        (root) => statSync(isAbsolute(file) ? file : join(root, file), { throwIfNoEntry: false }) !== undefined,
    );
}

function failBrokenTool(planned: OutputCheck, result: SpawnResult): never {
    const name = planned.tool?.name ?? planned.check.name;
    const detail = formatOutputTail(result, `${name} exited ${String(result.code)}`);
    throw new GspotError('output', `${name} broke: exit ${String(result.code)}\n${detail}`);
}

/**
 * Checks whether a command crashed: it exited nonzero, its format names files, it runs on many files, and no finding names a real file.
 *
 * @param check the output format and command.
 * @param result what the command returned.
 * @param parsed the findings read from its output.
 * @param paths the working folder and repository root.
 * @returns true for a crash.
 */
function isToolBroken(check: CheckDeclaration, result: SpawnResult, parsed: Finding[], paths: OutputPaths): boolean {
    if (check.runs === 'history' || result.code === 0 || (check.command?.includes(FILE_PLACEHOLDER) ?? false))
        return false;
    const output = check.output;
    if (!outputFormats[output.format].namesFiles(output)) return false;
    return parsed.every((finding) => !isOnDisk(finding.file, [paths.cwd, paths.root]));
}

/**
 * Parses findings and fails on a crash.
 *
 * @param planned the check that ran.
 * @param result what the command printed.
 * @param paths the working folder and repository root.
 * @returns the parsed tool results.
 */
function parseVerifiedFindings(planned: OutputCheck, result: SpawnResult, paths: OutputPaths): Finding[] {
    const { check } = planned;
    if (hasToolError(check, planned.tool, result)) failBrokenTool(planned, result);
    const parsed = parseOutput(check, result.stdout, result.stderr, paths);
    if (isToolBroken(check, result, parsed, paths)) failBrokenTool(planned, result);
    return parsed;
}

/**
 * Builds the check result from the run state.
 *
 * @param check the declaration that ran.
 * @param completion what the run collected.
 * @param completion.base the initial check result.
 * @param completion.state the findings and failure flag.
 * @param completion.commandArguments what the process ran, placeholders expanded.
 * @param completion.started the monotonic start time.
 * @returns the status, findings, and duration.
 */
export function buildCheckResult(
    check: CheckDeclaration,
    completion: { base: CheckResult; state: CommandRunState; commandArguments: string[]; started: number },
): CheckResult {
    const { base, state, commandArguments, started } = completion;
    const output = check.output;
    const descriptor = outputFormats[output.format];
    const isEveryFindingKept = state.isFailed || (check.runs !== 'history' && descriptor.namesFiles(output));
    // Successful tools can print fileless progress; failed runs must retain that output.
    const findings = isEveryFindingKept
        ? state.findings
        : state.findings.filter((finding) => finding.file !== '' || finding.line !== undefined);
    const status = state.isFailed || findings.length > 0 ? 'failed' : 'passed';
    return { ...base, status, duration: performance.now() - started, findings, command: commandArguments };
}

/**
 * Parses the command output, or returns why gspot refused it.
 *
 * @param planned the check that ran.
 * @param result what the process returned.
 * @param paths the repository root and working folder.
 * @returns findings or a refusal note.
 */
export function parseCommandFindings(planned: OutputCheck, result: SpawnResult, paths: OutputPaths): ParsedFindings {
    try {
        return { findings: parseVerifiedFindings(planned, result, paths) };
    } catch (error) {
        if (error instanceof GspotError && error.code === 'output') return { note: error.message };
        throw error;
    }
}

/**
 * Records a process result and assigns its findings to their file and scope.
 *
 * @param planned the check that ran.
 * @param tool the declaration with its version pin.
 * @param output what one run printed and parsed.
 * @param state what the runs collected so far.
 */
export function recordInvocation(
    planned: PlannedCheck,
    tool: ToolDeclaration,
    output: InvocationOutput,
    state: CommandRunState,
): void {
    const { invocation, result, findings } = output;
    const { check } = planned;
    const file =
        invocation.file === undefined
            ? undefined
            : convertToPosixPath(relative(state.root, join(state.cwd, invocation.file)));
    setFindingFiles(findings, invocation, state);
    if (result.code !== 0) {
        state.isFailed = true;
        if (findings.length === 0) findings.push(buildUnexplainedFailure(check, tool, result, file));
    }
    state.findings.push(...findings);
}

/**
 * Checks whether a run exited with an undeclared code or printed a crash pattern.
 *
 * @param check the declared exit codes.
 * @param tool the declaration with the shared crash pattern.
 * @param result what the process returned.
 * @returns whether the tool broke.
 */
export function hasToolError(check: CheckDeclaration, tool: ToolDeclaration | undefined, result: SpawnResult): boolean {
    if (result.code !== 0 && check.exit_codes !== undefined && !check.exit_codes.includes(result.code)) return true;
    const pattern = tool?.crash_pattern;
    return pattern !== undefined && new RegExp(pattern, 'mu').test(`${result.stdout}\n${result.stderr}`);
}

/**
 * Formats the last lines of tool output.
 *
 * @param result what the tool printed.
 * @param placeholder the text when both streams stay empty.
 * @returns the last lines of output.
 */
export function formatOutputTail(
    result: Pick<SpawnResult, 'stdout' | 'stderr'>,
    placeholder = 'The tool printed no error output.',
): string {
    if (OUT_OF_MEMORY.test(result.stderr) || OUT_OF_MEMORY.test(result.stdout))
        return 'The tool ran out of memory. It most likely read build output or a bundle: keep that folder in .gitignore, or add an [[ignore]] with its paths.';
    const output = [result.stderr, result.stdout]
        .map((stream) => stream.trim().split('\n').slice(-TAIL_LINES).join('\n'))
        .filter((stream) => stream !== '');
    return output.length === 0 ? placeholder : output.join('\n');
}

/**
 * Returns the findings, or fails when the tool exited nonzero with none.
 *
 * @param result the exit code and output.
 * @param findings what the parser read.
 * @param toolName the program that ran.
 * @returns the parsed findings.
 */
export function assertToolFindings(
    result: Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>,
    findings: Finding[],
    toolName: string,
): Finding[] {
    if (result.code !== 0 && findings.length === 0)
        throw new Error(`The ${toolName} command failed (exit ${String(result.code)}): ${formatOutputTail(result)}`);
    return findings;
}
