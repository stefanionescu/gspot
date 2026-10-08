// Sandbox for the pytest configuration: coverage under the floor.
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { QUIET_INIT } from '#tests/config/harness/init.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { runCheckCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import { buildToolsPath, initRepository } from '#tests/harness/install.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { MATH, PROJECT, ARITHMETIC_TESTS } from '#tests/config/tools/configurations/tool/pytest.ts';

test('the pytest configuration > coverage under the floor fails, and a test function keeps its prefix', async () => {
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
    const untested: FindingCase = {
        check: 'pytest/coverage',
        files: {
            'tests/test_math.py': ARITHMETIC_TESTS.replace('    assert triple(2) == 6\n', () => '').replace(
                ', triple',
                () => '',
            ),
        },
        policy: '[tools.pytest.coverage]\nlines = 95\n',
        expected: { message: textContaining('Required test coverage of 95%') },
    };
    const outcome = await runCheckCase(sandbox.path, untested, environment);
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
    expect(outcome.stdout).toContain('Required test coverage of 95%');
    const failed = JSON.parse(outcome.stdout) as RunReport;
    expect(failed.checks).toMatchObject([{ check: 'pytest/coverage', status: 'failed' }]);
    expect(failed.checks[0]!.findings).toContainEqual(containing(untested.expected));
    const corrected = await runCheckCase(sandbox.path, { ...untested, files: {} }, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'pytest/coverage', status: 'passed', findings: [] },
    ]);
});
