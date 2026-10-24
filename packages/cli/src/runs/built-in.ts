import type { Session } from '#cli/types/session.ts';
import { buildBaseResult } from '#cli/runs/report.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding, CheckResult, BuiltInCheck, BuiltInCheckResult } from '#cli/types/runs/check.ts';

function buildBuiltInResult(
    planned: PlannedCheck,
    session: Pick<Session, 'scopes'>,
    completion: { result: Finding[] | BuiltInCheckResult; started: number },
): CheckResult {
    const { result, started } = completion;
    let findings: Finding[];
    let files: string[] | undefined;
    if (Array.isArray(result)) findings = result;
    else {
        findings = result.findings;
        files = [...new Set(result.files)];
    }
    for (const finding of findings) finding.help ??= planned.check.help;
    return {
        ...buildBaseResult(planned, session),
        findings,
        ...(files === undefined ? {} : { files, fileCount: files.length }),
        status: findings.length > 0 ? 'failed' : 'passed',
        duration: performance.now() - started,
    };
}

/**
Run a built-in check and build its result.

@param builtInCheck the implementation to run.
@param session the repository and its tools.
@param planned the check to run.
@returns the check result.
*/
export async function runBuiltInCheck(
    builtInCheck: BuiltInCheck,
    session: Session,
    planned: PlannedCheck,
): Promise<CheckResult> {
    const started = performance.now();
    const result = await builtInCheck(session, planned);
    return buildBuiltInResult(planned, session, { result, started });
}
