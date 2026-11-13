import { DOCS_RULES, LICENSE_PATH, MISSING_LICENSE_MESSAGE, README_FILE } from '#cli/config/configurations/docs.ts';
import { LICENSE_FILE } from '#cli/config/repository/files.ts';
import { REQUIRED_FILE_EXPLANATIONS } from '#cli/configurations/general/docs/explanations.ts';
import { formatScope, joinScope } from '#cli/repository/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function checkRequiredFiles(session: Session, planned: PlannedCheck): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const repositoryPaths = new Set(session.repository.files.map(({ path }) => path));
    const readme = joinScope(planned.scope.path, README_FILE);
    if (!repositoryPaths.has(readme))
        findings.push({
            file: readme,
            rule: DOCS_RULES.missingReadme,
            message: `The scope ${formatScope(planned.scope.path)} has no README.md.`,
        });
    if (
        planned.scope.path === '' &&
        [...repositoryPaths].every((path) => path.includes('/') || !LICENSE_FILE.test(path))
    )
        findings.push({
            file: LICENSE_PATH,
            rule: DOCS_RULES.missingLicense,
            message: MISSING_LICENSE_MESSAGE,
        });
    return findings;
}

export const DOCS_REQUIRED_FILES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'docs/required-files': { check: checkRequiredFiles, explanations: REQUIRED_FILE_EXPLANATIONS },
};
