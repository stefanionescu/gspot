import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree, type TestdirResult } from 'testdirs';

import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const COVERAGE_ZERO_LIMITS = `[coverage]
min_line_percent = { value = 0, reason = "This test checks execution without coverage collection." }
min_branch_percent = { value = 0, reason = "This test checks execution without coverage collection." }
min_function_percent = { value = 0, reason = "This test checks execution without coverage collection." }
min_statement_percent = { value = 0, reason = "This test checks execution without coverage collection." }
`;

const VITEST_SOURCE = `// Arithmetic the test tests call.

/**
Adds positive values.
@param values the values to total
@returns the positive total
*/
export function positiveTotal(values: number[]): number {
    let total = 0;
    for (const value of values) {
        if (value > 0) total += value;
    }
    return total;
}
`;

const UNTESTED_SOURCE = `${VITEST_SOURCE}
/**
Triples a number.
@param value the number.
@returns three times the number.
*/
export function triple(value: number): number {
    return value * 3;
}
`;

const VITEST_MATH_TEST = `import { test, expect } from 'vitest';
import { positiveTotal } from './public.js';

test('adds only positive values', () => {
    expect(positiveTotal([2, 3])).toBe(5);
    expect(positiveTotal([-2, 3])).toBe(3);
    expect(positiveTotal([])).toBe(0);
});
`;

const VITEST_PROJECT_FILES = {
    '.gitignore': 'node_modules\ncoverage\n',
    'vitest.config.mjs': "export default { test: { include: ['src/*.test.ts'] } };\n",
    'src/public.ts': VITEST_SOURCE,
    'src/math.test.ts': VITEST_MATH_TEST,
} as const;

const vitestProjectFiles = {
    ...VITEST_PROJECT_FILES,
    'package.json': `${JSON.stringify({
        name: 'example',
        version: '1.0.0',
        private: true,
        type: 'module',
        devDependencies: { vitest: SANDBOX_PACKAGES.vitest },
    })}\n`,
};

async function createVitestProject(tables: string): Promise<TestdirResult> {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(await createGitSandbox(vitestProjectFiles));
    await createFileTree(join(sandbox.path, 'app'), vitestProjectFiles);
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['typescript', 'vitest'], {
            level: 'all',
            tables,
            scopes: [{ path: 'app', configurations: ['typescript', 'vitest'] }],
        }),
    );
    resources.move();
    return sandbox;
}

test('vitest/tests reports coverage under its limit and passes after the fix, in the root and a scope', async () => {
    await using sandbox = await createVitestProject('[coverage]\nmin_line_percent = 100\nmin_function_percent = 100\n');
    const source = join(sandbox.path, 'app/src/public.ts');
    await writeFile(source, UNTESTED_SOURCE);
    const failed = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'vitest/tests', '--json']));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.map(({ scope, status, findings }) => ({
            scope,
            status,
            messages: findings.map(({ message }) => message),
        })),
    ).toStrictEqual([
        { scope: '', status: 'passed', messages: [] },
        {
            scope: 'app',
            status: 'failed',
            messages: [
                expect.stringMatching(/^Coverage for lines .* threshold \(100%\)$/u) as string,
                expect.stringMatching(/^Coverage for functions .* threshold \(100%\)$/u) as string,
            ],
        },
    ]);
    await writeFile(source, VITEST_SOURCE);
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'vitest/tests', '--json']));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'passed' },
        { scope: 'app', status: 'passed' },
    ]);
});

test('vitest/tests at the root leaves out a nested scope with its own config that a root project also reads', async () => {
    await using sandbox = await createGitSandbox({
        ...vitestProjectFiles,
        'gspot.toml': buildSandboxSettings(['vitest'], {
            scopes: [{ path: 'packages/a', configurations: ['vitest'] }],
        }),
        'vitest.config.mjs': "export default { test: { projects: ['packages/*'] } };\n",
        'packages/a/vitest.config.mjs': 'export default {};\n',
        'packages/a/a.test.js':
            "import { expect, test } from 'vitest';\ntest('fails', () => { expect(1).toBe(2); });\n",
    });
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    const checked = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'vitest/tests', '--json']));
    expect(checked.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'passed' },
        { scope: 'packages/a', status: 'failed' },
    ]);
});

test('vitest/tests without a Vitest config runs none of the test files that other checks copy', async () => {
    await using sandbox = await createVitestProject(COVERAGE_ZERO_LIMITS);
    for (const folder of ['', 'app']) await rm(join(sandbox.path, folder, 'vitest.config.mjs'));
    const marker = join(sandbox.path, 'copy-ran.txt');
    await createFileTree(join(sandbox.path, '.gspot-copies/1234-copy'), {
        'test/copied.test.ts': `import { test } from 'vitest';\nimport { writeFileSync } from 'node:fs';\ntest('copied', () => { writeFileSync(${JSON.stringify(marker)}, ''); });\n`,
    });
    const checked = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'vitest/tests', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(existsSync(marker)).toBe(false);
});
