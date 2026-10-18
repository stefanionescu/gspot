import { join } from 'node:path';
import { statSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { type Finding, type CheckInput } from '#cli/types/runs/check.ts';
import { REQUIREMENTS_FILE } from '#cli/config/parsers/dependency-files.ts';
import { PIP_INSTALL, INSTALL_EXTENSIONS } from '#cli/config/checks/python.ts';

/**
 * Reports hand-kept requirements files and unmanaged pip installs, so pyproject.toml owns every dependency.
 * @param input the scope files to read.
 * @returns the findings.
 */
export function checkPythonPipInstalls(input: CheckInput): Finding[] {
    if (
        !(input.check.files?.filenames ?? []).some(
            (file) =>
                statSync(join(input.root, input.selection.scope.path, file), { throwIfNoEntry: false }) !== undefined,
        )
    )
        throw new GspotError('skip', 'Dependency ownership requires uv.lock, poetry.lock, or pdm.lock in this scope.');
    const files = input.files.filter((file) => file.kind === 'source');
    const requirements = files
        .filter((file) => REQUIREMENTS_FILE.test(file.path))
        .map((file) =>
            buildFinding(
                input,
                { file: file.path, line: 1 },
                'requirements-file',
                'A hand-kept requirements file is a second owner of the dependencies. Export it from the lockfile and declare it generated, or delete it.',
            ),
        );
    const installs = files
        .filter((file) => INSTALL_EXTENSIONS.some((ending) => file.path.endsWith(ending)))
        .flatMap((file) =>
            readCachedBytes(input.reads, file.path)
                .toString('utf8')
                .split('\n')
                .flatMap((text, index): Finding[] =>
                    PIP_INSTALL.test(text) && !text.trimStart().startsWith('#')
                        ? [
                              buildFinding(
                                  input,
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
