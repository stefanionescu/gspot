import { statSync } from 'node:fs';
import { CheckStop } from '#cli/system/errors.ts';
import { measureSpan } from '#cli/engine/results.ts';
import { stripVTControlCharacters } from 'node:util';
import { join, relative, isAbsolute } from 'node:path';
import type { SpawnResult } from '#cli/types/system.ts';
import { FILE_PLACEHOLDER } from '#cli/config/engine.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { Tool, Check } from '#cli/types/manifests.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { hasOnlyOutsideLinks } from '#cli/engine/outputs/text.ts';
import type { Finding, CheckResult } from '#cli/types/engine/run.ts';
import { parseOutput, OUTPUT_FORMATS } from '#cli/engine/outputs/formats.ts';

import {
    formatCrash,
    isReportedCrash,
    formatOutputTail,
    buildUnexplainedFailure,
} from '#cli/engine/run/tool-runs/failures.ts';
import type {
    CommandRun,
    OutputCheck,
    OutputPaths,
    ParsedFindings,
    CommandLineOutput,
} from '#cli/types/engine/tool-runs.ts';

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

/**
Build the result of a command from the findings of its runs. After a run that exits 0, a finding with neither a file
nor a line is dropped, because it is a line of the tool's report and not a defect. A shipped check whose format names
no file keeps such findings, because its tool prints warnings and still exits 0. A command check from gspot.toml
does not, because its exit code says whether the command found something.
*/
export function buildCheckResult(
    { check, configuration }: Pick<PlannedCheck, 'check' | 'configuration'>,
    completion: { base: CheckResult; state: CommandRun; commandArguments: string[]; start: number | undefined },
): CheckResult {
    const { base, state, commandArguments, start } = completion;
    const output = check.output;
    const descriptor = OUTPUT_FORMATS[output.format];
    const isEveryFindingKept =
        state.failed || (configuration !== undefined && check.runs !== 'history' && !descriptor.namesFiles(output));
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
