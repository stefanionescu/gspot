import {
    INSTALL_FILE_SUFFIXES,
    NO_LOCKFILE_NOTE,
    PIP_INSTALL,
    PIP_INSTALL_MESSAGE,
    PYTHON_RULES,
    REQUIREMENTS_FILE_MESSAGE,
    REQUIREMENTS_FOLDER_FILE,
} from '#cli/config/configurations/python.ts';
import { REQUIREMENTS_FILE } from '#cli/config/repository/files.ts';
import { PIP_INSTALL_EXPLANATIONS } from '#cli/configurations/language/python/explanations.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { readText } from '#cli/system/files/reads.ts';
import { listMatchingLines } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { type CheckCode, type CheckFinding } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

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
            listMatchingLines(
                readText(session.cache, file.path),
                (text) => PIP_INSTALL.test(text) && !text.trimStart().startsWith('#'),
            ).map((line) => ({
                file: file.path,
                line,
                rule: PYTHON_RULES.pipInstall,
                message: PIP_INSTALL_MESSAGE,
            })),
        );
    return [...requirements, ...installs];
}

export const PYTHON_PIP_INSTALLS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'python/pip-installs': { check: checkPipInstalls, explanations: PIP_INSTALL_EXPLANATIONS },
};
