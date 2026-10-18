import { buildBaseResult } from '#cli/runs/report.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { readPushedCommits } from '#cli/repository/revisions/push.ts';

/**
 * Starts a history check result, or skips the check outside a Git repository.
 * @param session the repository to check.
 * @param planned the history check.
 * @returns the empty result, or a skipped result.
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
 * Merges the findings of history runs and keeps the first missing-tool or run error.
 * @param results the merged run so far and the next run.
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
 * Runs a check on each pushed commit and stops at the first missing tool or run error.
 * @param session the repository and its tools.
 * @param planned the history check.
 * @param perCommit the check to run on one commit.
 * @returns the merged result.
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
 * Reads the command of another check in the same shipped configuration.
 * @param planned the history check.
 * @param checkName the sibling ID.
 * @returns the executable and its arguments.
 */
function getSiblingCommand(planned: PlannedCheck, checkName: string): string[] {
    const manifest = planned.manifest as NonNullable<PlannedCheck['manifest']>;
    const sibling = manifest.checks.find(({ name }) => name === checkName) as (typeof manifest.checks)[number];
    return sibling.command as string[];
}

export { getSiblingCommand, buildHistoryResult, runOverPushedCommits };
