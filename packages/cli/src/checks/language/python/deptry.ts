// The dependency checks of a Python project: deptry over the declared imports, and one owner of the dependencies.
import { z } from 'zod';
import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { readText } from '#cli/platform/filesystem.ts';
import { readSource } from '#cli/repository/sources.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import type { Finding, CheckResult, EngineInput, PlannedCheck } from '#cli/types/execution/execution.ts';

import {
    PIP_INSTALL,
    INSTALL_HOLDERS,
    PYTHON_MANIFEST,
    REQUIREMENTS_FILE,
} from '#cli/config/checks/language/python.ts';

const dependencyConfiguration = z.object({
    tool: z
        .object({
            deptry: z.object({ extend_exclude: z.array(z.string()).default([]) }).default({ extend_exclude: [] }),
        })
        .default({ deptry: { extend_exclude: [] } }),
});

/**
 * Exclude private tool installations while preserving native dependency scan settings.
 * @param session the repository and native execution boundaries.
 * @param planned the dependency check and its scope.
 * @returns the native dependency findings, including undeclared application imports.
 */
export async function checkDependencies(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const text = readText(session.root, posix.join(planned.scope.scope.path, PYTHON_MANIFEST)) ?? '';
    const exclusions: string[] = dependencyConfiguration.parse(parse(text)).tool.deptry.extend_exclude;
    return await runToolCheck(session, planned, [
        'deptry',
        '.',
        '--no-ansi',
        ...[String.raw`(^|.*[/\\])\.gspot([/\\]|$)`, ...exclusions].flatMap((pattern) => ['--extend-exclude', pattern]),
    ]);
}

/**
 * pyproject.toml owns every dependency: no hand-kept requirements file, and no pip install outside the allowed paths.
 * @param input the engine input
 * @returns the findings
 */
export function dependencyOwnership(input: EngineInput): Finding[] {
    if (
        !['uv.lock', 'poetry.lock', 'pdm.lock'].some(
            (name) => statSync(join(input.root, input.scope, name), { throwIfNoEntry: false }) !== undefined,
        )
    )
        throw new GspotError(
            'skipped',
            'Dependency ownership requires uv.lock, poetry.lock, or pdm.lock in this scope.',
        );
    const allowed = (input.view.tool('pip')['installs_allowed'] as { paths: string[] }[] | undefined) ?? [];
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
        .filter((file) => !isAllowed(file.path) && INSTALL_HOLDERS.some((ending) => file.path.endsWith(ending)))
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
                                  'A pip install outside the lockfile installs versions nobody reviewed.',
                              ),
                          ]
                        : [],
                ),
        );
    return [...requirements, ...installs];
}
