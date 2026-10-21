import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { COVERAGE_ZERO_LIMITS } from '#tests/data/checks/coverage.ts';
import vitestManifest from 'vitest/package.json' with { type: 'json' };
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { VITEST_SOURCE, VITEST_PACKAGE, UNTESTED_SOURCE, VITEST_PROJECT_FILES } from '#tests/data/checks/vitest.ts';

const vitestProjectFiles = {
    ...VITEST_PROJECT_FILES,
    'package.json': JSON.stringify({ ...VITEST_PACKAGE, devDependencies: { vitest: vitestManifest.version } }) + '\n',
};

test('vitest/coverage reports a coverage limit and passes after the fix, in the root and a scope', async () => {
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
    const failedScope = failed.report.checks.find((check) => check.scope === 'app')!;
    expect(failedScope.status).toBe('failed');
    expect(failedScope.findings.some((finding) => finding.message.includes('100%'))).toBe(true);
    expect(await readFile(source, 'utf8')).toBe(UNTESTED_SOURCE);
    await writeFile(source, VITEST_SOURCE);
    const corrected = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'vitest/coverage', '--json']),
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.find((check) => check.scope === 'app')!.status).toBe('passed');
    expect(await readFile(source, 'utf8')).toBe(VITEST_SOURCE);
});

test.each([80, 0])('vitest/coverage with a %i limit runs without its coverage package only at 0', async (limit) => {
    await using sandbox = await testdir(vitestProjectFiles);

    await createFileTree(join(sandbox.path, 'app'), vitestProjectFiles);
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await rm(join(sandbox.path, 'node_modules/@vitest/coverage-v8'));
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['typescript', 'vitest'], {
            level: 'all',
            tables:
                (limit === 0 ? COVERAGE_ZERO_LIMITS : COVERAGE_ZERO_LIMITS.replace(/^lines = .*$/mu, 'lines = 80')) +
                `[[scope]]
path = "app"
configurations = ["typescript", "vitest"]
`,
        }),
    );
    const checked = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'vitest/coverage', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(limit === 0 ? 0 : 2);
    const checks = checked.report.checks;
    expect(checks.map((check) => check.scope)).toStrictEqual(['', 'app']);
    for (const check of checks) {
        expect(check.status).toBe(limit === 0 ? 'passed' : 'missing');
        if (limit === 0) expect(check.command?.some((arg) => arg.startsWith('--coverage'))).toBe(false);
        else expect(check.note).toContain('@vitest/coverage-v8');
    }
});
