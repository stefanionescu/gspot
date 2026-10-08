import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildSandboxPath } from '#tests/harness/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { SOURCE, TEST_SOURCE, CORRECTED_TEST_SOURCE } from '#tests/config/tools/configurations/tool/jest.ts';

test('native Jest at all applies nested coverage settings without executing sibling tests', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            tables: '[scope."app"]\nconfigurations = ["jest"]\n[scope.app.coverage]\nfunctions = 100\n',
            level: 'all',
        }),
        'package.json': '{"name":"jest-scoped-acceptance","private":true}\n',
        'sibling.test.cjs': 'throw new Error("Tests outside the selected project must not execute");\n',
        'app/package.json': '{"name":"jest-nested","private":true,"devDependencies":{"jest":"30.2.0"}}\n',
        'app/math.cjs': SOURCE,
        'app/math.test.cjs': TEST_SOURCE,
        'app/authored.txt': 'preserved nested source\n',
    });
    const environment = { PATH: buildSandboxPath([]) };
    const command = ['check', '--only', 'jest/coverage', '--json'];
    const uncovered = await spawnGspot(sandbox.path, command, environment);
    expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
    const report = JSON.parse(uncovered.stdout) as RunReport;
    expect(report.checks).toMatchObject([{ check: 'jest/coverage', scope: 'app', status: 'failed' }]);
    expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
        containing({ rule: 'coverage-functions', message: textContaining('100% floor') }),
    );
    await Bun.write(join(sandbox.path, 'app/math.test.cjs'), CORRECTED_TEST_SOURCE);
    const passing = await spawnGspot(sandbox.path, command, environment);
    expect(passing.code, passing.stdout + passing.stderr).toBe(0);
    expect((JSON.parse(passing.stdout) as RunReport).checks).toMatchObject([
        { check: 'jest/coverage', scope: 'app', status: 'passed', findings: [] },
    ]);
    expect((JSON.parse(passing.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, 'app/authored.txt'), 'utf8')).toBe('preserved nested source\n');
});

test('native Jest at all reports uncovered functions and failed tests while preserving working-tree files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['jest'], {
            tables: '[coverage]\nlines = 80\nbranches = 80\nfunctions = 80\nstatements = 80\n',
            level: 'all',
        }),
        'package.json': '{"name":"jest-acceptance","private":true,"devDependencies":{"jest":"30.2.0"}}\n',
        'math.cjs': SOURCE,
        'math.test.cjs': TEST_SOURCE,
        'authored.txt': 'preserved source\n',
        'coverage/authored.txt': 'preserved report\n',
    });
    const environment = { PATH: buildSandboxPath([]) };
    const command = ['check', '--only', 'jest/coverage', '--json'];
    const uncovered = await spawnGspot(sandbox.path, command, environment);
    expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
    expect((JSON.parse(uncovered.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([
        containing({ rule: 'coverage-lines' }),
        containing({
            check: 'jest/coverage',
            rule: 'coverage-functions',
            message: textContaining('50%'),
        }),
    ]);
    await Bun.write(join(sandbox.path, 'math.test.cjs'), CORRECTED_TEST_SOURCE);
    const passing = await spawnGspot(sandbox.path, command, environment);
    expect(passing.code, passing.stdout + passing.stderr).toBe(0);
    expect((JSON.parse(passing.stdout) as RunReport).checks).toMatchObject([
        { check: 'jest/coverage', status: 'passed', findings: [] },
    ]);
    expect((JSON.parse(passing.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
    await Bun.write(join(sandbox.path, 'math.test.cjs'), CORRECTED_TEST_SOURCE.replace('toBe(6)', 'toBe(7)'));
    const failed = await spawnGspot(sandbox.path, command, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([
        containing({ rule: 'test-failure', file: 'math.test.cjs', line: 4 }),
    ]);
    await Bun.write(join(sandbox.path, 'math.test.cjs'), 'require("./missing-test-dependency.cjs");\n');
    const unavailable = await spawnGspot(sandbox.path, command, environment);
    expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
    expect((JSON.parse(unavailable.stdout) as RunReport).checks).toStrictEqual([
        containing({ check: 'jest/coverage', status: 'error' }),
    ]);
    await Bun.write(join(sandbox.path, 'math.test.cjs'), CORRECTED_TEST_SOURCE);
    const recovered = await spawnGspot(sandbox.path, command, environment);
    expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
    expect((JSON.parse(recovered.stdout) as RunReport).checks).toMatchObject([
        { check: 'jest/coverage', status: 'passed', findings: [] },
    ]);
    expect(await readFile(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('preserved source\n');
    expect(await readFile(join(sandbox.path, 'coverage/authored.txt'), 'utf8')).toBe('preserved report\n');
    expect(await readFile(join(sandbox.path, 'math.cjs'), 'utf8')).toBe(SOURCE);
});
