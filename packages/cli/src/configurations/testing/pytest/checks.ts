import { isTable } from '#cli/system/tables.ts';
import { find } from '#cli/system/files/reads.ts';
import type { Session } from '#cli/types/tools.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers.ts';
import { stripCoverageArguments } from '#cli/engine/plan.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { COVERAGE_INI_SECTION } from '#cli/config/configurations/python.ts';
import type { CheckResult, CheckSession, CheckRunOptions } from '#cli/types/engine/run.ts';

function hasProjectCoverage(session: Session, scope: string): boolean {
    if (find(session.cache, joinScope(scope, '.coveragerc')) !== undefined) return true;
    const pyproject = find(session.cache, joinScope(scope, PYPROJECT_TOML));
    const project = pyproject === undefined ? undefined : parseTomlFile(joinScope(scope, PYPROJECT_TOML), pyproject);
    if (isTable(project?.['tool']) && Object.hasOwn(project['tool'], 'coverage')) return true;
    return ['setup.cfg', 'tox.ini'].some((name) =>
        COVERAGE_INI_SECTION.test(find(session.cache, joinScope(scope, name)) ?? ''),
    );
}

/**
Runs pytest, and leaves the shipped coverage settings out when the project writes its own.

@param session the repository and its tools.
@param planned the coverage check of one scope.
@param options the command override and the verbosity of the notes.
*/
export async function checkPytestCoverage(
    session: CheckSession,
    planned: PlannedCheck,
    options: CheckRunOptions = {},
): Promise<CheckResult> {
    if (options.command !== undefined || !hasProjectCoverage(session, planned.scope.path))
        return runCommandCheck(session, planned, options);
    const command = (stripCoverageArguments(planned, options) as string[]).filter(
        (argument) => !argument.startsWith('--cov-config='),
    );
    return runCommandCheck(session, planned, { ...options, command });
}
