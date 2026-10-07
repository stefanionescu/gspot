// Shared process failures, declared crash diagnostics, and bounded failure output.
import { TAIL_LINES } from '#cli/config/execution/command.ts';
import type { ScopeView } from '#cli/types/policy/settings.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import type { ExecutionFailure } from '#cli/types/tools/install.ts';
import type { ToolPin, CheckSpec } from '#cli/types/configurations.ts';

/**
 * Classify process failures consistently for direct checks and engines.
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
 * @param spec the findings exits and the check pattern that takes precedence over the tool pattern.
 * @param tool the tool the check runs, with the pattern every check of it shares.
 * @param result the completed process.
 * @returns true when an exit violates the declared contract or output reports a crash.
 */
export function hasToolError(spec: CheckSpec, tool: ToolPin | undefined, result: SpawnResult): boolean {
    if (result.code !== 0 && spec.exit_codes !== undefined && !spec.exit_codes.includes(result.code)) return true;
    const pattern = spec.crash_pattern ?? tool?.crash_pattern;
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
