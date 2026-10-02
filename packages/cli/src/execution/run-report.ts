// The report a run ends with: every result, the ignores that matched, the skips, and the exit code.
import { problemText } from '#cli/policy/read.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { EXIT_ERROR, EXIT_FINDINGS } from '#cli/config/platform/platform.ts';
import { POLICY_CHECK, FAILED_STATUSES } from '#cli/config/execution/execution.ts';
import type { FixReport, RunReport, CheckResult, ReportInput } from '#cli/types/execution/execution.ts';

// The wrong lines of gspot.toml that reading dropped, reported as one failed check so the rest of the run stands.
function policyProblemsResult(session: Session): CheckResult | undefined {
    const { problems } = session.policyFiles;
    if (problems.length === 0) return undefined;
    const findings = problems.map((problem) => ({
        check: POLICY_CHECK,
        file: 'gspot.toml',
        message: problemText(problem),
        fixable: false,
    }));
    return { check: POLICY_CHECK, scope: '', status: 'failed', fileCount: 1, duration: 0, findings };
}

// Name each failed or unavailable check and failed fixer once.
function failedChecks(results: CheckResult[], fixes: FixReport | undefined): string[] {
    const checks = results.filter((result) => FAILED_STATUSES.has(result.status)).map((result) => result.check);
    const corrections = (fixes?.results ?? []).flatMap((result) => (result.status === 'failed' ? [result.check] : []));
    return [...new Set([...checks, ...corrections])];
}

// Identify incomplete runs caused by cancellation, unavailable checks, or failed fixers.
function isUnable(session: Session, results: CheckResult[], fixes: FixReport | undefined): boolean {
    if (session.cancelSignal?.aborted === true) return true;
    if (results.some((result) => result.status === 'missing' || result.status === 'error')) return true;
    return fixes?.results.some((result) => result.status === 'failed') === true;
}

// Return 2 for an incomplete run, 1 for findings, and 0 for a successful run.
function exitCode(unable: boolean, failed: string[]): number {
    if (unable) return EXIT_ERROR;
    return failed.length > 0 ? EXIT_FINDINGS : 0;
}

/**
 * The report of a finished run, which check --json prints.
 * @param input the session, the options, the plan, and what ran
 * @returns the report
 */
export function assembleReport(input: ReportInput): RunReport {
    const { session, options, started, planned, ran, uses, fixes } = input;
    const policyResult = options.stage === 'message' ? undefined : policyProblemsResult(session);
    if (policyResult !== undefined) options.onResult?.(policyResult);
    const results = policyResult === undefined ? ran : [...ran, policyResult];
    const failed = failedChecks(results, fixes);
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
        skips: planned.flatMap((check) => (check.skip ? [{ check: check.check, source: check.skip.source }] : [])),
        unstaged: 0,
        narrowed: [options.staged, options.changed, options.paths].some((selection) => selection !== undefined),
        failed,
        exitCode: exitCode(isUnable(session, results, fixes), failed),
    };
    return report;
}
