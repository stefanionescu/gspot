// Planted repository for the pytest configuration: coverage under the floor.
import { test, expect } from 'bun:test';
import { QUIET_INIT } from '#tests/config/cli.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { runPlanted } from '#tests/harness/planted/cases.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { install, toolsPath } from '#tests/harness/tools/install.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';

const FASTAPI_TESTS =
    '"""Tests of the arithmetic."""\n\nfrom planted.math import double, triple\n\n\ndef test_multiplication() -> None:\n    """Both functions multiply."""\n    assert double(2) == 4\n    assert triple(2) == 6\n';

const MATH =
    '"""Arithmetic."""\n\n\ndef double(value: int) -> int:\n    """Double a number."""\n    return value * 2\n\n\ndef triple(value: int) -> int:\n    """Triple a number."""\n    return value * 3\n';

const PROJECT = `[project]\nname = "planted"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ["pytest"]\n\n[tool.pytest.ini_options]\npythonpath = ["."]\n`;

test(
    'the pytest configuration > coverage under the floor fails, and a test function keeps its prefix',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'pyproject.toml': PROJECT,
            'planted/__init__.py': '"""The package."""\n',
            'planted/math.py': MATH,
            'tests/__init__.py': '"""Arithmetic tests."""\n',
            'tests/test_math.py': FASTAPI_TESTS,
        });
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['ruff', 'pytest', 'typos', 'ec']) };
        await install(
            sandbox.path,
            ['init', '--yes', '--kits', 'python', 'pytest', 'naming', ...QUIET_INIT],
            environment,
            ['spelling', 'dependencies'],
        );
        for (const id of ['pytest/coverage', 'naming/identifiers', 'python/ruff']) {
            const clean = await spawnGspot(sandbox.path, ['check', '--only', id], environment);
            expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
        }
        const untested: FindingCase = {
            check: 'pytest/coverage',
            files: {
                'tests/test_math.py': FASTAPI_TESTS.replace('    assert triple(2) == 6\n', () => '').replace(
                    ', triple',
                    () => '',
                ),
            },
            policy: '[tools.pytest.coverage]\nlines = 95\n',
            expected: { message: textContaining('Required test coverage of 95%') },
        };
        const outcome = await runPlanted(sandbox.path, untested, environment);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        expect(outcome.stdout).toContain('Required test coverage of 95%');
        const failed = JSON.parse(outcome.stdout) as RunReport;
        expect(failed.checks).toMatchObject([{ check: 'pytest/coverage', status: 'fail' }]);
        expect(failed.checks[0]!.findings).toContainEqual(containing(untested.expected));
        const corrected = await runPlanted(sandbox.path, { ...untested, files: {} }, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'pytest/coverage', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 5,
);
