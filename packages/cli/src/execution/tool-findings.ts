// What one tool run accumulates from its spawns: findings attributed to files and scopes, and whether it failed.
import { isAbsolute } from 'node:path';
import type { SpawnResult } from '#cli/types/platform.ts';
import type { Finding } from '#cli/types/checks/checks.ts';
import { toolOutputDetail } from '#cli/execution/broken-tool.ts';
import type { CheckSpec, ToolPin } from '#cli/types/configurations.ts';
import type { ToolRunState, PlannedCheck, ToolInvocation } from '#cli/types/execution/execution.ts';

function firstLine(result: SpawnResult, placeholder: string): string {
    const text = result.stderr.trim() === '' ? result.stdout.trim() : result.stderr.trim();
    return (
        text
            .split('\n')
            .find((line) => !(line.trim() === '' || line.startsWith('Oops!') || line.startsWith('ESLint: '))) ??
        placeholder
    );
}

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
    const text = file === undefined ? toolOutputDetail(result, placeholder) : firstLine(result, placeholder);
    const { name, help } = spec;
    return { check: name, file: file?.replaceAll('\\', '/') ?? '', message: text, help, fixable: false };
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

// Whether findings without a path belong to the file the command ran over: always, except for a regex format
// whose file group means something other than a path.
function attributesToFile(spec: PlannedCheck['spec']): boolean {
    return spec.output?.format !== 'regex' || (spec.output.file_is ?? 'path') === 'path';
}

// Gives every finding without a path the file the command ran over, when the format attributes them that way.
function attributeFile(parsed: Finding[], invocation: ToolInvocation, spec: CheckSpec): void {
    if (invocation.file === undefined || !attributesToFile(spec)) return;
    for (const finding of parsed) if (finding.file === '') finding.file = invocation.file;
}

/**
 * The note for a tool that cannot run: too old for its floor, or not installed.
 * @param tool the pin
 * @param probe what the probe found
 * @param probe.found the version the tool reported
 * @param probe.floor the lowest version the configuration accepts
 * @param probe.hint how to install the tool
 * @param state the probe state
 * @returns the note
 */
export function missingNote(
    tool: ToolPin,
    probe: {
        found?: string;
        floor?: string;
        hint?: string;
    },
    state: string,
): string {
    const hint = probe.hint ?? 'Install the configured tool.';
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    return state === 'outdated'
        ? `${tool.name} ${probe.found ?? '?'} is below ${probe.floor ?? '?'}. ${hint}`
        : `${tool.name}${version} is not installed. ${hint}`;
}

/**
 * Records one spawn's findings and failure in the run state, attributing findings to their file and scope.
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
