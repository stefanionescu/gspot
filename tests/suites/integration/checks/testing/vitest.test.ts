import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { createFileTree, type TestdirResult } from 'testdirs';
import { SANDBOX_PACKAGES } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { COVERAGE_ZERO_LIMITS } from '#tests/config/integration/checks/testing/samples.ts';

import {
    VITEST_SOURCE,
    UNTESTED_SOURCE,
    VITEST_PROJECT_FILES,
} from '#tests/config/integration/checks/testing/testing.ts';

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

test('vitest/coverage reports coverage under its limit and passes after the fix, in the root and a scope', async () => {
    await using sandbox = await createVitestProject('[coverage]\nlines = 100\nfunctions = 100\n');
    const source = join(sandbox.path, 'app/src/public.ts');
    await writeFile(source, UNTESTED_SOURCE);
    const failed = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'vitest/coverage', '--json']));
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
    const corrected = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'vitest/coverage', '--json']),
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'passed' },
        { scope: 'app', status: 'passed' },
    ]);
});

test('vitest/coverage at a limit above 0 reports @vitest/coverage-v8 as missing when the project lacks it', async () => {
    await using sandbox = await createVitestProject(COVERAGE_ZERO_LIMITS.replace(/^lines = .*$/mu, 'lines = 80'));
    await rm(join(sandbox.path, 'node_modules/@vitest/coverage-v8'));
    const checked = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'vitest/coverage', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    const note = '@vitest/coverage-v8 is not installed. Run npm install --save-dev @vitest/coverage-v8.';
    expect(checked.report.checks.map(({ scope, status, note }) => ({ scope, status, note }))).toStrictEqual([
        { scope: '', status: 'missing', note },
        { scope: 'app', status: 'missing', note },
    ]);
});
