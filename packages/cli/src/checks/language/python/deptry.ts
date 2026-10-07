// The dependency checks of a Python project: deptry over the declared imports, and one owner of the dependencies.

import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { escapeRegExp } from '#cli/platform/text.ts';
import { findingAt } from '#cli/execution/finding.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { readText, readSource } from '#cli/platform/source.ts';
import type { PathAllowance } from '#cli/types/policy/settings.ts';
import { runCommandCheck } from '#cli/execution/command/runner.ts';
import { deptrySchema } from '#cli/parsers/schema/python/dependencies.ts';
import type { CheckResult, EngineInput } from '#cli/types/execution/check.ts';

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
    return await runCommandCheck(session, planned, {
        command: [
            'deptry',
            '.',
            '--no-ansi',
            ...[String.raw`(^|.*[/\\])${escapeRegExp(DOT_GSPOT)}([/\\]|$)`, ...exclusions].flatMap((pattern) => [
                '--extend-exclude',
                pattern,
            ]),
        ],
    });
}

/**
 * pyproject.toml owns every dependency: no hand-kept requirements file, and no pip install outside the allowed paths.
 * @param input the engine input
 * @returns the findings
 */
export function pipInstalls(input: EngineInput): Finding[] {
    if (
        !['uv.lock', 'poetry.lock', 'pdm.lock'].some(
            (name) => statSync(join(input.root, input.scope, name), { throwIfNoEntry: false }) !== undefined,
        )
    )
        throw new GspotError('skip', 'Dependency ownership requires uv.lock, poetry.lock, or pdm.lock in this scope.');
    const allowed = (input.view.options('tools.pip')['installs_allowed'] as PathAllowance[] | undefined) ?? [];
    const isAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const files = input.files.filter(
        (file) => file.kind === 'source' && scopeOf(file.path, input.scopeEntries).path === input.scope,
    );
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
        .filter((file) => !isAllowed(file.path) && INSTALL_EXTENSIONS.some((ending) => file.path.endsWith(ending)))
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
