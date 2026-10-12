import { join } from 'node:path';
import { statSync } from 'node:fs';
import { GspotError } from '#cli/errors.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/system/file-reads.ts';
import { REQUIREMENTS_FILE } from '#cli/config/parsers/dependency-files.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { PIP_INSTALL, INSTALL_EXTENSIONS } from '#cli/config/checks/language/python.ts';

/**
 * pyproject.toml owns every dependency: no hand-kept requirements file, and no unmanaged pip install.
 * @param input the check input.
 * @returns the findings.
 */
export function pythonPipInstalls(input: CheckInput): Finding[] {
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
            findingAt(
                input,
                { file: file.path, line: 1 },
                'requirements-file',
                'A hand-kept requirements file is a second owner of the dependencies. Export it from the lockfile and declare it generated, or delete it.',
            ),
        );
    const installs = files
        .filter((file) => INSTALL_EXTENSIONS.some((ending) => file.path.endsWith(ending)))
        .flatMap((file) =>
            readSource(input.root, file.path, input.reads)
                .toString('utf8')
                .split('\n')
                .flatMap((text, index): Finding[] =>
                    PIP_INSTALL.test(text) && !text.trimStart().startsWith('#')
                        ? [
                              findingAt(
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
