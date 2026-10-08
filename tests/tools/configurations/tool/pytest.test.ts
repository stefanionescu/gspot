// Sandbox for the pytest configuration: coverage under the floor.
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { buildToolsPath, initRepository } from '#tests/harness/install.ts';
import { MATH, PROJECT, ARITHMETIC_TESTS } from '#tests/config/samples/python.ts';

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
