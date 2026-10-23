import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import jestPackage from 'jest/package.json' with { type: 'json' };
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    MATH_SOURCE,
    JEST_FAILED_TEST,
    MATH_TEST_SOURCE,
    JEST_PROJECT_FILES,
    JEST_MISSING_IMPORT,
    JEST_COVERAGE_TABLES,
    CORRECTED_MATH_TEST_SOURCE,
} from '#tests/config/integration/checks/testing/jest.ts';

/** The Jest project, with the pinned Jest version in its package.json. */
function buildJestFiles(): Record<string, string> {
    const packageJson = { name: 'jest-acceptance', private: true, devDependencies: { jest: jestPackage.version } };
    return { ...JEST_PROJECT_FILES, 'package.json': JSON.stringify(packageJson) + '\n' };
}

/** Write the Jest project and its settings, which the coverage and load-failure tests share. */
function prepareJest(root: string, testSource: string) {
    return createFileTree(root, {
        'gspot.toml': buildSandboxSettings(['jest'], { tables: JEST_COVERAGE_TABLES, level: 'all' }),
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

    const command = ['check', '--only', 'jest/coverage', '--json'];
    const uncovered = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
    expect(uncovered.report.checks).toMatchObject([
        {
            check: 'jest/coverage',
            scope: 'app',
            status: 'failed',
            findings: [
                { file: '', message: 'coverage threshold for lines (80%) not met: 66.66%' },
                { file: '', message: 'coverage threshold for functions (100%) not met: 50%' },
            ],
        },
    ]);
    await writeFile(join(sandbox.path, 'app/math.test.cjs'), CORRECTED_MATH_TEST_SOURCE);
    const passing = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(passing.code, passing.stdout + passing.stderr).toBe(0);
    expect(passing.report.checks).toMatchObject([
        { check: 'jest/coverage', scope: 'app', status: 'passed', findings: [] },
    ]);
    expect(await readFile(join(sandbox.path, 'app/authored.txt'), 'utf8')).toBe('preserved nested source\n');
});

test('jest/coverage at level all reports uncovered functions and failed tests and keeps your files', async () => {
    await using sandbox = await testdir();
    await prepareJest(sandbox.path, MATH_TEST_SOURCE);
    const command = ['check', '--only', 'jest/coverage', '--json'];
    const uncovered = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(uncovered.code, uncovered.stdout + uncovered.stderr).toBe(1);
    expect(uncovered.report.checks).toMatchObject([
        {
            findings: [
                { file: '', message: 'coverage threshold for lines (80%) not met: 66.66%' },
                { file: '', message: 'coverage threshold for functions (80%) not met: 50%' },
            ],
        },
    ]);
    await writeFile(join(sandbox.path, 'math.test.cjs'), CORRECTED_MATH_TEST_SOURCE);
    const passing = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(passing.code, passing.stdout + passing.stderr).toBe(0);
    expect(passing.report.checks).toMatchObject([{ check: 'jest/coverage', status: 'passed', findings: [] }]);
    await writeFile(join(sandbox.path, 'math.test.cjs'), CORRECTED_MATH_TEST_SOURCE.replace('toBe(6)', 'toBe(7)'));
    const failed = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    // A failed test reports the whole Jest output, which ends with the run summary.
    expect(failed.report.checks[0]!.findings).toMatchObject([{ check: 'jest/coverage', file: '' }]);
    expect(failed.report.checks[0]!.findings[0]!.message).toStartWith(JEST_FAILED_TEST);
    await assertJestFilesKept(sandbox.path);
});

test('jest/coverage reports a test file with a missing import as an error and passes after the fix', async () => {
    await using sandbox = await testdir();
    await prepareJest(sandbox.path, 'require("./missing-test-dependency.cjs");\n');
    const command = ['check', '--only', 'jest/coverage', '--json'];
    const unavailable = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(unavailable.code, unavailable.stdout + unavailable.stderr).toBe(2);
    expect(unavailable.report.checks).toMatchObject([{ check: 'jest/coverage', status: 'error', findings: [] }]);
    expect(unavailable.report.checks[0]!.note).toStartWith(JEST_MISSING_IMPORT);
    await writeFile(join(sandbox.path, 'math.test.cjs'), CORRECTED_MATH_TEST_SOURCE);
    const recovered = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(recovered.code, recovered.stdout + recovered.stderr).toBe(0);
    expect(recovered.report.checks).toMatchObject([{ check: 'jest/coverage', status: 'passed', findings: [] }]);
    await assertJestFilesKept(sandbox.path);
});

/** Assert the source and authored coverage files that a Jest run must keep. */
async function assertJestFilesKept(root: string): Promise<void> {
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe('preserved source\n');
    expect(await readFile(join(root, 'coverage/authored.txt'), 'utf8')).toBe('preserved report\n');
    expect(await readFile(join(root, 'math.cjs'), 'utf8')).toBe(MATH_SOURCE);
}
