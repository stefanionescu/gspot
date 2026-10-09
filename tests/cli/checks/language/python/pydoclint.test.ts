import { join } from 'node:path';
import { chmod } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/public.ts';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { PYPROJECT } from '#tests/config/samples/python.ts';
import { environmentExecutable } from '#cli/platform/contracts.ts';
import { pydoclint, docstringConfiguration } from '#cli/checks/language/public.ts';
import { DOCSTRING_STYLES, DOCSTRING_PROJECTS } from '#tests/config/cli/checks/language/python/pydoclint.ts';

test.each(DOCSTRING_PROJECTS)('pydoclint runs with $name', async ({ files, style }) => {
    await using sandbox = await testdir();
    const executable = environmentExecutable('.gspot/.venv', 'pydoclint');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python']),
        ...files,
        'example/__init__.py': '"""Test."""\n',
        [executable]: '',
    });
    await chmod(join(sandbox.path, executable), 0o755);
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'all', skips: [], only: ['python/pydoclint'] });
    using _version = spyOn(spawn, 'runBlocking').mockReturnValue({
        code: 0,
        stdout: `pydoclint, version ${session.manifests.get('python')!.tools.find((tool) => tool.name === 'pydoclint')!.version!}\n`,
        stderr: '',
        missing: false,
        duration: 1,
    });
    using command = spyOn(spawn, 'run').mockResolvedValue({
        code: 0,
        stdout: '',
        stderr: '',
        missing: false,
        duration: 1,
    });
    const result = await pydoclint(session, planned!);
    expect(result).toMatchObject({ check: 'python/pydoclint', status: 'passed', findings: [] });
    expect(
        command.mock.calls.map(([argv, options]) => ({
            executable: argv[0],
            style: argv[argv.indexOf('--style') + 1],
            cwd: options.cwd,
        })),
    ).toStrictEqual([{ executable: join(sandbox.path, executable), style, cwd: sandbox.path }]);
});

test.each([...DOCSTRING_STYLES])('the docstring convention $name', ({ project, setting, expected }) => {
    expect(docstringConfiguration(project, setting).style).toBe(expected);
});

test.each(['', '[tool.ruff]\nline-length = 88\n', '[tool.ruff.lint.pydocstyle]\nconvention = "pep257"\n'])(
    'absent and unsupported Ruff conventions preserve native defaults: %j',
    (text) => {
        expect(docstringConfiguration(text).style).toBeUndefined();
    },
);

test('malformed Python project configuration reports the incomplete TOML key', () => {
    expect(() => docstringConfiguration('[tool.ruff')).toThrow('incomplete key-value: cannot find end of key');
});

test('pydoclint disables repeated signature types only when the project has not authored those options', () => {
    expect(docstringConfiguration('').command).toStrictEqual([
        'pydoclint',
        '--allow-init-docstring',
        'true',
        '--quiet',
        '{files}',
        '--arg-type-hints-in-docstring',
        'false',
        '--check-return-types',
        'false',
        '--check-yield-types',
        'false',
    ]);
    expect(
        docstringConfiguration(
            '[tool.pydoclint]\narg-type-hints-in-docstring = true\ncheck_return_types = false\ncheck-yield-types = true\n',
        ).command,
    ).toStrictEqual(['pydoclint', '--allow-init-docstring', 'true', '--quiet', '{files}']);
});

test('pydoclint keeps earlier style findings when a later native style batch fails', async () => {
    await using sandbox = await testdir();
    const executable = environmentExecutable('.gspot/.venv', 'pydoclint');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python']),
        'pyproject.toml': PYPROJECT,
        'google.py':
            'def double(value: int) -> int:\n    """Double it.\n\n    Args:\n        wrong: A number.\n    """\n    return value * 2\n',
        'numpy.py':
            'def double(value: int) -> int:\n    """Double it.\n\n    Parameters\n    ----------\n    value\n        A number.\n    """\n    return value * 2\n',
        [executable]: '',
    });
    await chmod(join(sandbox.path, executable), 0o755);
    const session = await openSession(sandbox.path);
    const [planned] = planRun(session, { stage: 'all', skips: [], only: ['python/pydoclint'] });
    using _version = spyOn(spawn, 'runBlocking').mockReturnValue({
        code: 0,
        stdout: `pydoclint, version ${session.manifests.get('python')!.tools.find((tool) => tool.name === 'pydoclint')!.version!}\n`,
        stderr: '',
        missing: false,
        duration: 1,
    });
    using command = spyOn(spawn, 'run')
        .mockResolvedValueOnce({
            code: 1,
            stdout: 'google.py\n    1: DOC103: The documented argument is wrong.\n',
            stderr: '',
            missing: false,
            duration: 2,
        })
        .mockResolvedValueOnce({
            code: 2,
            stdout: '',
            stderr: 'The native command could not read its configuration.',
            isErrored: true,
            missing: false,
            duration: 3,
        });
    const result = await pydoclint(session, planned!);
    expect(result.status).toBe('error');
    expect(result.fileCount).toBe(2);
    expect(result.findings).toMatchObject([{ file: 'google.py', rule: 'DOC103' }]);
    expect(result.note).toContain('The native command could not read its configuration.');
    expect(command.mock.calls.map(([argv]) => argv[argv.indexOf('--style') + 1])).toStrictEqual(['google', 'numpy']);
});
