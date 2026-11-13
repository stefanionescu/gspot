import { COVERAGE_INI_SECTION } from '#cli/config/configurations/python.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects.ts';
import { selectCheckCommand } from '#cli/engine/plan/coverage.ts';
import { runCommandCheck } from '#cli/engine/run/tool-runs/check.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { findText } from '#cli/system/files/reads.ts';
import { isTable } from '#cli/system/tables.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckResult, CheckRunOptions, CheckSession } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function hasProjectCoverage(session: Session, scopePath: string): boolean {
    if (findText(session.cache, joinScope(scopePath, '.coveragerc')) !== undefined) return true;
    const pyprojectPath = joinScope(scopePath, PYPROJECT_TOML);
    const pyproject = findText(session.cache, pyprojectPath);
    const project = pyproject === undefined ? undefined : parseTomlFile(pyprojectPath, pyproject);
    if (isTable(project?.['tool']) && Object.hasOwn(project['tool'], 'coverage')) return true;
    return ['setup.cfg', 'tox.ini'].some((name) =>
        COVERAGE_INI_SECTION.test(findText(session.cache, joinScope(scopePath, name)) ?? ''),
    );
}

async function checkPytestTests(
    session: CheckSession,
    planned: PlannedCheck,
    options: Pick<CheckRunOptions, 'verbose' | 'command'>,
): Promise<CheckResult> {
    if (options.command !== undefined || !hasProjectCoverage(session, planned.scope.path))
        return runCommandCheck(session, planned, options);
    const command = (selectCheckCommand(planned, options) as string[]).filter(
        (argument) => !argument.startsWith('--cov-config='),
    );
    return runCommandCheck(session, planned, { ...options, command });
}

export const PYTEST_CHECKS: Readonly<Record<string, CheckCode>> = {
    'pytest/tests': { run: checkPytestTests },
};
