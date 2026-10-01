// Planted repositories for the pytest and fastapi configurations: coverage under the floor, a sleep inside an async route, an OpenAPI document with a hole, and a stale one.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { QUIET_INIT, PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { runPlanted, plantedCases } from '#tests/support/cli/planted.ts';
import { containing, textContaining } from '#tests/support/expectations.ts';

import {
    MATH,
    DOCUMENT,
    FASTAPI_TESTS,
    OPENAPI_POLICY,
    documentWriter,
} from '#tests/inputs/acceptance/source/kits/kits.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two cases plant the same pyproject.toml with a different dependency.
const PROJECT = (dependency: string): string =>
    `[project]\nname = "planted"\nversion = "1.0.0"\nrequires-python = ">=3.12"\ndependencies = ["${dependency}"]\n\n[tool.pytest.ini_options]\npythonpath = ["."]\n`;
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two cases plant the same route with a different body.
const ROUTE = (body: string): string =>
    `"""The health route."""\n\nimport asyncio\nimport time\n\n\nasync def health() -> dict[str, str]:\n    """Say the service is up."""\n${body}    return {"status": "up"}\n\n\n__all__ = ["asyncio", "health", "time"]\n`;

test(
    'the pytest configuration > coverage under the floor fails, and a test function keeps its prefix',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'pyproject.toml': PROJECT('pytest'),
            'planted/__init__.py': '"""The package."""\n',
            'planted/math.py': MATH,
            'tests/__init__.py': '"""Arithmetic tests."""\n',
            'tests/test_math.py': FASTAPI_TESTS,
        });
        commitAll(sandbox.path);
        const environment = { PATH: toolsPath(['ruff', 'pytest', 'typos', 'ec']) };
        await install(
            sandbox.path,
            [
                'init',
                '--yes',
                '--kits',
                'python',
                'pytest',
                'naming',
                '--without',
                'spelling',
                'dependencies',
                ...QUIET_INIT,
            ],
            environment,
        );
        for (const id of ['pytest/coverage', 'naming/identifiers', 'python/ruff']) {
            const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
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
            policy: '[tools.pytest]\ncoverage = 95\n',
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

plantedCases(
    'the fastapi configuration',
    {
        kits: ['python', 'fastapi'],
        modules: false,
        without: ['spelling', 'naming', 'dependencies', 'security', 'pytest'],
        tools: ['ruff'],
        files: {
            'pyproject.toml': PROJECT('fastapi'),
            'planted/__init__.py': '"""The package."""\n',
            'planted/health.py': ROUTE('    await asyncio.sleep(0)\n'),
            'openapi.yaml': DOCUMENT,
            'write-document.js': documentWriter(DOCUMENT),
        },
    },
    [
        {
            check: 'fastapi/no-blocking-io-in-async',
            files: { 'planted/health.py': ROUTE('    time.sleep(1)\n') },
            expected: { file: 'planted/health.py', line: 9, rule: 'blocking-call' },
        },
        {
            check: 'openapi/lint',
            files: { 'openapi.yaml': DOCUMENT.replace('            operationId: readHealth\n', '') },
            policy: OPENAPI_POLICY,
            expected: { file: 'openapi.yaml', rule: 'operation-operationId', line: 15 },
        },
        {
            check: 'openapi/fresh',
            files: { 'write-document.js': documentWriter(`${DOCUMENT}# later\n`) },
            policy: OPENAPI_POLICY,
            expected: { file: 'openapi.yaml', rule: 'stale', line: 1 },
        },
    ],
);
