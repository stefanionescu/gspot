import type { Session } from '#cli/types/session.ts';
import { RAN_STATUSES } from '#cli/config/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { readPushedCommits } from '#cli/repository/revisions/push.ts';
import { buildBaseResult, mergeCheckResults } from '#cli/runs/report.ts';

/**
Runs a check on each pushed commit and stops at the first missing tool or run error.

@param session the repository and its tools.
@param planned the history check.
@param perCommit the check to run on one commit.
@returns the merged result.
*/
export async function runOverPushedCommits(
    session: Session,
    planned: PlannedCheck,
    perCommit: (commit: string) => CheckResult | Promise<CheckResult>,
): Promise<CheckResult> {
    let result = { ...buildBaseResult(planned, session), fileCount: 0 };
    const commits = await readPushedCommits(session.root, planned.commits, session.cancelSignal);
    if (!Array.isArray(commits)) return { ...result, status: 'error', note: commits.error };
    for (const commit of commits) {
        result = mergeCheckResults(result, await perCommit(commit));
        if (!RAN_STATUSES.has(result.status)) break;
    }
    return result;
}

/**
Get the command of another check in the same shipped configuration.

@param planned the history check.
@param checkId the ID of the check whose command to read.
@returns the executable and its arguments.
*/
export function getSiblingCommand(planned: PlannedCheck, checkId: string): string[] {
    const configuration = planned.configuration as NonNullable<PlannedCheck['configuration']>;
    const sibling = configuration.checks.find(({ id }) => id === checkId) as (typeof configuration.checks)[number];
    return sibling.command as string[];
}
