import { findingAt } from '#cli/checks/finding.ts';
import { emitAll } from '#cli/generation/files.ts';
import { findStaleFiles } from '#cli/apply/stale.ts';
import { emptyResult } from '#cli/execution/report.ts';
import { type CheckResult } from '#cli/types/execution/check.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { GENERATED_FILE_HELP, GENERATED_FILE_MESSAGES } from '#cli/config/checks/general/gspot.ts';

/**
 * Compare generated files with the settings output and report changes, missing files, conflicts, and stray outputs.
 * @param session the settings and repository to emit.
 * @param planned the repository-wide drift check.
 * @returns the check result with its generated-file findings.
 */
export function generatedFiles(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const findings = findStaleFiles(session, emitAll(session)).map((entry) =>
        findingAt(planned, { file: entry.path }, entry.kind, GENERATED_FILE_MESSAGES[entry.kind], {
            help: GENERATED_FILE_HELP[entry.kind],
            fixable: true,
        }),
    );
    return Promise.resolve({
        ...emptyResult(planned),
        findings,
        status: findings.length > 0 ? 'failed' : 'passed',
        duration: performance.now() - started,
    });
}
