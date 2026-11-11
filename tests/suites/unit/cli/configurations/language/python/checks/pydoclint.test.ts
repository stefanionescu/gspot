import { chmod } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { EXECUTABLE_FILE } from '#cli/config/repository/files.ts';
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { buildCheckSession, runCheckCode } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { getTool, readConfigurations } from '#cli/manifests/read.ts';
import * as processes from '#cli/system/processes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { Level } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';
import {
    FAILED_STYLE_BATCH,
    GOOGLE_DOCSTRING_MODULE,
    NUMPY_DOCSTRING_MODULE,
    PYDOCLINT_PROJECT_CASES,
} from '#tests/config/configurations/python.ts';
import { PYPROJECT } from '#tests/config/setup/languages.ts';
import { CHECK_GENERATION, createRunResources } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildPythonToolFiles, fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildVenvExecutablePath } from '#tests/setup/system/programs.ts';

test.each([...PYDOCLINT_PROJECT_CASES])('pydoclint $name', async ({ project, setting, expected }) => {
    await using sandbox = await createGitSandbox({});
    using prepared = await preparePydoclintCheck(
        sandbox.path,
        { 'pyproject.toml': project, 'source.py': 'value = 1\n' },
        { tables: `[python]\ndocstring_convention = "${setting}"\n` },
    );
    const commandArguments = await readPydoclintArguments(prepared);
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
    const commandArguments = await readPydoclintArguments(prepared);
    const index = commandArguments.indexOf('--skip-checking-short-docstrings');
    expect(index === -1 ? [] : commandArguments.slice(index, index + 2)).toStrictEqual([...checked]);
});

async function readPydoclintArguments(check: { session: Session; planned: PlannedCheck }): Promise<string[]> {
    using run = spyOn(processes, 'runProcess').mockResolvedValue(buildProcessResult());
    await runCheckCode(
        buildCheckSession(check.session, CHECK_GENERATION),
        check.planned,
        CHECK_CODE['python/pydoclint'],
        {},
    );
    return [...run.mock.calls[0]![0]];
}

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
        ...buildPythonToolFiles('pydoclint'),
    });
    await chmod(join(root, executable), EXECUTABLE_FILE);
    const session = await openSession(root, { resources: resources.use(createRunResources()) });
    const [planned] = planChecks(session, { stage: 'all', only: ['python/pydoclint'] });
    if (planned === undefined) throw new Error('The Python sandbox does not plan pydoclint.');
    const fakes = fakeToolExecutables([getTool(readConfigurations().values(), 'pydoclint')]);
    resources.use(fakes);
    return Object.assign(cleanup.move(), { session, planned });
}

test.each([
    { name: 'a Google Returns section', section: 'Returns:', setting: undefined, expected: 'google' },
    { name: 'a Google Attributes section', section: 'Attributes:', setting: undefined, expected: 'google' },
    { name: 'a Google Raises section', section: 'Raises:', setting: undefined, expected: 'google' },
    { name: 'a Google section under the numpy setting', section: 'Returns:', setting: 'numpy', expected: 'numpy' },
] as const)(
    'pydoclint runs a file that holds only $name with the style $expected',
    async ({ section, setting, expected }) => {
        await using sandbox = await createGitSandbox({});
        using prepared = await preparePydoclintCheck(
            sandbox.path,
            {
                'pyproject.toml': PYPROJECT,
                'source.py': `def read_value() -> int:\n    """Read the value.\n\n    ${section}\n        The value.\n    """\n    return 1\n`,
            },
            setting === undefined ? {} : { tables: `[python]\ndocstring_convention = "${setting}"\n` },
        );
        const commandArguments = await readPydoclintArguments(prepared);
        expect(commandArguments[commandArguments.indexOf('--style') + 1]).toBe(expected);
    },
);

test('pydoclint runs a file whose first docstring has a NumPy section with the numpy style, before a later Google section', async () => {
    await using sandbox = await createGitSandbox({});
    using prepared = await preparePydoclintCheck(sandbox.path, {
        'pyproject.toml': PYPROJECT,
        'source.py': [
            'def read_value(value: int) -> int:',
            '    """Read the value.',
            '',
            '    Parameters',
            '    ----------',
            '    value',
            '        The value.',
            '    """',
            '    return value',
            '',
            '',
            'def write_value() -> int:',
            '    """Write the value.',
            '',
            '    Returns:',
            '        The value.',
            '    """',
            '    return 1',
            '',
        ].join('\n'),
    });
    const commandArguments = await readPydoclintArguments(prepared);
    expect(commandArguments[commandArguments.indexOf('--style') + 1]).toBe('numpy');
});

test('pydoclint says what to write under Raises for DOC503 and keeps the help of the check for other rules', async () => {
    await using sandbox = await createGitSandbox({});
    using prepared = await preparePydoclintCheck(sandbox.path, {
        'pyproject.toml': PYPROJECT,
        'source.py': 'value = 1\n',
    });
    using _command = spyOn(processes, 'runProcess').mockResolvedValue(
        buildProcessResult({
            code: 1,
            stdout: "source.py\n    1: DOC103: The documented argument is wrong.\n    4: DOC503: Raised exceptions in the docstring: ['OrderError']. Raised exceptions in the body: ['build_error'].\n",
        }),
    );
    const result = await runCheckCode(
        buildCheckSession(prepared.session, CHECK_GENERATION),
        prepared.planned,
        CHECK_CODE['python/pydoclint'],
        {},
    );
    const helps = new Map(result.findings.map(({ rule, help }) => [rule, help]));
    expect(helps.get('DOC103')).toBe(prepared.planned.check.help);
    expect(helps.get('DOC503')).toContain('Under `Raises:`, list each name');
});

test('pydoclint keeps earlier style findings when a later style batch fails', async () => {
    await using sandbox = await createGitSandbox({});
    using prepared = await preparePydoclintCheck(sandbox.path, {
        'pyproject.toml': PYPROJECT,
        'google.py': GOOGLE_DOCSTRING_MODULE,
        'numpy.py': NUMPY_DOCSTRING_MODULE,
    });
    const { session, planned } = prepared;
    using _command = spyOn(processes, 'runProcess')
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
    expect(result.note).toContain('The native command could not read its configuration.');
});
