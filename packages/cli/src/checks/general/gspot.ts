import { emitAll } from '#cli/generation/outputs.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { emptyResult } from '#cli/execution/report.ts';
import type { CheckResult } from '#cli/types/execution/check.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { DRIFT_HELP, DRIFT_MESSAGES } from '#cli/config/checks/general/gspot.ts';

/**
 * Compare generated files with the policy output and report changes, missing files, conflicts, and stray outputs.
 * @param session the policy and repository to emit
 * @param planned the repository-wide drift check
 * @returns the check result with its generated-file findings
 */
export function gspotDrift(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    if (planned.check.runs !== 'once')
        throw new Error(
            'The gspot/drift check needs generated file comparisons, so its manifest must say runs = "once".',
        );
    const started = performance.now();
    const findings = computeDrift(session.root, session.policyFiles.policy, emitAll(session)).map((entry) => ({
        check: planned.check.name,
        file: entry.path,
        rule: entry.kind,
        message: DRIFT_MESSAGES[entry.kind],
        help: DRIFT_HELP[entry.kind],
        fixable: true,
    }));
    return Promise.resolve({
        ...emptyResult(planned),
        findings,
        status: findings.length > 0 ? 'failed' : 'passed',
        duration: performance.now() - started,
    });
}
