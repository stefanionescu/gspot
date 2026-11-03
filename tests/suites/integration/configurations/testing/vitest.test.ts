import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { createFileTree, type TestdirResult } from 'testdirs';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';

import {
    VITEST_SOURCE,
    UNTESTED_SOURCE,
    COVERAGE_ZERO_LIMITS,
    VITEST_PROJECT_FILES,
} from '#tests/config/integration/testing.ts';

const vitestProjectFiles = {
    ...VITEST_PROJECT_FILES,
    'package.json':
        JSON.stringify({
            name: 'example',
            version: '1.0.0',
            private: true,
            type: 'module',
            devDependencies: { vitest: SANDBOX_PACKAGES.vitest },
        }) + '\n',
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

test('vitest/tests at a limit above 0 reports @vitest/coverage-v8 as missing when the project lacks it', async () => {
    await using sandbox = await createVitestProject(
        COVERAGE_ZERO_LIMITS.replace(/^min_line_percent = .*$/mu, 'min_line_percent = 80'),
    );
    await rm(join(sandbox.path, 'node_modules/@vitest/coverage-v8'));
    const checked = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'vitest/tests', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    const note = '@vitest/coverage-v8 is not installed. Run npm install --save-dev --save-exact @vitest/coverage-v8.';
    expect(checked.report.checks.map(({ scope, status, note }) => ({ scope, status, note }))).toStrictEqual([
        { scope: '', status: 'missing', note },
        { scope: 'app', status: 'missing', note },
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
