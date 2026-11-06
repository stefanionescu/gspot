import { statSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import {
    FILE_PLACEHOLDER,
    NO_ERROR_OUTPUT_MESSAGE,
    OUT_OF_MEMORY,
    OUT_OF_MEMORY_MESSAGE,
    TAIL_LINES,
} from '#cli/config/engine.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { STACK_FRAME_LINE } from '#cli/config/tools/programs.ts';
import { OUTPUT_FORMATS, parseOutput } from '#cli/engine/outputs/formats.ts';
import { hasOnlyOutsideLinks } from '#cli/engine/outputs/text.ts';
import { measureSpan } from '#cli/engine/results.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckResult } from '#cli/types/engine/run.ts';
import type {
    CheckFinding,
    CommandLineOutput,
    CommandRun,
    Finding,
    OutputCheck,
    OutputPaths,
    ParsedFindings,
} from '#cli/types/engine/tool-runs.ts';
import type { Check, Tool } from '#cli/types/manifests.ts';
import type { SpawnResult } from '#cli/types/system.ts';

// Node prints one of these when a module fails to resolve or parse, before the tool runs.
const MODULE_FAILURE =
    /\b(?:ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|ERR_REQUIRE_ESM|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_UNSUPPORTED_DIR_IMPORT|ERR_INVALID_PACKAGE_CONFIG)\b|Cannot find (?:module|package)|does not provide an export named|^SyntaxError: /mu;

const BROKEN_TOOL_ADVICE = `A tool in ${GSPOT_PATHS.nodeModules} failed to load. Run gspot install.`;

/**
End a crash message with the install command when a module under the tool folder failed to load, because install
replaces a damaged or partial tool there.
*/
function addInstallAdvice(text: string, result: Pick<SpawnResult, 'stdout' | 'stderr'>): string {
    const output = `${result.stderr}\n${result.stdout}`.replaceAll('\\', '/');
    const isBrokenTool = MODULE_FAILURE.test(output) && output.includes(`${GSPOT_PATHS.nodeModules}/`);
    return isBrokenTool ? `${text}\n${BROKEN_TOOL_ADVICE}` : text;
}

function buildUnexplainedFailure(check: Check, tool: Tool, result: SpawnResult, file: string | undefined): Finding {
    const emptyOutputText = `${tool.name} exited ${String(result.code)}`;
    let text: string;
    if (file === undefined) text = formatOutputTail(result, emptyOutputText);
    else {
        const output = result.stderr.trim() === '' ? result.stdout.trim() : result.stderr.trim();
        const header =
            tool.finding_header_pattern === undefined ? undefined : new RegExp(tool.finding_header_pattern, 'u');
        text = output.split('\n').find((line) => line.trim() !== '' && header?.test(line) !== true) ?? emptyOutputText;
    }
    return {
        check: check.id,
        file: file === undefined ? '' : convertToPosixPath(file),
        message: addInstallAdvice(text, result),
        help: check.help,
        fixable: false,
    };
}

function setFindingFiles(parsed: Finding[], file: string | undefined): void {
    if (file === undefined) return;
    for (const finding of parsed) if (finding.file === '') finding.file = file;
}

function isOnDisk(file: string, roots: string[]): boolean {
    if (file === '') return false;
    return roots.some(
        (root) => statSync(isAbsolute(file) ? file : join(root, file), { throwIfNoEntry: false }) !== undefined,
    );
}

/**
Describe a crash by the error output of the tool, so the cause comes first. The report on stdout, such as the JSON
of a scanner that cannot reach its server, shows only when the tool printed no error, or with --verbose.
*/
function formatCrash(planned: OutputCheck, result: SpawnResult, options: { verbose?: boolean | undefined }): string {
    const failure = `${planned.tool?.name ?? planned.check.id} failed with exit ${String(result.code)}`;
    const errors = options.verbose === true ? '' : formatOutputTail({ stdout: '', stderr: result.stderr }, '', options);
    const detail = errors === '' ? formatOutputTail(result, '', options) : errors;
    return detail === '' ? `${failure} and printed nothing.` : addInstallAdvice(`${failure}:\n${detail}`, result);
}

function isSilentCrash(check: Check, result: SpawnResult, parsed: Finding[], paths: OutputPaths): boolean {
    if (check.runs === 'history' || result.code === 0 || (check.command?.includes(FILE_PLACEHOLDER) ?? false))
        return false;
    const output = check.output;
    return (
        OUTPUT_FORMATS[output.format].namesFiles(output) &&
        parsed.every((finding) => finding.file !== '' && !isOnDisk(finding.file, [paths.cwd, paths.root]))
    );
}

function formatReportRefusal(
    planned: OutputCheck,
    result: SpawnResult,
    refusal: string,
    options: { verbose?: boolean | undefined },
): string {
    const tail = formatOutputTail({ stdout: '', stderr: result.stderr }, '', options);
    if (tail === '') return refusal;
    const name = planned.tool?.name ?? planned.check.id;
    const opening =
        planned.check.output.format === 'json'
            ? `${name} exited ${String(result.code)} without a JSON report:`
            : refusal;
    return `${opening}\n${tail}`;
}

export function clearOutsideLinkExit(check: Pick<Check, 'output'>, result: SpawnResult, root: string): SpawnResult {
    const text = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`);
    const isCleared =
        result.code !== 0 && check.output.format === 'grouped' && hasOnlyOutsideLinks(check.output, text, root);
    return isCleared ? { ...result, code: 0 } : result;
}

export function buildCheckResult(
    check: Check,
    completion: { base: CheckResult; state: CommandRun; commandArguments: string[]; start: number | undefined },
): CheckResult {
    const { base, state, commandArguments, start } = completion;
    const output = check.output;
    const descriptor = OUTPUT_FORMATS[output.format];
    const isEveryFindingKept = state.failed || (check.runs !== 'history' && !descriptor.namesFiles(output));
    const findings = isEveryFindingKept
        ? state.findings
        : state.findings.filter((finding) => finding.file !== '' || finding.line !== undefined);
    const status = state.failed || findings.length > 0 ? 'failed' : 'passed';
    return { ...base, status, ...measureSpan(start), findings, command: commandArguments };
}

export function parseCommandFindings(
    planned: OutputCheck,
    result: SpawnResult,
    paths: OutputPaths,
    options: { verbose?: boolean | undefined },
): ParsedFindings {
    const { check } = planned;
    if (isReportedCrash(check, planned.tool, result)) return { note: formatCrash(planned, result, options) };
    try {
        const parsed = parseOutput(check, result.stdout, result.stderr, paths);
        return isSilentCrash(check, result, parsed, paths)
            ? { note: formatCrash(planned, result, options) }
            : { findings: parsed };
    } catch (error) {
        if (error instanceof CheckStop) return { note: formatReportRefusal(planned, result, error.message, options) };
        throw error;
    }
}

export function addCommandLine(
    planned: PlannedCheck,
    tool: Tool,
    output: CommandLineOutput,
    commandRun: CommandRun,
): void {
    const { commandLine, result, findings } = output;
    const { check } = planned;
    const file =
        commandLine.file === undefined
            ? undefined
            : convertToPosixPath(relative(commandRun.root, join(commandRun.cwd, commandLine.file)));
    setFindingFiles(findings, file);
    if (result.code !== 0) {
        commandRun.failed = true;
        if (findings.length === 0) findings.push(buildUnexplainedFailure(check, tool, result, file));
    }
    commandRun.findings.push(...findings);
}

export function isReportedCrash(check: Check, tool: Tool | undefined, result: SpawnResult): boolean {
    if (result.code !== 0 && check.exit_codes !== undefined && !check.exit_codes.includes(result.code)) return true;
    const pattern = tool?.crash_pattern;
    return pattern !== undefined && new RegExp(pattern, 'mu').test(`${result.stdout}\n${result.stderr}`);
}

export function formatOutputTail(
    result: Pick<SpawnResult, 'stdout' | 'stderr'>,
    emptyOutputText = NO_ERROR_OUTPUT_MESSAGE,
    options: { verbose?: boolean | undefined } = {},
): string {
    if (OUT_OF_MEMORY.test(result.stderr) || OUT_OF_MEMORY.test(result.stdout)) return OUT_OF_MEMORY_MESSAGE;
    const output = [result.stderr, result.stdout]
        .map((stream) =>
            stripVTControlCharacters(stream)
                .split('\n')
                .filter((line) => options.verbose === true || !STACK_FRAME_LINE.test(line))
                .join('\n')
                .trim()
                .split('\n')
                .slice(-TAIL_LINES)
                .join('\n'),
        )
        .filter((stream) => stream !== '');
    return output.length === 0 ? emptyOutputText : output.join('\n');
}

export function assertToolFindings(
    result: Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>,
    findings: CheckFinding[],
    toolName: string,
): CheckFinding[] {
    if (result.code !== 0 && findings.length === 0)
        throw new CheckStop(
            'error',
            `The ${toolName} command failed (exit ${String(result.code)}): ${formatOutputTail(result)}`,
        );
    return findings;
}
