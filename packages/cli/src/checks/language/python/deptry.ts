// The dependency checks of a Python project: deptry over the declared imports, and one owner of the dependencies.

import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { GspotError } from '#cli/platform/public.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import { pythonProjectCommand } from '#cli/tools/python/public.ts';
import { readText, readSource } from '#cli/platform/root/public.ts';
import { deptrySchema } from '#cli/parsers/schema/python/dependencies.ts';
import type { CheckInput, CheckResult } from '#cli/types/execution/check.ts';

import {
    PIP_INSTALL,
    PYTHON_MANIFEST,
    REQUIREMENTS_FILE,
    INSTALL_EXTENSIONS,
} from '#cli/config/checks/language/python.ts';

/**
 * Runs deptry on the scope. Passes the project's extend_exclude list again with .gspot added, because the command-line flag replaces it.
 * @param session the repository and installed tools.
 * @param planned the dependency check and its scope.
 * @returns the native dependency findings, including undeclared application imports.
 */
export async function deptry(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const text = readText(session.root, posix.join(planned.scope.scope.path, PYTHON_MANIFEST));
    if (text === undefined) throw new GspotError('skip', 'This scope has no pyproject.toml for deptry to read.');
    const exclusions: string[] = deptrySchema.parse(parse(text)).tool.deptry.extend_exclude;
    return await runCheckCommand(session, planned, {
        command: pythonProjectCommand(planned.scope, join(session.root, planned.scope.scope.path), [
            'deptry',
            '.',
            '--no-ansi',
            ...[String.raw`(^|.*[/\\])${RegExp.escape(DOT_GSPOT)}([/\\]|$)`, ...exclusions].flatMap((pattern) => [
                '--extend-exclude',
                pattern,
            ]),
        ]),
    });
}

/**
 * pyproject.toml owns every dependency: no hand-kept requirements file, and no unmanaged pip install.
 * @param input the check input
 * @returns the findings
 */
export function pipInstalls(input: CheckInput): Finding[] {
    if (
        !LOCKFILES.some(
            ({ client, file }) =>
                ['uv', 'poetry', 'pdm'].includes(client) &&
                statSync(join(input.root, input.scope, file), { throwIfNoEntry: false }) !== undefined,
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
