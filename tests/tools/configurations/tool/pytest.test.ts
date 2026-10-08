// Sandbox for the pytest configuration: coverage under the floor.
import { join } from 'node:path';
import { commitAll } from '#tests/harness/git.ts';
import { planRun } from '#cli/planning/public.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { test, expect, afterAll, beforeAll } from 'bun:test';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import { testdir, createFileTree, type TestdirResult } from 'testdirs';
import { buildToolsPath, initRepository } from '#tests/harness/install.ts';
import { MATH, PROJECT, ARITHMETIC_TESTS } from '#tests/config/samples/python.ts';
import { PROVIDER_FLOORS } from '#tests/config/tools/configurations/tool/pytest.ts';

test('the pytest configuration > naming accepts the test_ prefix of a test function and Ruff and coverage accept its clean source', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'pyproject.toml': PROJECT,
        'example/__init__.py': '"""The package."""\n',
        'example/math.py': MATH,
        'tests/__init__.py': '"""Arithmetic tests."""\n',
        'tests/test_math.py': ARITHMETIC_TESTS,
    });
    const environment = { PATH: buildToolsPath(['ruff', 'typos', 'ec']) };
    const project = await runTestCommand(['uv', 'sync'], { cwd: sandbox.path, env: environment });
    expect(project.code, project.stdout + project.stderr).toBe(0);
    commitAll(sandbox.path);
    await initRepository(
        sandbox.path,
        ['init', '--yes', '--configurations', 'python', 'pytest', 'naming', ...QUIET_INIT],
        environment,
    );
    for (const id of ['pytest/coverage', 'naming/identifiers', 'python/ruff']) {
        const clean = await spawnGspot(sandbox.path, ['check', '--only', id], environment);
        expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
    }
});

let sandbox: TestdirResult;
let project: string;
let lock: string;

beforeAll(async () => {
    sandbox = await testdir();
    project = PROJECT.replace(', "pytest-cov==7.1.0"', '');
    await createFileTree(sandbox.path, {
        'pyproject.toml': project,
        'test_root.py': 'def test_root():\n    assert 2 * 3 == 6\n',
        'app/test_child.py': 'def test_child():\n    assert 3 * 2 == 6\n',
    });
    const synced = await runTestCommand(['uv', 'sync'], { cwd: sandbox.path });
    expect(synced.code, synced.stdout + synced.stderr).toBe(0);
    lock = await Bun.file(join(sandbox.path, 'uv.lock')).text();
});

afterAll(async () => {
    await sandbox[Symbol.asyncDispose]();
});

test.each([...PROVIDER_FLOORS])(
    'native pytest at %s uses its project interpreter with a %i floor without pytest-cov',
    async (level, floor) => {
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            buildPolicy(['python', 'pytest'], {
                level,
                tables: `[coverage]\nlines = ${String(floor)}\nbranches = 0\nfunctions = 0\nstatements = 0\n[reasons]\n"coverage.lines" = "This fixture checks a missing Python provider."\n"coverage.branches" = "This fixture checks a missing Python provider."\n"coverage.functions" = "This fixture checks a missing Python provider."\n"coverage.statements" = "This fixture checks a missing Python provider."\n[scope."app"]\nconfigurations = ["python", "pytest"]\n`,
            }),
        );
        const session = await openSession(sandbox.path);
        const checks = planRun(session, { stage: 'push', skips: [], only: ['pytest/coverage'] });
        expect(checks.map((check) => check.scope.scope.path)).toStrictEqual(['', 'app']);
        for (const check of checks) {
            const outcome = await runCheckCommand(session, check);
            expect(outcome.status).toBe(floor === 0 ? 'passed' : 'missing');
            if (floor === 0) expect(outcome.command?.some((arg) => arg.startsWith('--cov'))).toBe(false);
            else expect(outcome.note).toContain('pytest-cov');
        }
        expect(await Bun.file(join(sandbox.path, 'pyproject.toml')).text()).toBe(project);
        expect(await Bun.file(join(sandbox.path, 'uv.lock')).text()).toBe(lock);
    },
);
