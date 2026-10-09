// The built-in dependency checks on a sandbox, run in-process: install policy, lockfile hosts, and manifests.
import { join } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runCheckCase } from '#tests/harness/check-case.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { createTestRepository, prepareCliRepository } from '#tests/harness/repository.ts';
import { INVALID, REPOSITORY, SEVEN_DAYS_S } from '#tests/config/cli/checks/general/dependencies/policy.ts';

describe('the dependencies configuration', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        testRepository = resources.use(await createTestRepository(REPOSITORY, runGspot, prepareCliRepository));
    });
    afterAll(async () => {
        await resources.disposeAsync();
    });

    test.each(INVALID)('invalid manifest $files refuses execution and accepts a valid manifest', async (invalid) => {
        const { root, environment } = testRepository;
        const outcome = await runCheckCase(root, invalid, environment, runGspot);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(2);
        expect(outcome.stdout + outcome.stderr).toContain(invalid.expected);
        const corrected = await checkReport(root, ['check', '--only', invalid.check, '--json'], environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.report.checks).toMatchObject([{ check: invalid.check, status: 'passed', findings: [] }]);
    });
});

test.each(['bun.lock', 'bun.lockb'])(
    'Bun policy reports a missing bunfig.toml for %s and passes after the fix',
    async (lockfile) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['dependencies'], { level: 'all' }),
            [lockfile]: 'fixture lockfile bytes',
        });
        const failed = await checkReport(sandbox.path, ['check', '--only', 'dependencies/bun-release-age', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.checks).toMatchObject([
            { status: 'failed', findings: [{ file: 'bunfig.toml', line: 1, rule: 'release-age' }] },
        ]);
        await Bun.write(join(sandbox.path, 'bunfig.toml'), `[install]\nminimumReleaseAge = ${SEVEN_DAYS_S}\n`);
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

test('Bun release-age policy reads each project scope and keeps findings inside the deficient scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            level: 'all',
            tables: '[scope."apps/first"]\nconfigurations = ["dependencies"]\n[scope."apps/second"]\nconfigurations = ["dependencies"]\n[scope."apps/second".dependencies]\nmin_release_age_days = 14\n',
        }),
        'apps/first/bun.lock': '{}\n',
        'apps/first/bunfig.toml': `[install]\nminimumReleaseAge = ${SEVEN_DAYS_S}\n`,
        'apps/second/bun.lockb': 'fixture lockfile bytes',
        'apps/second/bunfig.toml': `[install]\nminimumReleaseAge = ${SEVEN_DAYS_S}\n`,
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

test('private Bun tool lockfiles do not activate the repository release-age or advisory checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['dependencies'], { level: 'all' }),
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
