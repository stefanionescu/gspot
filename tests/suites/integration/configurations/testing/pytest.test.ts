import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { ARITHMETIC_MODULE } from '#tests/config/integration/python.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

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
        result: {
            status: 'missing',
            note: 'pytest-cov is not installed. Install pytest-cov in the Python environment used by pytest.',
            coverage: undefined,
        },
    },
    {
        limit: 0,
        coverage:
            '[coverage]\nmin_line_percent = { value = 0, reason = "This test checks execution without coverage collection." }\n',
        code: 0,
        result: { status: 'passed', note: undefined, coverage: false },
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
                checked.report.checks.map(({ scope, status, note, command }) => ({
                    scope,
                    status,
                    note,
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
