import { chmod } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { EXECUTABLE_FILE } from '#cli/config/system.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import type { Level } from '#cli/types/settings.ts';
import {
    GOOGLE_DOCSTRING_MODULE,
    NUMPY_DOCSTRING_MODULE,
    PYDOCLINT_PROJECT_CASES,
} from '#tests/config/configurations/python.ts';
import { PYPROJECT } from '#tests/config/setup/languages.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildPythonToolFiles, fakeCommands, fakeToolExecutables } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildVenvExecutablePath } from '#tests/setup/system/programs.ts';

async function writePydoclintProject(
    root: string,
    files: Record<string, string>,
    settings: { tables?: string; level?: Level } = {},
): Promise<void> {
    const executable = buildVenvExecutablePath(GSPOT_PATHS.pythonEnvironment, 'pydoclint');
    await createFileTree(root, {
        ...files,
        'gspot.toml': buildSandboxSettings(['python'], settings),
        [executable]: '',
        ...buildPythonToolFiles('pydoclint'),
    });
    await chmod(join(root, executable), EXECUTABLE_FILE);
}

async function readPydoclintCommands(root: string): Promise<string[][]> {
    using _pins = fakeToolExecutables([getTool(readConfigurations().values(), 'pydoclint')]);
    using run = fakeCommands().mockResolvedValue(buildProcessResult());
    await runSandboxCheck(root, 'python/pydoclint');
    return run.mock.calls.map(([command]) => [...command]);
}

test.each([...PYDOCLINT_PROJECT_CASES])('pydoclint $name', async ({ project, setting, expected }) => {
    await using sandbox = await createGitSandbox({});
    await writePydoclintProject(
        sandbox.path,
        { 'pyproject.toml': project, 'source.py': 'value = 1\n' },
        { tables: `[python]\ndocstring_convention = "${setting}"\n` },
    );
    const [commandArguments = []] = await readPydoclintCommands(sandbox.path);
    expect(commandArguments[commandArguments.indexOf('--style') + 1]).toBe(expected);
});

test.each([
    { level: 'basic', project: '', checked: [] },
    { level: 'all', project: '', checked: ['--skip-checking-short-docstrings', 'false'] },
    { level: 'all', project: '[tool.pydoclint]\nskip-checking-short-docstrings = true\n', checked: [] },
] as const)('pydoclint at level $level checks one-line docstrings: $checked', async ({ level, project, checked }) => {
    await using sandbox = await createGitSandbox({});
    await writePydoclintProject(
        sandbox.path,
        { 'pyproject.toml': `${PYPROJECT}${project}`, 'source.py': 'value = 1\n' },
        { level },
    );
    const [commandArguments = []] = await readPydoclintCommands(sandbox.path);
    const index = commandArguments.indexOf('--skip-checking-short-docstrings');
    expect(index === -1 ? [] : commandArguments.slice(index, index + 2)).toStrictEqual([...checked]);
});

const GOOGLE_RETURNS_SOURCE =
    'def read_value() -> int:\n    """Read the value.\n\n    Returns:\n        The value.\n    """\n    return 1\n';

test.each([
    { name: 'only a Google Returns section', source: GOOGLE_RETURNS_SOURCE, setting: undefined, expected: 'google' },
    {
        name: 'only a Google section under the numpy setting',
        source: GOOGLE_RETURNS_SOURCE,
        setting: 'numpy',
        expected: 'numpy',
    },
    {
        name: 'a NumPy section in its first docstring, before a later Google section',
        source: `def read_value(value: int) -> int:\n    """Read the value.\n\n    Parameters\n    ----------\n    value\n        The value.\n    """\n    return value\n\n\n${GOOGLE_RETURNS_SOURCE.replace('read_value', 'write_value')}`,
        setting: undefined,
        expected: 'numpy',
    },
] as const)(
    'pydoclint runs a file that holds $name with the style $expected',
    async ({ source, setting, expected }) => {
        await using sandbox = await createGitSandbox({});
        await writePydoclintProject(
            sandbox.path,
            { 'pyproject.toml': PYPROJECT, 'source.py': source },
            setting === undefined ? {} : { tables: `[python]\ndocstring_convention = "${setting}"\n` },
        );
        const [commandArguments = []] = await readPydoclintCommands(sandbox.path);
        expect(commandArguments[commandArguments.indexOf('--style') + 1]).toBe(expected);
    },
);

test('pydoclint says what to write under Raises for DOC503 and leaves other rules to the help of the check', async () => {
    await using sandbox = await createGitSandbox({});
    await writePydoclintProject(sandbox.path, { 'pyproject.toml': PYPROJECT, 'source.py': 'value = 1\n' });
    using _pins = fakeToolExecutables([getTool(readConfigurations().values(), 'pydoclint')]);
    using _command = fakeCommands().mockResolvedValue(
        buildProcessResult({
            code: 1,
            stdout: "source.py\n    1: DOC103: The documented argument is wrong.\n    4: DOC503: Raised exceptions in the docstring: ['OrderError']. Raised exceptions in the body: ['build_error'].\n",
        }),
    );
    const findings = await runSandboxCheck(sandbox.path, 'python/pydoclint');
    expect(findings.map(({ rule, help }) => [rule, help])).toStrictEqual([
        ['DOC103', undefined],
        ['DOC503', expect.any(String) as string],
    ]);
});

test('pydoclint runs the files of each docstring style in their own command', async () => {
    await using sandbox = await createGitSandbox({});
    await writePydoclintProject(sandbox.path, {
        'pyproject.toml': PYPROJECT,
        'google.py': GOOGLE_DOCSTRING_MODULE,
        'numpy.py': NUMPY_DOCSTRING_MODULE,
    });
    const commands = await readPydoclintCommands(sandbox.path);
    expect(
        commands.map((command) => ({
            style: command[command.indexOf('--style') + 1],
            files: command.filter((argument) => argument.endsWith('.py')),
        })),
    ).toStrictEqual([
        { style: 'google', files: ['google.py'] },
        { style: 'numpy', files: ['numpy.py'] },
    ]);
});
