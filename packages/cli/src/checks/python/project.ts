import { z } from 'zod';
import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { scopeOf } from '#cli/repository/scopes.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { runToolCheck, runCheckCommand } from '#cli/execution/tool/runner.ts';
import type { Session, PlannedCheck } from '#cli/types/execution/execution.ts';
import type { Finding, CheckResult, EngineInput } from '#cli/types/checks/checks.ts';

import {
    PIP_INSTALL,
    BROKEN_CONTRACT,
    INSTALL_HOLDERS,
    PYTHON_MANIFEST,
    REQUIREMENTS_FILE,
} from '#cli/config/checks/python.ts';

const importConfiguration = z.object({
    tool: z.object({ importlinter: z.record(z.string(), z.unknown()).optional() }).optional(),
});
const dependencyConfiguration = z.object({
    tool: z
        .object({
            deptry: z.object({ extend_exclude: z.array(z.string()).default([]) }).default({ extend_exclude: [] }),
        })
        .default({ deptry: { extend_exclude: [] } }),
});
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Four checks build the finding record; one owner keeps its shape.
function finding(input: EngineInput, at: { file: string; line: number }, rule: string, text: string): Finding {
    return { check: input.spec.name, file: at.file, line: at.line, rule, message: text, fixable: false };
}

/**
 * Exclude private tool installations while preserving native dependency scan settings.
 * @param session the repository and native execution boundaries.
 * @param planned the dependency check and its scope.
 * @returns the native dependency findings, including undeclared application imports.
 */
export async function checkDependencies(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const files = openRoot(session.root);
    let exclusions: string[];
    try {
        const project = files.read(posix.join(planned.scope.scope.path, PYTHON_MANIFEST));
        const text = project === undefined ? '' : new TextDecoder('utf-8', { fatal: true }).decode(project.bytes);
        exclusions = dependencyConfiguration.parse(parse(text)).tool.deptry.extend_exclude;
    } finally {
        files.close();
    }
    return runToolCheck(session, planned, [
        'deptry',
        '.',
        '--no-ansi',
        ...[String.raw`(^|.*[/\\])\.gspot([/\\]|$)`, ...exclusions].flatMap((pattern) => ['--extend-exclude', pattern]),
    ]);
}

/**
 * Runs the import contracts of the scope. A project with no [tool.importlinter] table has none to run.
 * @param input the engine input
 * @returns one finding for each broken contract
 */
export async function importLinter(input: EngineInput): Promise<Finding[]> {
    const manifest = input.scope === '' ? PYTHON_MANIFEST : `${input.scope}/${PYTHON_MANIFEST}`;
    if (statSync(join(input.root, manifest), { throwIfNoEntry: false }) === undefined)
        throw new GspotError('skipped', 'This scope has no pyproject.toml import contracts.');
    const project = importConfiguration.parse(parse(readSource(input.root, manifest, input.reads).toString('utf8')));
    if (project.tool?.importlinter === undefined)
        throw new GspotError('skipped', 'This scope has no tool.importlinter configuration.');
    const result = await runCheckCommand(input, ['lint-imports', '--no-cache'], {
        cwd: join(input.root, input.scope),
    });
    const broken = result.stdout.split('\n').flatMap((line) => {
        const name = BROKEN_CONTRACT.exec(line.trim())?.groups?.['name'];
        return name === undefined ? [] : [name];
    });
    const said = [result.stderr, result.stdout].join('').trim().split('\n').at(-1) ?? '';
    if (result.code !== 0 && broken.length === 0) throw new Error(`The lint-imports command failed: ${said}`);
    const at = { file: manifest, line: 1 };
    return broken.map((name) =>
        finding(input, at, 'contract', `The import contract "${name}" is broken; lint-imports prints the chain.`),
    );
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
    const allowed = (input.view.tool('dependencies')['pip_install_allowed'] as { paths: string[] }[] | undefined) ?? [];
    const isAllowed = pathMatcher(allowed.flatMap((entry) => entry.paths));
    const files = input.files.filter(
        (file) => file.kind === 'source' && scopeOf(file.path, input.scopeEntries).path === input.scope,
    );
    const requirements = files
        .filter((file) => REQUIREMENTS_FILE.test(file.path))
        .map((file) =>
            finding(
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
                              finding(
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

/**
 * Every path the type check leaves out still exists, so the list of exclusions never outlives its files.
 * @param input the engine input
 * @returns one finding for each exclusion that matches no tracked file
 */
export function typecheckMembership(input: EngineInput): Finding[] {
    const excluded = (input.view.tool('basedpyright')['exclude'] as { paths: string[] }[] | undefined) ?? [];
    const paths = input.files.map((file) => file.path);
    const stale = excluded
        .flatMap((entry) => entry.paths)
        .filter((pattern) => {
            const isMatch = pathMatcher([pattern, `${pattern}/**`]);
            return paths.every((path) => !isMatch(path));
        });
    return stale.map((pattern) =>
        finding(
            input,
            { file: 'gspot.toml', line: 1 },
            'stale-exclusion',
            `tools.basedpyright.exclude names ${pattern}, which matches no tracked file.`,
        ),
    );
}
