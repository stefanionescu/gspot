import type { Session } from '#cli/types/session.ts';
import { buildBaseResult } from '#cli/runs/results.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import { readPushedCommits } from '#cli/repository/revisions/push.ts';

/**
List the commits a push sends: the planned ones, or the ones Git reports.

@param session the repository.
@param planned the check, with the commits of its plan.
@returns the commits, or the error result of a failed read.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The pushed checks share commit selection and its error result.
export async function listPushedCommits(session: Session, planned: PlannedCheck): Promise<string[] | CheckResult> {
    const commits = planned.commits ?? (await readPushedCommits(session.toolsRoot, session.cancelSignal));
    return Array.isArray(commits)
        ? commits
        : { ...buildBaseResult(planned, session), fileCount: 0, status: 'error', note: commits.error };
}

/**
Get the command of another check in the same shipped configuration.

@param planned the history check.
@param checkId the ID of the check whose command to read.
*/
export function getSiblingCommand(planned: PlannedCheck, checkId: string): string[] {
    const configuration = planned.configuration as NonNullable<PlannedCheck['configuration']>;
    const sibling = configuration.checks.find(({ id }) => id === checkId) as (typeof configuration.checks)[number];
    return sibling.command as string[];
}
