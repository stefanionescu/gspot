// The report a run ends with: every result, the ignores that matched, the skips, coverage, and the exit code.
import { writeReport } from '#cli/output/report.ts';
import { claimedInputs } from '#cli/execution/planning/plan.ts';
import { coverageReport } from '#cli/execution/coverage.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import type { CheckResult, Finding } from '#cli/types/checks/checks.ts';
import { suppressionComments } from '#cli/checks/repository/suppressions.ts';
import { FAILED_STATUSES, POLICY_CHECK, RAN_STATUSES, UNABLE_EXIT } from '#cli/constants/execution/execution.ts';

import type {
    ReportInput,
    RunReportOptions,
    FixReport,
    IgnoreUse,
    PlannedCheck,
    RunReport,
    Session,
} from '#cli/types/execution/execution.ts';

// How often each suppression form appears in the checked sources.
function census(session: Session, files: TrackedFile[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entry of suppressionComments(session.root, session.scopes, session.observations, files))
        counts[entry.form] = (counts[entry.form] ?? 0) + 1;
    return counts;
}

// One row per ignore entry with how many findings it matched.
function ignoreRows(uses: Map<string, IgnoreUse>): RunReport['ignores'] {
    return uses
        .values()
        .map(({ entry, matched }) => ({
            check: entry.check,
            ...(entry.rule === undefined ? {} : { rule: entry.rule }),
            ...(entry.paths === undefined ? {} : { paths: entry.paths }),
            ...(entry.reason === undefined ? {} : { reason: entry.reason }),
            matched,
        }))
        .toArray();
}

// One row per skipped check with what skipped it.
function skipRows(planned: PlannedCheck[]): RunReport['skips'] {
    return planned.flatMap((check) => (check.skip ? [{ check: check.check, source: check.skip.source }] : []));
}

// The wrong lines of gspot.toml that reading dropped, reported as one failed check so the rest of the run stands.
function policyProblemsResult(session: Session): CheckResult | undefined {
    const { problems } = session.policyFiles;
    if (problems.length === 0) return undefined;
    const findings = problems.map((problem) => ({
        check: POLICY_CHECK,
        engine: 'integrity',
        file: 'gspot.toml',
        line: problem.line,
        column: problem.column,
        message: problem.message,
        fixable: false,
    }));
    return { check: POLICY_CHECK, scope: '', status: 'fail', files: 1, duration: 0, findings };
}

// The checks that failed or could not run, and the fixers that failed, each named once.
function failedChecks(results: CheckResult[], fixes: FixReport | undefined): string[] {
    const checks = results.filter((result) => FAILED_STATUSES.has(result.status)).map((result) => result.check);
    const corrections = (fixes?.results ?? []).flatMap((result) => (result.status === 'failed' ? [result.check] : []));
    return [...new Set([...checks, ...corrections])];
}

// Whether the run could not answer: it was canceled, a check could not run, or a fixer failed.
function isUnable(session: Session, results: CheckResult[], fixes: FixReport | undefined): boolean {
    if (session.cancelSignal?.aborted === true) return true;
    if (results.some((result) => result.status === 'missing' || result.status === 'error')) return true;
    return fixes?.results.some((result) => result.status === 'failed') === true;
}

// The source paths the checks that ran claimed: what they reported checking, or what the plan gave them.
function claimedPaths(session: Session, active: PlannedCheck[], ran: CheckResult[]): Set<string> {
    const paths = active.flatMap((check, index) => {
        const outcome = ran[index];
        if (outcome === undefined || !RAN_STATUSES.has(outcome.status)) return [];
        if (outcome.checkedFiles !== undefined) return outcome.checkedFiles;
        return claimedInputs(session, check).map((file) => file.path);
    });
    return new Set(paths);
}

// One finding per supported source no check claims, when the policy demands strict coverage.
function coverageFindings(session: Session, options: RunReportOptions, unchecked: { path: string }[]): Finding[] {
    if (!session.policyFiles.policy.coverage.strict || options.stage === 'message') return [];
    return unchecked.map((entry) => ({
        check: 'coverage.strict',
        file: entry.path,
        message: 'No enabled check claims this supported source file.',
        help: 'Run gspot doctor to inspect coverage and enable a check for this file.',
        fixable: false,
    }));
}

// The exit code: 2 when the run could not answer, 1 when anything failed, otherwise 0.
function exitCode(unable: boolean, failed: string[], coverage: Finding[]): number {
    if (unable) return UNABLE_EXIT;
    if (failed.length > 0 || coverage.length > 0) return 1;
    return 0;
}

/**
 * The report of a finished run, written to .gspot/reports/report.json unless the run was a dry run or a message check.
 * @param input the session, the options, the plan, and what ran
 * @returns the report
 */
export function assembleReport(input: ReportInput): RunReport {
    const { session, options, started, planned, active, ran, uses, fixes } = input;
    const policyResult = options.stage === 'message' ? undefined : policyProblemsResult(session);
    if (policyResult !== undefined) options.onResult?.(policyResult);
    const results = policyResult === undefined ? ran : [...ran, policyResult];
    const claimed = claimedPaths(session, active, ran);
    const sources = session.repository.files.filter((file) => file.nature === 'source');
    const checkedSources = sources.filter((file) => claimed.has(file.path));
    const configured = coverageReport(session);
    const coverage = coverageFindings(session, options, configured.unchecked);
    const failed = failedChecks(results, fixes);
    const report: RunReport = {
        ...(options.comparison === undefined ? {} : { comparison: options.comparison }),
        version: session.version,
        stage: options.stage,
        started: started.toISOString(),
        duration: Date.now() - started.getTime(),
        checks: results,
        ignores: ignoreRows(uses),
        skips: skipRows(planned),
        coverage: { checked: checkedSources.length, unchecked: configured.unchecked.length, findings: coverage },
        suppressions: census(session, checkedSources),
        unstaged: 0,
        narrowed: [options.staged, options.changed, options.paths].some((selection) => selection !== undefined),
        failed,
        exitCode: exitCode(isUnable(session, results, fixes), failed, coverage),
    };
    if (!options.isDryRun && options.stage !== 'message') writeReport(session.root, report);
    return report;
}
