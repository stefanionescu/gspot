import { realpathSync } from 'node:fs';
import { join, posix } from 'node:path';

import { listOwnTestScopes, stripCoverageArguments } from '#cli/engine/plan.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckResult, CheckRunOptions, CheckSession } from '#cli/types/engine/run.ts';

const EXCLUDE_FLAG = '--exclude';

/**
Leave the nested scopes that run Vitest on their own out of this run, so that their tests run once. A project of a root
`test.projects` reads only an absolute pattern, and Vitest 2 only a relative one. Vitest 3 counts their files as
uncovered unless `coverage.all` is off, and `--coverage.exclude` drops its default excludes.

@param session the repository and its tools.
@param planned the Vitest check of one scope.
@param options the command override and the verbosity of the notes.
*/
async function runVitest(
    session: CheckSession,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    const nested = listOwnTestScopes(session, planned);
    if (nested.length === 0) return runCommandCheck(session, planned, options);
    const root = realpathSync(session.root);
    const excludes = nested.flatMap((path) => [
        EXCLUDE_FLAG,
        `${posix.relative(planned.scope.path, path)}/**`,
        EXCLUDE_FLAG,
        `${convertToPosixPath(join(root, path))}/**`,
    ]);
    const command = [...(stripCoverageArguments(planned, options) as string[]), ...excludes, '--coverage.all=false'];
    return runCommandCheck(session, planned, { ...options, command });
}

export const VITEST_CHECKS: Readonly<Record<string, CheckCode>> = {
    'vitest/tests': { run: runVitest },
};
