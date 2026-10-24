import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { REQUIREMENTS_FILE } from '#cli/config/files/names.ts';
import { PIP_INSTALL, INSTALL_FILE_SUFFIXES } from '#cli/config/checks/language/python/pip-installs.ts';

/**
Reports hand-kept requirements files and unmanaged pip installs, so pyproject.toml owns every dependency.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
*/
export function checkPythonPipInstalls(session: Session, planned: PlannedCheck): Finding[] {
    if (
        !(planned.check.files?.filenames ?? []).some((file) =>
            planned.files.some(({ path }) => path === joinScope(planned.scope.folder.path, file)),
        )
    )
        throw new GspotError('skip', 'This check needs uv.lock, poetry.lock, or pdm.lock in this scope.');
    const files = planned.files.filter((file) => file.kind === 'source');
    const requirements = files
        .filter((file) => REQUIREMENTS_FILE.test(file.path))
        .map((file) =>
            buildFinding(
                planned,
                { file: file.path, line: 1 },
                'requirements-file',
                'A hand-kept requirements file is a second owner of the dependencies. Export it from the lockfile and declare it generated, or delete it.',
            ),
        );
    const installs = files
        .filter((file) => INSTALL_FILE_SUFFIXES.some((ending) => file.path.endsWith(ending)))
        .flatMap((file) =>
            readCachedText(session.reads, file.path)
                .split('\n')
                .flatMap((text, index): Finding[] =>
                    PIP_INSTALL.test(text) && !text.trimStart().startsWith('#')
                        ? [
                              buildFinding(
                                  planned,
                                  { file: file.path, line: index + 1 },
                                  'pip-install',
                                  'Add the package to pyproject.toml and install it from the lockfile.',
                              ),
                          ]
                        : [],
                ),
        );
    return [...requirements, ...installs];
}
