import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { linkInstalledModules } from '#tests/setup/modules.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { COVERAGE_ZERO_LIMITS } from '#tests/data/checks/coverage.ts';
import vitestManifest from 'vitest/package.json' with { type: 'json' };
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

import {
    VITEST_CASES,
    VITEST_SOURCE,
    VITEST_PACKAGE,
    VITEST_SANDBOX,
    UNTESTED_SOURCE,
} from '#tests/data/checks/vitest.ts';

const vitestProjectFiles = {
    ...VITEST_SANDBOX.files,
    'package.json': JSON.stringify({ ...VITEST_PACKAGE, devDependencies: { vitest: vitestManifest.version } }) + '\n',
};

test('vitest/coverage reports a coverage limit and passes after the fix, in the root and a scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, vitestProjectFiles);
    await createFileTree(join(sandbox.path, 'app'), vitestProjectFiles);
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildSettingsText(['typescript', 'vitest'], {
            level: 'all',
            tables: `[coverage]
lines = 100
functions = 100
[[scope]]
path = "app"

configurations = ["typescript", "vitest"]
`,
        }),
    );
    const source = join(sandbox.path, 'app/src/public.ts');
    await Bun.write(source, UNTESTED_SOURCE);
    const failed = await spawnGspot(sandbox.path, ['check', '--only', 'vitest/coverage', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const failedScope = (JSON.parse(failed.stdout) as RunReport).checks.find((check) => check.scope === 'app')!;
    expect(failedScope.status).toBe('failed');
    expect(failedScope.findings.some((finding) => finding.message.includes('100%'))).toBe(true);
    expect(await Bun.file(source).text()).toBe(UNTESTED_SOURCE);
    await Bun.write(source, VITEST_SOURCE);
    const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'vitest/coverage', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks.find((check) => check.scope === 'app')!.status).toBe(
        'passed',
    );
    expect(await Bun.file(source).text()).toBe(VITEST_SOURCE);
});

test.each([80, 0])('vitest/coverage with a %i limit runs without its coverage package only at 0', async (limit) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, vitestProjectFiles);
    await createFileTree(join(sandbox.path, 'app'), vitestProjectFiles);
    await linkInstalledModules(join(sandbox.path, 'node_modules'));
    await rm(join(sandbox.path, 'node_modules/@vitest/coverage-v8'));
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildSettingsText(['typescript', 'vitest'], {
            level: 'all',
            tables:
                (limit === 0 ? COVERAGE_ZERO_LIMITS : COVERAGE_ZERO_LIMITS.replace(/^lines = .*$/mu, 'lines = 80')) +
                `[[scope]]
path = "app"
configurations = ["typescript", "vitest"]
`,
        }),
    );
    const checked = await spawnGspot(sandbox.path, ['check', '--only', 'vitest/coverage', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(limit === 0 ? 0 : 2);
    const checks = (JSON.parse(checked.stdout) as RunReport).checks;
    expect(checks.map((check) => check.scope)).toStrictEqual(['', 'app']);
    for (const check of checks) {
        expect(check.status).toBe(limit === 0 ? 'passed' : 'missing');
        if (limit === 0) expect(check.command?.some((arg) => arg.startsWith('--coverage'))).toBe(false);
        else expect(check.note).toContain('@vitest/coverage-v8');
    }
});

const coverageSandbox = registerSharedSandbox({
    install: false,
    ...VITEST_SANDBOX,
    dependencies: { vitest: vitestManifest.version },
});
for (const entry of VITEST_CASES) {
    test(`${entry.check} reports uncovered code and passes after the fix`, async () => {
        const result = await runCheckSample(coverageSandbox(), entry, VITEST_SANDBOX);
        expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
    });
}
