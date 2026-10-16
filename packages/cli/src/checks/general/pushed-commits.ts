import { emptyResult } from '#cli/execution/report.ts';
import type { CheckResult } from '#cli/types/execution/check.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';

/**
 * Start a repository history check, or keep its no-Git diagnostic.
 * @param session the repository to check.
 * @param planned the selected history check.
 * @param note the diagnostic when the repository has no Git history.
 * @returns the empty history result or its readiness refusal.
 */
export function historyResult(session: Session, planned: PlannedCheck, note: string): CheckResult {
    const result = { ...emptyResult(planned), fileCount: 0 };
    return session.repository.hasGit ? result : { ...result, status: 'skipped', note };
}

/**
 * Keep findings from repeated history runs and the first missing-tool or execution error.
 * @param results the accumulated result and the next tool run.
 * @returns their findings and final status.
 */
export function mergeRuns(results: [CheckResult, ...CheckResult[]]): CheckResult {
    const first = results[0];
    const stopped = results.find(({ status }) => status === 'missing' || status === 'error');
    return {
        ...(stopped ?? first),
        findings: results.flatMap(({ findings }) => findings),
        status: stopped?.status ?? (results.some(({ status }) => status === 'failed') ? 'failed' : first.status),
    };
}
