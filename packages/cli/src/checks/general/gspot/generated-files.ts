import { buildFinding } from '#cli/runs/finding.ts';
import { type Session } from '#cli/types/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { listStaleFiles } from '#cli/apply/stale-files.ts';
import { buildBuiltInResult } from '#cli/runs/built-in.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { GENERATED_FILE_FINDINGS } from '#cli/config/checks/general/gspot/generated-files.ts';

/**
 * Reports each generated file on disk that does not match what the settings generate.
 *
 * @param session the settings and repository.
 * @param planned the repository-wide drift check.
 * @returns the check result.
 */
export function checkGspotGeneratedFiles(session: Session, planned: PlannedCheck): CheckResult {
    const started = performance.now();
    const findings = listStaleFiles(session, generate(session)).map((entry) =>
        buildFinding(planned, { file: entry.path }, entry.kind, GENERATED_FILE_FINDINGS[entry.kind].message, {
            help: GENERATED_FILE_FINDINGS[entry.kind].help,
        }),
    );
    return buildBuiltInResult(planned, session, { result: findings, started });
}
