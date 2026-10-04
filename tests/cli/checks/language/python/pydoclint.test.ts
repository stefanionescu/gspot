import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import * as spawn from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { PYPROJECT } from '#tests/config/samples/python/source.ts';
import { pydoclint, docstringStyle } from '#cli/checks/language/python/pydoclint.ts';
import { DOCSTRING_STYLES } from '#tests/config/cli/checks/language/python/pydoclint.ts';

test('pydoclint passes the project Google docstring convention to its native command', async () => {
    await using sandbox = await testdir();
    const executable = `.gspot/.venv/${process.platform === 'win32' ? 'Scripts/pydoclint.exe' : 'bin/pydoclint'}`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python']),
        'pyproject.toml': `${PYPROJECT}\n[tool.ruff.lint.pydocstyle]\nconvention = "google"\n`,
        'example/__init__.py': '"""Test."""\n',
        [executable]: '',
    });
    chmodSync(join(sandbox.path, executable), 0o755);
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
    ).toStrictEqual([{ executable: join(sandbox.path, executable), style: 'google', cwd: sandbox.path }]);
});

test.each([...DOCSTRING_STYLES])('the docstring convention $name', ({ project, setting, expected }) => {
    expect(docstringStyle(project, setting)).toBe(expected);
});

test.each(['', '[tool.ruff]\nline-length = 88\n', '[tool.ruff.lint.pydocstyle]\nconvention = "pep257"\n'])(
    'absent and unsupported Ruff conventions preserve native defaults: %j',
    (text) => {
        expect(docstringStyle(text)).toBeUndefined();
    },
);

test('malformed Python project configuration reports the incomplete TOML key', () => {
    expect(() => docstringStyle('[tool.ruff')).toThrow('incomplete key-value: cannot find end of key');
});
