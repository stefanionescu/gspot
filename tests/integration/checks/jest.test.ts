import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import jestPackage from 'jest/package.json' with { type: 'json' };
import { COVERAGE_ZERO_LIMITS } from '#tests/data/checks/coverage.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';

import {
    MATH_SOURCE,
    MATH_TEST_SOURCE,
    JEST_PROJECT_FILES,
    FIXED_MATH_TEST_SOURCE,
    JEST_COVERAGE_SETTINGS,
} from '#tests/data/checks/jest.ts';

/** The Jest project, with the pinned Jest version in its package.json. */
function buildJestFiles(): Record<string, string> {
    const packageJson = { name: 'jest-acceptance', private: true, devDependencies: { jest: jestPackage.version } };
    return { ...JEST_PROJECT_FILES, 'package.json': JSON.stringify(packageJson) + '\n' };
}

// The coverage and load-failure tests share these root project files.
function prepareJest(root: string, testSource: string) {
    return createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['jest'], {
            tables: JEST_COVERAGE_SETTINGS,
            level: 'all',
        }),
        ...buildJestFiles(),
        'math.test.cjs': testSource,
    });
}

test("jest/coverage at level all uses the scope's coverage limits and runs only that scope's tests", async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['jest'] }],
            tables: '[scope.coverage]\nfunctions = 100\n',
        }),
        'package.json': '{"name":"jest-scoped-acceptance","private":true}\n',
        'sibling.test.cjs': 'throw new Error("Tests outside the selected project must not execute");\n',
        'app/package.json':
            JSON.stringify({ name: 'jest-nested', private: true, devDependencies: { jest: jestPackage.version } }) +
            '\n',
        'app/math.cjs': MATH_SOURCE,
        'app/math.test.cjs': MATH_TEST_SOURCE,
        'app/authored.txt': 'preserved nested source\n',
    });

    const environment = {};
    const command = ['check', '--only', 'jest/coverage', '--json'];
    const uncovered = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
    const report = uncovered.report;
    expect(report.checks).toMatchObject([{ check: 'jest/coverage', scope: 'app', status: 'failed' }]);
    expect(report.checks.flatMap((check) => check.findings)).toContainEqual(
        matchFields({ message: 'coverage threshold for functions (100%) not met: 50%' }),
    );
    await writeFile(join(sandbox.path, 'app/math.test.cjs'), FIXED_MATH_TEST_SOURCE);
    const passing = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(passing.code, passing.stdout + passing.stderr).toBe(0);
    expect(passing.report.checks).toMatchObject([
        { check: 'jest/coverage', scope: 'app', status: 'passed', findings: [] },
    ]);
    expect(await readFile(join(sandbox.path, 'app/authored.txt'), 'utf8')).toBe('preserved nested source\n');
});

test('jest/coverage at level all reports uncovered functions and failed tests and keeps your files', async () => {
    await using sandbox = await testdir();
    await prepareJest(sandbox.path, MATH_TEST_SOURCE);
    const environment = {};
    const command = ['check', '--only', 'jest/coverage', '--json'];
    const uncovered = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
    expect(uncovered.report.checks.flatMap((check) => check.findings)).toStrictEqual([
        matchFields({ message: 'coverage threshold for lines (80%) not met: 66.66%' }),
        matchFields({
            check: 'jest/coverage',
            message: 'coverage threshold for functions (80%) not met: 50%',
        }),
    ]);
    await writeFile(join(sandbox.path, 'math.test.cjs'), FIXED_MATH_TEST_SOURCE);
    const passing = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(passing.code, passing.stdout + passing.stderr).toBe(0);
    expect(passing.report.checks).toMatchObject([{ check: 'jest/coverage', status: 'passed', findings: [] }]);
    await writeFile(join(sandbox.path, 'math.test.cjs'), FIXED_MATH_TEST_SOURCE.replace('toBe(6)', 'toBe(7)'));
    const failed = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap((check) => check.findings)).toStrictEqual([
        matchFields({ message: matchSubstring('toBe(7)') }),
    ]);
    await assertJestFilesKept(sandbox.path);
});

test('jest/coverage reports a test file with a missing import as an error and passes after the fix', async () => {
    await using sandbox = await testdir();
    await prepareJest(sandbox.path, 'require("./missing-test-dependency.cjs");\n');
    const environment = {};
    const command = ['check', '--only', 'jest/coverage', '--json'];
    const unavailable = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
    expect(unavailable.report.checks).toStrictEqual([matchFields({ check: 'jest/coverage', status: 'error' })]);
    await writeFile(join(sandbox.path, 'math.test.cjs'), FIXED_MATH_TEST_SOURCE);
    const recovered = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
    expect(recovered.report.checks).toMatchObject([{ check: 'jest/coverage', status: 'passed', findings: [] }]);
    await assertJestFilesKept(sandbox.path);
});

test('jest/coverage runs root and scope tests without coverage flags when every limit is 0', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['jest'], {
            level: 'all',
            tables:
                COVERAGE_ZERO_LIMITS +
                `[[scope]]
path = "app"

configurations = ["jest"]
`,
        }),
        ...buildJestFiles(),
        'math.test.cjs': MATH_TEST_SOURCE,
        'app/package.json': buildJestFiles()['package.json'],
        'app/math.cjs': MATH_SOURCE,
        'app/math.test.cjs': MATH_TEST_SOURCE,
        'app/authored.txt': 'preserved nested source\n',
    });

    const result = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'jest/coverage', '--json'], {}));
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const report = result.report;
    expect(report.checks.map((check) => check.scope)).toStrictEqual(['', 'app']);
    for (const check of report.checks) {
        expect(check).toMatchObject({ status: 'passed', findings: [] });
        expect(check.command).not.toContain('--runInBand');
        expect(check.command!.some((part) => part.startsWith('--coverage'))).toBe(false);
    }
    expect(await readFile(join(sandbox.path, 'authored.txt'), 'utf8')).toBe('preserved source\n');
    expect(await readFile(join(sandbox.path, 'app/authored.txt'), 'utf8')).toBe('preserved nested source\n');
});

/** Assert the source and authored coverage files that a Jest run must keep. */
async function assertJestFilesKept(root: string): Promise<void> {
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe('preserved source\n');
    expect(await readFile(join(root, 'coverage/authored.txt'), 'utf8')).toBe('preserved report\n');
    expect(await readFile(join(root, 'math.cjs'), 'utf8')).toBe(MATH_SOURCE);
}
