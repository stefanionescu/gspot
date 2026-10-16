import { buildBaseResult } from '#cli/checks/run/report.ts';
import type { CheckResult } from '#cli/types/checks/run/check.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { readPushedCommits } from '#cli/repository/revisions/push.ts';

/**
 * Start a repository history check, or keep its no-Git diagnostic.
 * @param session the repository to check.
 * @param planned the selected history check.
 * @returns the empty history result or its readiness refusal.
 */
function buildHistoryResult(session: Session, planned: PlannedCheck): CheckResult {
    const result = { ...buildBaseResult(planned, session), fileCount: 0 };
    return session.repository.hasGit
        ? result
        : {
              ...result,
              status: 'skipped',
              note: 'This folder is not a Git repository, so the check has no history to read.',
          };
}

/**
 * Keep findings from repeated history runs and the first missing-tool or execution error.
 * @param results the accumulated result and the next tool run.
 * @returns their findings and final status.
 */
function mergeRuns(results: [CheckResult, ...CheckResult[]]): CheckResult {
    const first = results[0];
    const stopped = results.find(({ status }) => status === 'missing' || status === 'error');
    return {
        ...(stopped ?? first),
        findings: results.flatMap(({ findings }) => findings),
        status: stopped?.status ?? (results.some(({ status }) => status === 'failed') ? 'failed' : first.status),
    };
}

/**
 * Run one check over each selected pushed commit and retain the first execution failure.
 * @param session the repository session.
 * @param planned the selected history check.
 * @param perCommit the operation to run for each selected commit.
 * @returns the accumulated history result.
 */
async function runOverPushedCommits(
    session: Session,
    planned: PlannedCheck,
    perCommit: (commit: string) => CheckResult | Promise<CheckResult>,
): Promise<CheckResult> {
    const started = performance.now();
    let result = buildHistoryResult(session, planned);
    if (result.status === 'skipped') return result;
    const commits = await readPushedCommits(session.root, planned.commits, session.cancelSignal);
    if (!Array.isArray(commits)) return { ...result, status: 'error', note: commits.error };
    for (const commit of commits) {
        result = mergeRuns([result, await perCommit(commit)]);
        if (result.status === 'missing' || result.status === 'error') break;
    }
    return { ...result, duration: performance.now() - started };
}

/**
 * Read the command of another check declared by the same shipped configuration.
 * @param planned the selected history check.
 * @param checkName the sibling check identifier.
 * @returns the sibling executable and authored arguments.
 */
function getSiblingCommand(planned: PlannedCheck, checkName: string): string[] {
    const manifest = planned.manifest as NonNullable<PlannedCheck['manifest']>;
    const sibling = manifest.checks.find(({ name }) => name === checkName) as (typeof manifest.checks)[number];
    return sibling.command as string[];
}

export { getSiblingCommand, buildHistoryResult, runOverPushedCommits };
