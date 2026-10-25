import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { type Session } from '#cli/types/session.ts';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { findCheckCode } from '#cli/checks/registry.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { EXECUTABLE_FILE } from '#cli/config/files/modes.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { PYPROJECT } from '#tests/config/checks/language/python/project.ts';
import { runCheckCode, buildCheckSession } from '#cli/commands/check/run.ts';

import {
    FAILED_STYLE_BATCH,
    NUMPY_DOCSTRING_MODULE,
    GOOGLE_DOCSTRING_MODULE,
    PYDOCLINT_PROJECT_CASES,
} from '#tests/config/checks/language/python/pydoclint.ts';

test.each(PYDOCLINT_PROJECT_CASES)('pydoclint $name', async ({ project, setting, expected, typeFlags }) => {
    await using sandbox = await testdir();
    using prepared = await preparePydoclintCheck(
        sandbox.path,
        { 'pyproject.toml': project, 'source.py': 'value = 1\n' },
        setting === undefined ? '' : `[tools.ruff]\ndocstring_convention = "${setting}"\n`,
    );
    const { session, planned } = prepared;
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult());
    const result = await runCheckCode(buildCheckSession(session), planned, findCheckCode(planned.check));
    expect(result.status).toBe('passed');
    const commandArguments = run.mock.calls[0]![0];
    expect({
        style: commandArguments[commandArguments.indexOf('--style') + 1],
        typeFlags: commandArguments.flatMap((argument, index) =>
            ['--arg-type-hints-in-docstring', '--check-return-types', '--check-yield-types'].includes(argument)
                ? [argument, commandArguments[index + 1]]
                : [],
        ),
    }).toStrictEqual({ style: expected, typeFlags: [...typeFlags] });
});

async function preparePydoclintCheck(
    root: string,
    files: Record<string, string>,
    tables = '',
): Promise<DisposableStack & { session: Session; planned: PlannedCheck }> {
    using cleanup = new DisposableStack();
    const resources = cleanup.use(new DisposableStack());
    const executable = buildVenvExecutablePath(GSPOT_PATHS.pythonEnvironment, 'pydoclint');
    await createFileTree(root, {
        ...files,
        'gspot.toml': buildSandboxSettings(['python'], { tables }),
        [executable]: '',
    });
    await chmod(join(root, executable), EXECUTABLE_FILE);
    const session = await openSession(root, { resources });
    const [planned] = planChecks(session, { stage: 'all', only: ['python/pydoclint'] });
    if (planned === undefined) throw new Error('The Python sandbox does not plan pydoclint.');
    const fakes = fakeToolExecutables([getTool(session.configurations.values(), 'pydoclint')]);
    resources.use(fakes);
    return Object.assign(cleanup.move(), { session, planned });
}

test('pydoclint keeps earlier style findings when a later style batch fails', async () => {
    await using sandbox = await testdir();
    using prepared = await preparePydoclintCheck(sandbox.path, {
        'pyproject.toml': PYPROJECT,
        'google.py': GOOGLE_DOCSTRING_MODULE,
        'numpy.py': NUMPY_DOCSTRING_MODULE,
    });
    const { session, planned } = prepared;
    using command = spyOn(processes, 'spawnProcess')
        .mockResolvedValueOnce(
            buildProcessResult({
                code: 1,
                stdout: 'google.py\n    1: DOC103: The documented argument is wrong.\n',
                duration: 2,
            }),
        )
        .mockResolvedValueOnce(buildProcessResult(FAILED_STYLE_BATCH));
    const result = await runCheckCode(buildCheckSession(session), planned, findCheckCode(planned.check));
    expect(result.status).toBe('error');
    expect(result.fileCount).toBe(2);
    expect(result.findings).toStrictEqual([
        {
            check: 'python/pydoclint',
            file: 'google.py',
            line: 1,
            rule: 'DOC103',
            message: 'The documented argument is wrong.',
            help: 'Bring the docstring in line with the signature.',
            fixable: false,
        },
    ]);
    expect(result.note).toBe('pydoclint could not run: The native command could not read its configuration.');
    expect(
        command.mock.calls.map(([commandArguments]) => commandArguments[commandArguments.indexOf('--style') + 1]),
    ).toStrictEqual(['google', 'numpy']);
});
