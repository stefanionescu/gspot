import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { sandboxPath } from '#tests/setup/install.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { COVERAGE_ZERO_LIMITS } from '#tests/config/planning.ts';
import jestManifest from 'jest/package.json' with { type: 'json' };
import { containing, textContaining } from '#tests/setup/matchers.ts';

import {
    MATH_SOURCE,
    MATH_TEST_SOURCE,
    JEST_PROJECT_FILES,
    JEST_COVERAGE_SETTINGS,
    FIXED_MATH_TEST_SOURCE,
} from '#tests/config/jest.ts';

const files = {
    ...JEST_PROJECT_FILES,
    'package.json':
        JSON.stringify({ name: 'jest-acceptance', private: true, devDependencies: { jest: jestManifest.version } }) +
        '\n',
};

// Coverage findings and load failures share the native root project inputs.
function prepareJest(root: string, testSource: string) {
    return createFileTree(root, {
        'gspot.toml': settingsText(['jest'], {
            tables: JEST_COVERAGE_SETTINGS,
            level: 'all',
        }),
        ...files,
        'math.test.cjs': testSource,
    });
}

test("jest/coverage at level all uses the scope's coverage limits and runs only that scope's tests", async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
            tables: `[[scope]]
path = "app"

configurations = ["jest"]
[scope.coverage]
functions = 100
`,
            level: 'all',
        }),
        'package.json': '{"name":"jest-scoped-acceptance","private":true}\n',
        'sibling.test.cjs': 'throw new Error("Tests outside the selected project must not execute");\n',
        'app/package.json':
            JSON.stringify({ name: 'jest-nested', private: true, devDependencies: { jest: jestManifest.version } }) +
            '\n',
        'app/math.cjs': MATH_SOURCE,
        'app/math.test.cjs': MATH_TEST_SOURCE,
        'app/authored.txt': 'preserved nested source\n',
    });
    const environment = { PATH: sandboxPath() };
    const command = ['check', '--only', 'jest/coverage', '--json'];
    const uncovered = await spawnGspot(sandbox.path, command, environment);
    expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
    const report = JSON.parse(uncovered.stdout) as RunReport;
    expect(report.checks).toMatchObject([{ check: 'jest/coverage', scope: 'app', status: 'failed' }]);
    expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
        containing({ message: 'coverage threshold for functions (100%) not met: 50%' }),
    );
    await Bun.write(join(sandbox.path, 'app/math.test.cjs'), FIXED_MATH_TEST_SOURCE);
    const passing = await spawnGspot(sandbox.path, command, environment);
    expect(passing.code, passing.stdout + passing.stderr).toBe(0);
    expect((JSON.parse(passing.stdout) as RunReport).checks).toMatchObject([
        { check: 'jest/coverage', scope: 'app', status: 'passed', findings: [] },
    ]);
    expect(await readFile(join(sandbox.path, 'app/authored.txt'), 'utf8')).toBe('preserved nested source\n');
});

test('jest/coverage at level all reports uncovered functions and failed tests and keeps your files', async () => {
    await using sandbox = await testdir();
    await prepareJest(sandbox.path, MATH_TEST_SOURCE);
    const environment = { PATH: sandboxPath() };
    const command = ['check', '--only', 'jest/coverage', '--json'];
    const uncovered = await spawnGspot(sandbox.path, command, environment);
    expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
    expect((JSON.parse(uncovered.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([
        containing({ message: 'coverage threshold for lines (80%) not met: 66.66%' }),
        containing({
            check: 'jest/coverage',
            message: 'coverage threshold for functions (80%) not met: 50%',
        }),
    ]);
    await Bun.write(join(sandbox.path, 'math.test.cjs'), FIXED_MATH_TEST_SOURCE);
    const passing = await spawnGspot(sandbox.path, command, environment);
    expect(passing.code, passing.stdout + passing.stderr).toBe(0);
    expect((JSON.parse(passing.stdout) as RunReport).checks).toMatchObject([
        { check: 'jest/coverage', status: 'passed', findings: [] },
    ]);
    await Bun.write(join(sandbox.path, 'math.test.cjs'), FIXED_MATH_TEST_SOURCE.replace('toBe(6)', 'toBe(7)'));
    const failed = await spawnGspot(sandbox.path, command, environment);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([
        containing({ message: textContaining('toBe(7)') }),
    ]);
    expect(await readFile(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('preserved source\n');
    expect(await readFile(join(sandbox.path, 'coverage/authored.txt'), 'utf8')).toBe('preserved report\n');
    expect(await readFile(join(sandbox.path, 'math.cjs'), 'utf8')).toBe(MATH_SOURCE);
});

test('jest/coverage reports a test file with a missing import as an error and passes after the fix', async () => {
    await using sandbox = await testdir();
    await prepareJest(sandbox.path, 'require("./missing-test-dependency.cjs");\n');
    const environment = { PATH: sandboxPath() };
    const command = ['check', '--only', 'jest/coverage', '--json'];
    const unavailable = await spawnGspot(sandbox.path, command, environment);
    expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
    expect((JSON.parse(unavailable.stdout) as RunReport).checks).toStrictEqual([
        containing({ check: 'jest/coverage', status: 'error' }),
    ]);
    await Bun.write(join(sandbox.path, 'math.test.cjs'), FIXED_MATH_TEST_SOURCE);
    const recovered = await spawnGspot(sandbox.path, command, environment);
    expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
    expect((JSON.parse(recovered.stdout) as RunReport).checks).toMatchObject([
        { check: 'jest/coverage', status: 'passed', findings: [] },
    ]);
    expect(await readFile(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('preserved source\n');
    expect(await readFile(join(sandbox.path, 'coverage/authored.txt'), 'utf8')).toBe('preserved report\n');
    expect(await readFile(join(sandbox.path, 'math.cjs'), 'utf8')).toBe(MATH_SOURCE);
});

test('jest/coverage runs root and scope tests without coverage flags when every limit is 0', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['jest'], {
            level: 'all',
            tables:
                COVERAGE_ZERO_LIMITS +
                `[[scope]]
path = "app"

configurations = ["jest"]
`,
        }),
        ...files,
        'math.test.cjs': MATH_TEST_SOURCE,
        'app/package.json': files['package.json'],
        'app/math.cjs': MATH_SOURCE,
        'app/math.test.cjs': MATH_TEST_SOURCE,
        'app/authored.txt': 'preserved nested source\n',
    });
    const outcome = await spawnGspot(sandbox.path, ['check', '--only', 'jest/coverage', '--json'], {
        PATH: sandboxPath(),
    });
    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
    const report = JSON.parse(outcome.stdout) as RunReport;
    expect(report.checks.map((check) => check.scope)).toStrictEqual(['', 'app']);
    for (const check of report.checks) {
        expect(check).toMatchObject({ status: 'passed', findings: [] });
        expect(check.command).not.toContain('--runInBand');
        expect(check.command!.some((part) => part.startsWith('--coverage'))).toBe(false);
    }
    expect(await readFile(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('preserved source\n');
    expect(await readFile(join(sandbox.path, 'app/authored.txt'), 'utf8')).toBe('preserved nested source\n');
});
