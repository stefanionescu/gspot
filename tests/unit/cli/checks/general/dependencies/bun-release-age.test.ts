import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { containingAll } from '#tests/setup/matchers.ts';
import { BUN_RELEASE_AGE_CASES, SEVEN_DAYS_IN_SECONDS, DEPENDENCIES_REPOSITORY } from '#tests/config/dependencies.ts';

test.each(['bun.lock', 'bun.lockb'])(
    'Bun release-age reports a missing bunfig.toml for %s and passes after the fix',
    async (lockfile) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['dependencies'], { level: 'all' }),
            [lockfile]: 'sample lockfile bytes',
        });
        const failed = await checkReport(sandbox.path, ['check', '--only', 'dependencies/bun-release-age', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.checks).toMatchObject([
            { status: 'failed', findings: [{ file: 'bunfig.toml', line: 1, rule: 'release-age' }] },
        ]);
        await Bun.write(join(sandbox.path, 'bunfig.toml'), `[install]\nminimumReleaseAge = ${SEVEN_DAYS_IN_SECONDS}\n`);
        const corrected = await checkReport(sandbox.path, [
            'check',
            '--only',
            'dependencies/bun-release-age',
            '--json',
        ]);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    },
);

test('Bun release-age reads each project scope and keeps findings inside the deficient scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], {
            level: 'all',
            tables: '[[scope]]\npath = "apps/first"\nconfigurations = ["dependencies"]\n[[scope]]\npath = "apps/second"\nconfigurations = ["dependencies"]\n[scope.dependencies]\nmin_release_age_days = 14\n',
        }),
        'apps/first/bun.lock': '{}\n',
        'apps/first/bunfig.toml': `[install]\nminimumReleaseAge = ${SEVEN_DAYS_IN_SECONDS}\n`,
        'apps/second/bun.lockb': 'sample lockfile bytes',
        'apps/second/bunfig.toml': `[install]\nminimumReleaseAge = ${SEVEN_DAYS_IN_SECONDS}\n`,
    });
    const failed = await checkReport(sandbox.path, ['check', '--only', 'dependencies/bun-release-age', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { scope: 'apps/first', status: 'passed', findings: [] },
        {
            scope: 'apps/second',
            status: 'failed',
            findings: [{ file: 'apps/second/bunfig.toml', rule: 'release-age' }],
        },
    ]);
    await Bun.write(join(sandbox.path, 'apps/second/bunfig.toml'), '[install]\nminimumReleaseAge = 1209600\n');
    const corrected = await checkReport(sandbox.path, ['check', '--only', 'dependencies/bun-release-age', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.every((check) => check.status === 'passed')).toBe(true);
});

test('a lockfile under .gspot/ starts neither bun-release-age nor osv', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['dependencies'], { level: 'all' }),
        '.gspot/bun.lock': '{}\n',
    });
    const checked = await checkReport(sandbox.path, [
        'check',
        '--only',
        'dependencies/bun-release-age',
        'dependencies/osv',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const report = checked.report;
    expect(report.checks).toStrictEqual([]);
    expect(report.skips).toEqual(
        containingAll([
            expect.objectContaining({ check: 'dependencies/bun-release-age', cause: 'inputs' }),
            expect.objectContaining({ check: 'dependencies/osv', cause: 'inputs' }),
        ]),
    );
});

for (const entry of BUN_RELEASE_AGE_CASES) {
    test(entry.check + ' reports ' + entry.expected.rule + ' and passes after the fix', async () => {
        await using sandbox = await createSandbox(DEPENDENCIES_REPOSITORY);
        await runCheckSample(sandbox, entry, DEPENDENCIES_REPOSITORY);
    });
}
