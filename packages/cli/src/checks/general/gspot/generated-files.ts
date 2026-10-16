import { findingAt } from '#cli/checks/finding.ts';
import { findStaleFiles } from '#cli/apply/stale.ts';
import { generate } from '#cli/generation/generate.ts';
import { type CheckResult } from '#cli/types/execution/check.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { checkInput, buildCheckResult } from '#cli/execution/built-in.ts';
import { GENERATED_FILE_HELP, GENERATED_FILE_MESSAGES } from '#cli/config/checks/general/gspot.ts';

/**
 * Compare generated files with the settings output and report changes, missing files, conflicts, and stray outputs.
 * @param session the settings and repository to emit.
 * @param planned the repository-wide drift check.
 * @returns the check result with its generated-file findings.
 */
export function generatedFiles(session: Session, planned: PlannedCheck): CheckResult {
    const started = performance.now();
    const findings = findStaleFiles(session, generate(session)).map((entry) =>
        findingAt(planned, { file: entry.path }, entry.kind, GENERATED_FILE_MESSAGES[entry.kind], {
            help: GENERATED_FILE_HELP[entry.kind],
        }),
    );
    return buildCheckResult(planned, { input: checkInput(session, planned), outcome: findings, started });
}
