import { CheckStop } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/tools.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { readText } from '#cli/system/files/reads.ts';
import { type CheckCode } from '#cli/types/engine/run.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { REQUIREMENTS_FILE } from '#cli/config/repository/files.ts';
import { PIP_INSTALL_RULE_DOCS } from '#cli/config/configurations/rule-docs/language.ts';

import {
    PIP_INSTALL,
    PYTHON_RULES,
    NO_LOCKFILE_NOTE,
    PIP_INSTALL_MESSAGE,
    INSTALL_FILE_SUFFIXES,
    REQUIREMENTS_FOLDER_FILE,
    REQUIREMENTS_FILE_MESSAGE,
} from '#cli/config/configurations/python.ts';

/**
Reports hand-kept requirements files and unmanaged pip installs, so pyproject.toml owns every dependency.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
function checkPipInstalls(session: Session, planned: PlannedCheck): CheckFinding[] {
    if (
        (planned.check.files?.filenames ?? []).every((file) =>
            planned.files.every(({ path }) => path !== joinScope(planned.scope.path, file)),
        )
    )
        throw new CheckStop('skipped', NO_LOCKFILE_NOTE);
    const files = planned.files.filter((file) => file.kind === 'source');
    const requirements = files
        .filter((file) => REQUIREMENTS_FILE.test(file.path) || REQUIREMENTS_FOLDER_FILE.test(file.path))
        .map((file) => ({
            file: file.path,
            line: 1,
            rule: PYTHON_RULES.requirementsFile,
            message: REQUIREMENTS_FILE_MESSAGE,
        }));
    const installs = files
        .filter((file) => INSTALL_FILE_SUFFIXES.some((ending) => file.path.endsWith(ending)))
        .flatMap((file) =>
            readText(session.cache, file.path)
                .split('\n')
                .flatMap((text, index): CheckFinding[] =>
                    PIP_INSTALL.test(text) && !text.trimStart().startsWith('#')
                        ? [
                              {
                                  file: file.path,
                                  line: index + 1,
                                  rule: PYTHON_RULES.pipInstall,
                                  message: PIP_INSTALL_MESSAGE,
                              },
                          ]
                        : [],
                ),
        );
    return [...requirements, ...installs];
}

export const PYTHON_PIP_INSTALLS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'python/pip-installs': { check: checkPipInstalls, ruleDocs: PIP_INSTALL_RULE_DOCS },
};
