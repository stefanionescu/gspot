import type { Session } from '#cli/types/session.ts';
import { listCheckedFiles } from '#cli/planning/files.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { INCOMPLETE_STATUSES } from '#cli/config/runs/report.ts';

/**
Starts a passed check result with the check ID, scope, and file count.

@param planned the check to run.
@param session the scopes of the run.
@returns a passed result with no findings.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 11 calls in 9 files share it.
export function buildBaseResult(planned: PlannedCheck, session: Pick<Session, 'scopes'>): CheckResult {
    return {
        check: planned.check.id,
        scope: planned.scope.path,
        status: 'passed',
        fileCount: listCheckedFiles(session.scopes, planned).length,
        duration: 0,
        findings: [],
    };
}

/**
Merge repeated runs of one check. Keep their findings and the base file count.

@param merged the results collected so far.
@param next the next run of the same check.
@returns the combined result, with a missing-tool or process failure when the next run stops.
*/
export function mergeCheckResults(merged: CheckResult, next: CheckResult): CheckResult {
    const isStopped = INCOMPLETE_STATUSES.has(next.status);
    const status = merged.status === 'failed' || next.status === 'failed' ? 'failed' : merged.status;
    return {
        ...merged,
        findings: [...merged.findings, ...next.findings],
        duration: merged.duration + next.duration,
        status: isStopped ? next.status : status,
        ...(isStopped && { note: next.note, command: next.command }),
    };
}
