import { CheckStop } from '#cli/system/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { Tool, Check } from '#cli/types/manifests.ts';
import { STACK_FRAME_LINE } from '#cli/config/tools/programs.ts';
import type { OutputCheck } from '#cli/types/engine/tool-runs.ts';
import type { Finding, CheckFinding } from '#cli/types/engine/run.ts';

import {
    TAIL_LINES,
    OUT_OF_MEMORY,
    MODULE_FAILURE,
    BROKEN_TOOL_ADVICE,
    OUT_OF_MEMORY_MESSAGE,
    NO_ERROR_OUTPUT_MESSAGE,
} from '#cli/config/engine.ts';

/**
End a crash message with the install command when a module under the tool folder failed to load, because install
replaces a damaged or partial tool there.
*/
function addInstallAdvice(text: string, result: Pick<SpawnResult, 'stdout' | 'stderr'>): string {
    const output = `${result.stderr}\n${result.stdout}`.replaceAll('\\', '/');
    const isBrokenTool = MODULE_FAILURE.test(output) && output.includes(`${GSPOT_PATHS.nodeModules}/`);
    return isBrokenTool ? `${text}\n${BROKEN_TOOL_ADVICE}` : text;
}

export function buildUnexplainedFailure(
    check: Check,
    tool: Tool,
    result: SpawnResult,
    file: string | undefined,
): Finding {
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
        fixable: false,
    };
}

/**
Describe a crash by the error output of the tool, so the cause comes first. The report on stdout, such as the JSON
of a scanner that cannot reach its server, shows only when the tool printed no error, or with --verbose.
*/
export function formatCrash(
    planned: OutputCheck,
    result: SpawnResult,
    options: { verbose?: boolean | undefined },
): string {
    const failure = `${planned.tool?.name ?? planned.check.id} failed with exit ${String(result.code)}`;
    const errors = options.verbose === true ? '' : formatOutputTail({ stdout: '', stderr: result.stderr }, '', options);
    const detail = errors === '' ? formatOutputTail(result, '', options) : errors;
    return detail === '' ? `${failure} and printed nothing.` : addInstallAdvice(`${failure}:\n${detail}`, result);
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

export function formatCommandFailure(name: string, result: Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>): string {
    return `The ${name} command failed (exit ${String(result.code)}): ${formatOutputTail(result)}`;
}

export function assertToolFindings(
    result: Pick<SpawnResult, 'code' | 'stdout' | 'stderr'>,
    findings: CheckFinding[],
    toolName: string,
): CheckFinding[] {
    if (result.code !== 0 && findings.length === 0)
        throw new CheckStop('error', formatCommandFailure(toolName, result));
    return findings;
}
