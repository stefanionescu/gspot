import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import type { RunReport } from '#cli/types/engine/run.ts';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const MATH_SOURCE = `function total(values) { let sum = 0; for (const value of values) { if (value > 0) sum += value; } return sum; }
function triple(value) { return value * 3; }
module.exports = { total, triple };
`;

const MATH_TEST_SOURCE = `const { total, triple } = require("./math.cjs");
test("adds positive values", () => { expect(total([2, -1, 3])).toBe(5); });
`;

const CORRECTED_MATH_TEST_SOURCE = `${MATH_TEST_SOURCE}test("triples an integer", () => { expect(triple(2)).toBe(6); });\n`;

const JEST_PROJECT_FILES = {
    'package.json': `${JSON.stringify({ name: 'jest-acceptance', private: true, devDependencies: { jest: SANDBOX_PACKAGES.jest } })}\n`,
    'math.cjs': MATH_SOURCE,
    'authored.txt': 'preserved source\n',
    'coverage/authored.txt': 'preserved report\n',
} as const;

const JEST_COVERAGE_TABLES = `[coverage]
min_line_percent = 80
min_branch_percent = 80
min_function_percent = 80
min_statement_percent = 80
`;

const COVERAGE_THRESHOLD_MESSAGE = 'coverage threshold for lines (80%) not met: ';

async function runJestCoverage(root: string, code: number): Promise<RunReport['checks']> {
    const result = parseCheckReport(await spawnGspot(root, ['check', '--only', 'jest/tests', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(code);
    return result.report.checks;
}

test("jest/tests at level all uses the scope's coverage limits and runs only that scope's tests", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['jest'] }],
            tables: '[scope.coverage]\nmin_function_percent = 100\n',
        }),
        'package.json': '{"name":"jest-scoped-acceptance","private":true}\n',
        'sibling.test.cjs': 'throw new Error("Tests outside the selected project must not execute");\n',
        'app/package.json': `${JSON.stringify({
            name: 'jest-nested',
            private: true,
            devDependencies: { jest: SANDBOX_PACKAGES.jest },
        })}\n`,
        'app/math.cjs': MATH_SOURCE,
        'app/math.test.cjs': MATH_TEST_SOURCE,
    });

    const uncovered = await runJestCoverage(sandbox.path, 1);
    expect(uncovered).toMatchObject([
        {
            check: 'jest/tests',
            scope: 'app',
            status: 'failed',
            findings: [
                { file: '', message: expect.stringContaining(COVERAGE_THRESHOLD_MESSAGE) as string },
                {
                    file: '',
                    message: expect.stringContaining('coverage threshold for functions (100%) not met: ') as string,
                },
            ],
        },
    ]);
    await writeFile(join(sandbox.path, 'app/math.test.cjs'), CORRECTED_MATH_TEST_SOURCE);
    const passing = await runJestCoverage(sandbox.path, 0);
    expect(passing).toMatchObject([{ check: 'jest/tests', scope: 'app', status: 'passed', findings: [] }]);
});

test("jest/tests leaves out a nested scope with its own config, and keeps the project's ignore patterns", async () => {
    const failing = 'test("fails", () => { expect(1).toBe(2); });\n';
    await using sandbox = await createGitSandbox({
        ...JEST_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['jest'], {
            scopes: [
                { path: 'packages/a', configurations: ['jest'] },
                { path: 'packages/a/b', configurations: ['jest'] },
            ],
        }),
        'jest.config.cjs': 'module.exports = { testPathIgnorePatterns: ["/ignored/"] };\n',
        'ignored/ignored.test.cjs': failing,
        'packages/a/jest.config.cjs': 'module.exports = {};\n',
        'packages/a/b/jest.config.cjs': 'module.exports = {};\n',
        'packages/a/b/b.test.cjs': failing,
    });
    const checks = await runJestCoverage(sandbox.path, 1);
    expect(checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'passed' },
        { scope: 'packages/a', status: 'passed' },
        { scope: 'packages/a/b', status: 'failed' },
    ]);
});

test('jest/tests at level all reports failed tests and keeps the authored files', async () => {
    await using sandbox = await createGitSandbox({
        ...JEST_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['jest'], { tables: JEST_COVERAGE_TABLES, level: 'all' }),
        'math.test.cjs': MATH_TEST_SOURCE,
    });
    await writeFile(join(sandbox.path, 'math.test.cjs'), CORRECTED_MATH_TEST_SOURCE.replace('toBe(6)', 'toBe(7)'));
    const failed = await runJestCoverage(sandbox.path, 1);
    expect(failed[0]!.findings.map(({ check, file, message }) => ({ check, file, message }))).toStrictEqual([
        { check: 'jest/tests', file: '', message: '● triples an integer' },
    ]);
    expect(await readFile(join(sandbox.path, 'coverage/authored.txt'), 'utf8')).toBe('preserved report\n');
});

test('jest/tests reports a test file with a missing import as a failed test and passes after the fix', async () => {
    await using sandbox = await createGitSandbox({
        ...JEST_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['jest'], { tables: JEST_COVERAGE_TABLES, level: 'all' }),
        'math.test.cjs': 'require("./missing-test-dependency.cjs");\n',
    });
    const unavailable = await runJestCoverage(sandbox.path, 1);
    expect(unavailable).toMatchObject([
        { check: 'jest/tests', status: 'failed', findings: [{ file: '', message: '● Test suite failed to run' }] },
    ]);
    expect(unavailable[0]!.note).toBeUndefined();
    await writeFile(join(sandbox.path, 'math.test.cjs'), CORRECTED_MATH_TEST_SOURCE);
    const recovered = await runJestCoverage(sandbox.path, 0);
    expect(recovered).toMatchObject([{ check: 'jest/tests', status: 'passed', findings: [] }]);
});
