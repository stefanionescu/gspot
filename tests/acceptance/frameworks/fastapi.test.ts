// Planted repositories for the pytest and fastapi presets: coverage under the floor, a test name the prefix allows, a sleep inside an async route.
import { createSandbox } from '@gspot/testing';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const QUIET = ['--no-runner', '--no-ci', '--no-hooks', '--no-rules', '--no-install'];
const PROJECT = (dependency: string): string =>
    `[project]\nname = "planted"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ["${dependency}"]\n\n[tool.pytest.ini_options]\npythonpath = ["."]\n`;
const MATH =
    '"""Arithmetic."""\n\n\ndef double(value: int) -> int:\n    """Double a number."""\n    return value * 2\n\n\ndef triple(value: int) -> int:\n    """Triple a number."""\n    return value * 3\n';
const TESTS =
    '"""Tests of the arithmetic."""\n\nfrom planted.math import double, triple\n\n\ndef test_multiplication() -> None:\n    """Both functions multiply."""\n    assert double(2) == 4\n    assert triple(2) == 6\n';
const ROUTE = (body: string): string =>
    `"""The health route."""\n\nimport asyncio\nimport time\n\n\nasync def health() -> dict[str, str]:\n    """Say the service is up."""\n${body}    return {"status": "up"}\n\n\n__all__ = ["asyncio", "health", "time"]\n`;

describe('the pytest preset', () => {
    test(
        'coverage under the floor fails, and a test function keeps its prefix',
        async () => {
            await using sandbox = await createSandbox({
                'pyproject.toml': PROJECT('pytest'),
                'planted/__init__.py': '"""The package."""\n',
                'planted/math.py': MATH,
                'tests/__init__.py': '"""Arithmetic tests."""\n',
                'tests/test_math.py': TESTS,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ruff', 'pytest', 'typos', 'ec']) };
            await install(
                sandbox.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'python',
                    'pytest',
                    'naming',
                    '--without',
                    'structure',
                    'spelling',
                    'dependencies',
                    ...QUIET,
                ],
                environment,
            );
            for (const id of ['pytest/coverage', 'naming/identifiers', 'python/ruff']) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            const untested: PlantedCase = {
                check: 'pytest/coverage',
                files: {
                    'tests/test_math.py': TESTS.replace('    assert triple(2) == 6\n', () => '').replace(
                        ', triple',
                        () => '',
                    ),
                },
                policy: '[tools.pytest]\ncoverage = 95\n',
                expected: 'Required test coverage of 95%',
            };
            const outcome = await runPlanted(sandbox.path, untested, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            expect(outcome.stdout).toContain(untested.expected);
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});

describe('the fastapi preset', () => {
    test(
        'a sleep inside an async route is a finding, and the awaited one is not',
        async () => {
            await using sandbox = await createSandbox({
                'pyproject.toml': PROJECT('fastapi'),
                'planted/__init__.py': '"""The package."""\n',
                'planted/health.py': ROUTE('    await asyncio.sleep(0)\n'),
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ruff', 'typos', 'ec']) };
            await install(
                sandbox.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'python',
                    'fastapi',
                    '--without',
                    'structure',
                    'spelling',
                    'naming',
                    'dependencies',
                    'security',
                    'pytest',
                    ...QUIET,
                ],
                environment,
            );
            for (const id of ['fastapi/no-blocking-io-in-async', 'fastapi/openapi-lint', 'fastapi/openapi-fresh']) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            const blocked = await runPlanted(
                sandbox.path,
                {
                    check: 'fastapi/no-blocking-io-in-async',
                    files: { 'planted/health.py': ROUTE('    time.sleep(1)\n') },
                    expected: 'time.sleep blocks the event loop',
                },
                environment,
            );
            expect(blocked.code, blocked.stdout + blocked.stderr).toBe(1);
            expect(blocked.stdout).toContain('time.sleep blocks the event loop');
            expect(blocked.stdout).toContain('planted/health.py:9');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
