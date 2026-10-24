import { statSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { join, relative, isAbsolute } from 'node:path';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { OutputPaths } from '#cli/types/runs/output.ts';
import { FILE_PLACEHOLDER } from '#cli/config/placeholders.ts';
import type { Tool, Check } from '#cli/types/configurations.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import type { Finding, CheckResult } from '#cli/types/runs/check.ts';
import { parseOutput, outputFormats } from '#cli/runs/output/formats.ts';
import { TAIL_LINES, OUT_OF_MEMORY } from '#cli/config/runs/command/output.ts';
import type { CommandRun, OutputCheck, ParsedFindings, CommandLineOutput } from '#cli/types/runs/command.ts';

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
    const { id: name, help } = check;
    return {
        check: name,
        file: file === undefined ? '' : convertToPosixPath(file),
        message: text,
        help,
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

function throwCrash(planned: OutputCheck, result: SpawnResult, options: { verbose?: boolean | undefined }): never {
    const failure = `${planned.tool?.name ?? planned.check.id} failed with exit ${String(result.code)}`;
    if (planned.check.needs?.includes('network') === true) {
        const last = result.stderr.trim().split('\n').at(-1);
        const detail = last === undefined || last === '' ? '' : `\n${last}`;
        throw new GspotError(
            'output',
            `${failure}. It needs network access: check the network or proxy, then run again.${detail}`,
        );
    }
    const detail = formatOutputTail(result, '', options);
    throw new GspotError('output', detail === '' ? `${failure} and printed nothing.` : `${failure}:\n${detail}`);
}

function isSilentCrash(check: Check, result: SpawnResult, parsed: Finding[], paths: OutputPaths): boolean {
    if (check.runs === 'history' || result.code === 0 || (check.command?.includes(FILE_PLACEHOLDER) ?? false))
        return false;
    const output = check.output;
    return outputFormats[output.format].namesFiles(output)
        ? parsed.every((finding) => !isOnDisk(finding.file, [paths.cwd, paths.root]))
        : false;
}

function parseVerifiedFindings(
    planned: OutputCheck,
    result: SpawnResult,
    paths: OutputPaths,
    options: { verbose?: boolean | undefined },
): Finding[] {
    const { check } = planned;
    if (isReportedCrash(check, planned.tool, result)) throwCrash(planned, result, options);
    const parsed = parseOutput(check, result.stdout, result.stderr, paths);
    if (isSilentCrash(check, result, parsed, paths)) throwCrash(planned, result, options);
    return parsed;
}

/**
Builds the check result from what the runs collected.

@param check the check that ran.
@param completion what the run collected.
@param completion.base the initial check result.
@param completion.state the findings and failure flag.
@param completion.commandArguments what the process ran, placeholders expanded.
@param completion.started the monotonic start time.
@returns the status, findings, and duration.
*/
export function buildCheckResult(
    check: Check,
    completion: { base: CheckResult; state: CommandRun; commandArguments: string[]; started: number },
): CheckResult {
    const { base, state, commandArguments, started } = completion;
    const output = check.output;
    const descriptor = outputFormats[output.format];
    const isEveryFindingKept = state.failed || (check.runs !== 'history' && descriptor.namesFiles(output));
    const findings = isEveryFindingKept
        ? state.findings
        : state.findings.filter((finding) => finding.file !== '' || finding.line !== undefined);
    const status = state.failed || findings.length > 0 ? 'failed' : 'passed';
    return { ...base, status, duration: Math.round(performance.now() - started), findings, command: commandArguments };
}

/**
Parses the command output, or returns why gspot refused it.

@param planned the check that ran.
@param result what the process returned.
@param paths the repository root and working folder.
@param options controls crash details.
@param options.verbose includes stack frames.
@returns findings or a refusal note.
*/
export function parseCommandFindings(
    planned: OutputCheck,
    result: SpawnResult,
    paths: OutputPaths,
    options: { verbose?: boolean | undefined } = {},
): ParsedFindings {
    try {
        return { findings: parseVerifiedFindings(planned, result, paths, options) };
    } catch (error) {
        if (error instanceof GspotError && error.code === 'output') return { note: error.message };
        throw error;
    }
}

/**
Records a process result and assigns its findings to their file and scope.

@param planned the check that ran.
@param tool the tool with its version pin.
@param output what one run printed and parsed.
@param commandRun what the runs collected so far.
*/
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

/**
Checks whether a run exited with an undeclared code or printed a crash pattern.

@param check the declared exit codes and crash pattern.
@param tool the tool with the shared crash pattern.
@param result what the process returned.
@returns whether the tool broke.
*/
export function isReportedCrash(check: Check, tool: Tool | undefined, result: SpawnResult): boolean {
    if (result.code !== 0 && check.exit_codes !== undefined && !check.exit_codes.includes(result.code)) return true;
    const pattern = tool?.crash_pattern;
    return pattern !== undefined && new RegExp(pattern, 'mu').test(`${result.stdout}\n${result.stderr}`);
}

/**
Formats the last lines of tool output.

@param result what the tool printed.
@param emptyOutputText the text when both streams stay empty.
@param options controls crash details.
@param options.verbose includes stack frames.
@returns the last lines of output.
*/
export function formatOutputTail(
    result: Pick<SpawnResult, 'stdout' | 'stderr'>,
    emptyOutputText = 'The tool printed no error output.',
    options: { verbose?: boolean | undefined } = {},
): string {
    if (OUT_OF_MEMORY.test(result.stderr) || OUT_OF_MEMORY.test(result.stdout))
        return 'The tool ran out of memory. It most likely read build output or a bundle: keep that folder in .gitignore, or add an [[ignore]] with its paths.';
    const output = [result.stderr, result.stdout]
        .map((stream) =>
            stream
                .split('\n')
                .filter((line) => options.verbose === true || !/^\s+at /u.test(line))
                .join('\n')
                .trim()
                .split('\n')
                .slice(-TAIL_LINES)
                .join('\n'),
        )
        .filter((stream) => stream !== '');
    return output.length === 0 ? emptyOutputText : output.join('\n');
}

/**
Returns the findings, or fails when the tool exited nonzero with none.

@param result the exit code and output.
@param findings what the parser read.
@param toolName the program that ran.
@returns the parsed findings.
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
