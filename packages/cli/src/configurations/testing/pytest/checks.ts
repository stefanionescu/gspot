import { COVERAGE_INI_SECTION } from '#cli/config/configurations/python.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers.ts';
import { stripCoverageArguments } from '#cli/engine/plan.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { findText } from '#cli/system/files/reads.ts';
import { isTable } from '#cli/system/tables.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckResult, type CheckRunOptions, type CheckSession } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function hasProjectCoverage(session: Session, scopePath: string): boolean {
    if (findText(session.cache, joinScope(scopePath, '.coveragerc')) !== undefined) return true;
    const pyproject = findText(session.cache, joinScope(scopePath, PYPROJECT_TOML));
    const project =
        pyproject === undefined ? undefined : parseTomlFile(joinScope(scopePath, PYPROJECT_TOML), pyproject);
    if (isTable(project?.['tool']) && Object.hasOwn(project['tool'], 'coverage')) return true;
    return ['setup.cfg', 'tox.ini'].some((name) =>
        COVERAGE_INI_SECTION.test(findText(session.cache, joinScope(scopePath, name)) ?? ''),
    );
}

async function checkPytestTests(
    session: CheckSession,
    planned: PlannedCheck,
    options: Pick<CheckRunOptions, 'verbose' | 'command'> = {},
): Promise<CheckResult> {
    if (options.command !== undefined || !hasProjectCoverage(session, planned.scope.path))
        return runCommandCheck(session, planned, options);
    const command = (stripCoverageArguments(planned, options) as string[]).filter(
        (argument) => !argument.startsWith('--cov-config='),
    );
    return runCommandCheck(session, planned, { ...options, command });
}

export const PYTEST_CHECKS: Readonly<Record<string, CheckCode>> = {
    'pytest/tests': { run: checkPytestTests },
};
