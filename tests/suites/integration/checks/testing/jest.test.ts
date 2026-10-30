import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { type RunReport } from '#cli/types/commands/check.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    MATH_SOURCE,
    MATH_TEST_SOURCE,
    JEST_PROJECT_FILES,
    JEST_COVERAGE_TABLES,
    COVERAGE_THRESHOLD_MESSAGE,
    CORRECTED_MATH_TEST_SOURCE,
} from '#tests/config/integration/checks/testing/jest.ts';

async function runJestCoverage(root: string, code: number): Promise<RunReport['checks']> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'jest/coverage', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return result.report.checks;
}

test("jest/coverage at level all uses the scope's coverage limits and runs only that scope's tests", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['jest'] }],
            tables: '[scope.coverage]\nfunctions = 100\n',
        }),
        'package.json': '{"name":"jest-scoped-acceptance","private":true}\n',
        'sibling.test.cjs': 'throw new Error("Tests outside the selected project must not execute");\n',
        'app/package.json':
            JSON.stringify({ name: 'jest-nested', private: true, devDependencies: { jest: SANDBOX_PACKAGES.jest } }) +
            '\n',
        'app/math.cjs': MATH_SOURCE,
        'app/math.test.cjs': MATH_TEST_SOURCE,
        'app/authored.txt': 'preserved nested source\n',
    });

    const uncovered = await runJestCoverage(sandbox.path, 1);
    expect(uncovered).toMatchObject([
        {
            check: 'jest/coverage',
            scope: 'app',
            status: 'failed',
            findings: [
                { file: '', message: COVERAGE_THRESHOLD_MESSAGE },
                { file: '', message: 'coverage threshold for functions (100%) not met: 50%' },
            ],
        },
    ]);
    await writeFile(join(sandbox.path, 'app/math.test.cjs'), CORRECTED_MATH_TEST_SOURCE);
    const passing = await runJestCoverage(sandbox.path, 0);
    expect(passing).toMatchObject([{ check: 'jest/coverage', scope: 'app', status: 'passed', findings: [] }]);
});

test('jest/coverage at level all reports uncovered functions and failed tests and keeps the authored files', async () => {
    await using sandbox = await createGitSandbox({
        ...JEST_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['jest'], { tables: JEST_COVERAGE_TABLES, level: 'all' }),
        'math.test.cjs': MATH_TEST_SOURCE,
    });
    const uncovered = await runJestCoverage(sandbox.path, 1);
    expect(uncovered).toMatchObject([
        {
            findings: [
                { file: '', message: COVERAGE_THRESHOLD_MESSAGE },
                { file: '', message: 'coverage threshold for functions (80%) not met: 50%' },
            ],
        },
    ]);
    await writeFile(join(sandbox.path, 'math.test.cjs'), CORRECTED_MATH_TEST_SOURCE);
    const passing = await runJestCoverage(sandbox.path, 0);
    expect(passing).toMatchObject([{ check: 'jest/coverage', status: 'passed', findings: [] }]);
    await writeFile(join(sandbox.path, 'math.test.cjs'), CORRECTED_MATH_TEST_SOURCE.replace('toBe(6)', 'toBe(7)'));
    const failed = await runJestCoverage(sandbox.path, 1);
    expect(failed[0]!.findings.map(({ check, file, message }) => ({ check, file, message }))).toStrictEqual([
        { check: 'jest/coverage', file: '', message: '● triples an integer' },
    ]);
    await assertJestFilesKept(sandbox.path);
});

test('jest/coverage reports a test file with a missing import as a failed test and passes after the fix', async () => {
    await using sandbox = await createGitSandbox({
        ...JEST_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['jest'], { tables: JEST_COVERAGE_TABLES, level: 'all' }),
        'math.test.cjs': 'require("./missing-test-dependency.cjs");\n',
    });
    const unavailable = await runJestCoverage(sandbox.path, 1);
    expect(unavailable).toMatchObject([
        { check: 'jest/coverage', status: 'failed', findings: [{ file: '', message: '● Test suite failed to run' }] },
    ]);
    expect(unavailable[0]!.note).toBeUndefined();
    await writeFile(join(sandbox.path, 'math.test.cjs'), CORRECTED_MATH_TEST_SOURCE);
    const recovered = await runJestCoverage(sandbox.path, 0);
    expect(recovered).toMatchObject([{ check: 'jest/coverage', status: 'passed', findings: [] }]);
    await assertJestFilesKept(sandbox.path);
});

async function assertJestFilesKept(root: string): Promise<void> {
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe('preserved source\n');
    expect(await readFile(join(root, 'coverage/authored.txt'), 'utf8')).toBe('preserved report\n');
    expect(await readFile(join(root, 'math.cjs'), 'utf8')).toBe(MATH_SOURCE);
}
