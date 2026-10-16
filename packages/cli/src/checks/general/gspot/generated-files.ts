import { listStaleFiles } from '#cli/apply/stale.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { generate } from '#cli/generation/generate.ts';
import { type CheckResult } from '#cli/types/checks/run/check.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { checkInput, buildBuiltInResult } from '#cli/checks/run/built-in.ts';
import { GENERATED_FILE_HELP, GENERATED_FILE_MESSAGES } from '#cli/config/checks/general/gspot.ts';

/**
 * Compare generated files with the settings output and report changes, missing files, conflicts, and stray outputs.
 * @param session the settings and repository to emit.
 * @param planned the repository-wide drift check.
 * @returns the check result with its generated-file findings.
 */
export function checkGeneratedFiles(session: Session, planned: PlannedCheck): CheckResult {
    const started = performance.now();
    const findings = listStaleFiles(session, generate(session)).map((entry) =>
        buildFinding(planned, { file: entry.path }, entry.kind, GENERATED_FILE_MESSAGES[entry.kind], {
            help: GENERATED_FILE_HELP[entry.kind],
        }),
    );
    return buildBuiltInResult(planned, { input: checkInput(session, planned), result: findings, started });
}
