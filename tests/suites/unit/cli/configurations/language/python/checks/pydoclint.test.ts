import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { createFileTree } from 'testdirs';
import { getTool } from '#cli/tools/pins.ts';
import { test, spyOn, expect } from 'bun:test';
import { planChecks } from '#cli/engine/plan.ts';
import type { Session } from '#cli/types/tools.ts';
import type { Level } from '#cli/types/settings.ts';
import { openSession } from '#cli/engine/session.ts';
import * as processes from '#cli/system/processes.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { PYPROJECT } from '#tests/config/setup/languages.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { EXECUTABLE_FILE } from '#cli/config/repository/files.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCheckCode, buildCheckSession } from '#cli/engine/run.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildVenvExecutablePath } from '#tests/setup/system/programs.ts';
import { CHECK_GENERATION, createRunResources } from '#tests/setup/cli/run.ts';

import {
    FAILED_STYLE_BATCH,
    NUMPY_DOCSTRING_MODULE,
    GOOGLE_DOCSTRING_MODULE,
    PYDOCLINT_PROJECT_CASES,
} from '#tests/config/configurations/python.ts';

test.each([...PYDOCLINT_PROJECT_CASES])('pydoclint $name', async ({ project, setting, expected }) => {
    await using sandbox = await createGitSandbox({});
    using prepared = await preparePydoclintCheck(
        sandbox.path,
        { 'pyproject.toml': project, 'source.py': 'value = 1\n' },
        { tables: setting === undefined ? '' : `[python]\ndocstring_convention = "${setting}"\n` },
    );
    const { session, planned } = prepared;
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult());
    const result = await runCheckCode(
        buildCheckSession(session, CHECK_GENERATION),
        planned,
        CHECK_CODE['python/pydoclint'],
        {},
    );
    expect(result.status).toBe('passed');
    const commandArguments = run.mock.calls[0]![0];
    expect(commandArguments[commandArguments.indexOf('--style') + 1]).toBe(expected);
});

test.each([
    { level: 'basic', project: '', checked: [] },
    { level: 'all', project: '', checked: ['--skip-checking-short-docstrings', 'false'] },
    { level: 'all', project: '[tool.pydoclint]\nskip-checking-short-docstrings = true\n', checked: [] },
] as const)('pydoclint at level $level checks one-line docstrings: $checked', async ({ level, project, checked }) => {
    await using sandbox = await createGitSandbox({});
    using prepared = await preparePydoclintCheck(
        sandbox.path,
        { 'pyproject.toml': `${PYPROJECT}${project}`, 'source.py': 'value = 1\n' },
        { level },
    );
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult());
    await runCheckCode(
        buildCheckSession(prepared.session, CHECK_GENERATION),
        prepared.planned,
        CHECK_CODE['python/pydoclint'],
        {},
    );
    const commandArguments = run.mock.calls[0]![0];
    const index = commandArguments.indexOf('--skip-checking-short-docstrings');
    expect(index === -1 ? [] : commandArguments.slice(index, index + 2)).toStrictEqual([...checked]);
});

async function preparePydoclintCheck(
    root: string,
    files: Record<string, string>,
    settings: { tables?: string; level?: Level } = {},
): Promise<DisposableStack & { session: Session; planned: PlannedCheck }> {
    using cleanup = new DisposableStack();
    const resources = cleanup.use(new DisposableStack());
    const executable = buildVenvExecutablePath(GSPOT_PATHS.pythonEnvironment, 'pydoclint');
    await createFileTree(root, {
        ...files,
        'gspot.toml': buildSandboxSettings(['python'], settings),
        [executable]: '',
    });
    await chmod(join(root, executable), EXECUTABLE_FILE);
    const session = await openSession(root, { resources: resources.use(createRunResources()) });
    const [planned] = planChecks(session, { stage: 'all', only: ['python/pydoclint'] });
    if (planned === undefined) throw new Error('The Python sandbox does not plan pydoclint.');
    const fakes = fakeToolExecutables([getTool(readConfigurations().values(), 'pydoclint')]);
    resources.use(fakes);
    return Object.assign(cleanup.move(), { session, planned });
}

test('pydoclint keeps earlier style findings when a later style batch fails', async () => {
    await using sandbox = await createGitSandbox({});
    using prepared = await preparePydoclintCheck(sandbox.path, {
        'pyproject.toml': PYPROJECT,
        'google.py': GOOGLE_DOCSTRING_MODULE,
        'numpy.py': NUMPY_DOCSTRING_MODULE,
    });
    const { session, planned } = prepared;
    using _command = spyOn(processes, 'spawnProcess')
        .mockResolvedValueOnce(
            buildProcessResult({
                code: 1,
                stdout: 'google.py\n    1: DOC103: The documented argument is wrong.\n',
                duration: 2,
            }),
        )
        .mockResolvedValueOnce(buildProcessResult(FAILED_STYLE_BATCH));
    const result = await runCheckCode(
        buildCheckSession(session, CHECK_GENERATION),
        planned,
        CHECK_CODE['python/pydoclint'],
        {},
    );
    expect(result.status).toBe('error');
    expect(result.fileCount).toBe(2);
    expect(result.findings).toStrictEqual([
        expect.objectContaining({
            file: 'google.py',
            line: 1,
            rule: 'DOC103',
            message: 'The documented argument is wrong.',
        }),
    ]);
    expect(result.note).toBe('pydoclint could not run: The native command could not read its configuration.');
});
