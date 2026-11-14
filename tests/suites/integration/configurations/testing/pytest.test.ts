import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { ARITHMETIC_MODULE } from '#tests/config/integration/python.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

const PYTEST_PYPROJECT = `[project]
name = "example"
version = "1.0.0"
requires-python = ">=3.12"
dependencies = ["pytest==9.1.1", "pytest-cov==7.1.0"]

[tool.pytest.ini_options]
pythonpath = ["."]
`;

const ARITHMETIC_TESTS = `"""Tests of the arithmetic."""

from example.math import double, triple

def test_multiplication() -> None:
    """Both functions multiply."""
    assert double(2) == 4
    assert triple(2) == 6
`;

const PRICING_TESTS = 'from pricing import gross, net\n\n\ndef test_net():\n    assert net(2) == 2\n';

const PYTEST_SANDBOX = {
    configurations: ['python', 'pytest', 'naming'],
    files: {
        'pyproject.toml': PYTEST_PYPROJECT,
        'example/__init__.py': '"""The package."""\n',
        'example/math.py': ARITHMETIC_MODULE,
        'tests/__init__.py': '"""Arithmetic tests."""\n',
        'tests/test_math.py': ARITHMETIC_TESTS,
    },
} as const;

const COVERAGE_LIMIT_CASES = [
    {
        limit: 80,
        coverage: '[coverage]\nmin_line_percent = 80\n',
        code: 2,
        result: { status: 'missing', coverage: undefined },
    },
    {
        limit: 0,
        coverage:
            '[coverage]\nmin_line_percent = { value = 0, reason = "This test checks execution without coverage collection." }\n',
        code: 0,
        result: { status: 'passed', coverage: false },
    },
] as const;

const installedSandbox = shareInstalledSandbox({ install: false, ...PYTEST_SANDBOX, commands: [['uv', 'sync']] });

test.each([...COVERAGE_LIMIT_CASES])(
    "pytest/tests with a $limit limit uses the project's Python and needs pytest-cov only above 0",
    async ({ coverage, code, result }) => {
        const { root } = installedSandbox();
        const project = PYTEST_PYPROJECT.replace(', "pytest-cov==7.1.0"', '');
        const change = await writeSandboxChanges(installedSandbox(), {
            files: {
                'pyproject.toml': project,
                'uv.lock': await readFile(join(root, 'uv.lock'), 'utf8'),
                'app/test_child.py': 'def test_child():\n    assert 3 * 2 == 6\n',
                'gspot.toml': buildSandboxSettings(['python', 'pytest'], {
                    level: 'all',
                    scopes: [{ path: 'app', configurations: ['python', 'pytest'] }],
                    tables: coverage,
                }),
            },
        });
        try {
            const installed = await runCommand(['uv', 'sync'], { cwd: root });
            expect(installed.code, installed.stdout + installed.stderr).toBe(0);
            const lockfile = await readFile(join(root, 'uv.lock'), 'utf8');
            const checked = parseCheckReport(
                await spawnGspot(root, ['check', '--only', 'pytest/tests', '--json', '--verbose']),
            );
            expect(checked.code, checked.stdout + checked.stderr).toBe(code);
            expect(
                checked.report.checks.map(({ scope, status, command }) => ({
                    scope,
                    status,
                    coverage: command?.some((argument) => argument.startsWith('--cov')),
                })),
            ).toStrictEqual(['', 'app'].map((scope) => ({ scope, ...result })));
            expect(await readFile(join(root, 'pyproject.toml'), 'utf8')).toBe(project);
            expect(await readFile(join(root, 'uv.lock'), 'utf8')).toBe(lockfile);
        } finally {
            await change[Symbol.asyncDispose]();
            await runCommand(['uv', 'sync'], { cwd: root });
        }
    },
);

test('pytest/tests with pytest-cov and a limit of 100 reports an untested function in each scope, and passes once a test covers it', async () => {
    const { root } = installedSandbox();
    await using _change = await writeSandboxChanges(installedSandbox(), {
        files: {
            'tests/test_math.py': ARITHMETIC_TESTS.replace('    assert triple(2) == 6\n', ''),
            'app/pricing.py': 'def net(price):\n    return price\n\n\ndef gross(price):\n    return price * 2\n',
            'app/test_pricing.py': PRICING_TESTS,
            'gspot.toml': buildSandboxSettings(['python', 'pytest'], {
                level: 'all',
                scopes: [{ path: 'app', configurations: ['python', 'pytest'] }],
                tables: '[coverage]\nmin_line_percent = 100\n',
            }),
        },
    });
    const command = ['check', '--only', 'pytest/tests', '--json'];
    const failed = parseCheckReport(await spawnGspot(root, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.map(({ scope, status, findings }) => ({
            scope,
            status,
            findings: findings.map(({ message }) => message),
        })),
    ).toStrictEqual(
        ['', 'app'].map((scope) => ({
            scope,
            status: 'failed',
            findings: [expect.stringContaining('Required test coverage of 100%') as string],
        })),
    );
    await writeFile(join(root, 'tests/test_math.py'), ARITHMETIC_TESTS);
    await writeFile(
        join(root, 'app/test_pricing.py'),
        `${PRICING_TESTS}\n\ndef test_gross():\n    assert gross(2) == 4\n`,
    );
    const covered = parseCheckReport(await spawnGspot(root, command));
    expect(covered.code, covered.stdout + covered.stderr).toBe(0);
    expect(covered.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual(
        ['', 'app'].map((scope) => ({ scope, status: 'passed' })),
    );
});
