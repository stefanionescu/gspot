import { posix } from 'node:path';

import { listOwnTestScopes, stripCoverageArguments } from '#cli/engine/plan.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { escapeRegExp } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckResult, CheckRunOptions, CheckSession } from '#cli/types/engine/run.ts';

/**
Leave the nested scopes that run Jest on their own out of this run, so that their tests run once. A test path pattern
leaves `testPathIgnorePatterns` of the project in place, which the flag of that name replaces. Jest 30 matches it
against the path from `rootDir`, and an older Jest against the absolute path. With those tests gone, the scope may hold
none.

@param session the repository and its tools.
@param planned the Jest check of one scope.
@param options the command override and the verbosity of the notes.
*/
async function runJest(
    session: CheckSession,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    const nested = listOwnTestScopes(session, planned);
    if (nested.length === 0) return runCommandCheck(session, planned, options);
    const paths = nested.map((path) => escapeRegExp(posix.relative(planned.scope.path, path)));
    const command = [
        ...(stripCoverageArguments(planned, options) as string[]),
        '--passWithNoTests',
        `^(?!(?:.*/)?(?:${paths.join('|')})/)`,
    ];
    return runCommandCheck(session, planned, { ...options, command });
}

export const JEST_CHECKS: Readonly<Record<string, CheckCode>> = {
    'jest/tests': { run: runJest },
};
