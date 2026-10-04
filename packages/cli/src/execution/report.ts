// The report a run ends with: every result, the ignores that matched, the skips, and the exit code.
import type { Session } from '#cli/types/execution/session.ts';
import { FAILED_STATUSES } from '#cli/config/execution/runtime.ts';
import { EXIT_ERROR, EXIT_FINDINGS } from '#cli/config/platform/runtime.ts';
import type { FixReport, RunReport, CheckResult, ReportInput, PlannedCheck } from '#cli/types/execution/runtime.ts';

// Name each failed or unavailable check and failed fixer once.
function failedChecks(results: CheckResult[], fixes: FixReport | undefined): string[] {
    const checks = results.filter((result) => FAILED_STATUSES.has(result.status)).map((result) => result.check);
    const corrections = (fixes?.results ?? []).flatMap((result) => (result.status === 'failed' ? [result.check] : []));
    return [...new Set([...checks, ...corrections])];
}

// Identify incomplete runs caused by cancellation, unavailable checks, or failed fixers.
function isIncomplete(session: Session, results: CheckResult[], fixes: FixReport | undefined): boolean {
    if (session.cancelSignal?.aborted === true) return true;
    if (results.some((result) => result.status === 'missing' || result.status === 'error')) return true;
    return fixes?.results.some((result) => result.status === 'failed') === true;
}

/**
 * Start a result with its planned identity and selected file count.
 * @param planned the selected check and scope
 * @returns a passed result before execution adds findings or a diagnostic
 */
export function emptyResult(planned: PlannedCheck): CheckResult {
    return {
        check: planned.spec.name,
        scope: planned.scope.scope.path,
        status: 'passed',
        fileCount: planned.files.length,
        duration: 0,
        findings: [],
    };
}

/**
 * The report of a finished run, which check --json prints.
 * @param input the session, the options, the plan, and what ran
 * @returns the report
 */
export function buildRunReport(input: ReportInput): RunReport {
    const { session, options, started, planned, ran, uses, fixes } = input;
    const results = ran;
    const failed = failedChecks(results, fixes);
    let code = failed.length > 0 ? EXIT_FINDINGS : 0;
    if (isIncomplete(session, results, fixes)) code = EXIT_ERROR;
    const report: RunReport = {
        ...(options.comparison === undefined ? {} : { comparison: options.comparison }),
        version: session.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks: results,
        ignores: uses
            .values()
            .map(({ entry, matched }) => ({
                check: entry.check,
                ...(entry.rule === undefined ? {} : { rule: entry.rule }),
                ...(entry.paths === undefined ? {} : { paths: entry.paths }),
                ...(entry.reason === undefined ? {} : { reason: entry.reason }),
                matched,
            }))
            .toArray(),
        skips: planned.flatMap((check): RunReport['skips'] => {
            if (check.skip !== undefined) return [{ check: check.spec.name, cause: check.skip.cause }];
            return input.active.includes(check) ? [] : [{ check: check.spec.name, cause: 'inputs' }];
        }),
        unstagedChanges: options.unstagedChanges ?? 0,
        partial: [options.staged, options.changed, options.paths].some((selection) => selection !== undefined),
        failed,
        exitCode: code,
    };
    return report;
}
