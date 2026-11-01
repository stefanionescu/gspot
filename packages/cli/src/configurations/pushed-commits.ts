import type { Session } from '#cli/types/tools.ts';
import { buildBaseResult } from '#cli/engine/results.ts';
import type { CheckResult } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
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
