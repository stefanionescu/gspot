import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import vitestPackage from 'vitest/package.json' with { type: 'json' };
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { linkInstalledModules } from '#tests/setup/sandboxes/node-modules.ts';
import { COVERAGE_ZERO_LIMITS } from '#tests/data/integration/checks/coverage.ts';

import {
    VITEST_SOURCE,
    VITEST_PACKAGE,
    UNTESTED_SOURCE,
    VITEST_PROJECT_FILES,
} from '#tests/data/integration/checks/vitest.ts';

const vitestProjectFiles = {
    ...VITEST_PROJECT_FILES,
    'package.json': JSON.stringify({ ...VITEST_PACKAGE, devDependencies: { vitest: vitestPackage.version } }) + '\n',
};

test('vitest/coverage reports coverage under its limit and passes after the fix, in the root and a scope', async () => {
    await using sandbox = await testdir(vitestProjectFiles);

    await createFileTree(join(sandbox.path, 'app'), vitestProjectFiles);
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['typescript', 'vitest'], {
            level: 'all',
            tables: '[coverage]\nlines = 100\nfunctions = 100\n',
            scopes: [{ path: 'app', configurations: ['typescript', 'vitest'] }],
        }),
    );
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
                'Coverage for lines (80%) does not meet global threshold (100%)',
                'Coverage for functions (50%) does not meet global threshold (100%)',
            ],
        },
    ]);
    expect(await readFile(source, 'utf8')).toBe(UNTESTED_SOURCE);
    await writeFile(source, VITEST_SOURCE);
    const corrected = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'vitest/coverage', '--json']),
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
        { scope: '', status: 'passed' },
        { scope: 'app', status: 'passed' },
    ]);
    expect(await readFile(source, 'utf8')).toBe(VITEST_SOURCE);
});

test('vitest/coverage at a limit above 0 reports @vitest/coverage-v8 as missing when the project lacks it', async () => {
    await using sandbox = await testdir(vitestProjectFiles);

    await createFileTree(join(sandbox.path, 'app'), vitestProjectFiles);
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await rm(join(sandbox.path, 'node_modules/@vitest/coverage-v8'));
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['typescript', 'vitest'], {
            level: 'all',
            tables:
                COVERAGE_ZERO_LIMITS.replace(/^lines = .*$/mu, 'lines = 80') +
                `[[scope]]
path = "app"
configurations = ["typescript", "vitest"]
`,
        }),
    );
    const checked = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'vitest/coverage', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    const note = '@vitest/coverage-v8 is not installed. Run: npm install --save-dev @vitest/coverage-v8';
    expect(checked.report.checks.map(({ scope, status, note }) => ({ scope, status, note }))).toStrictEqual([
        { scope: '', status: 'missing', note },
        { scope: 'app', status: 'missing', note },
    ]);
});
