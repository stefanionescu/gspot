// The built-in dependency checks on a test repository, run in-process: install policy, lockfile hosts, and manifests.
import { join } from 'node:path';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import { containing, containingAll } from '#tests/harness/expectations.ts';
import { runCheckCase, runFindingCase } from '#tests/harness/check-case.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, INVALID, REPOSITORY } from '#tests/config/cli/checks/general/dependencies/policy.ts';

describe('the dependencies configuration', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(REPOSITORY, runGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });
    for (const entry of CASES) {
        const where = [entry.expected.rule, entry.expected.file].filter(Boolean).join(' in ');
        const isElsewhere = entry.platforms !== undefined && !entry.platforms.includes(process.platform);
        test.skipIf(isElsewhere || (entry.docker === true && !hasLinuxDocker()))(
            `${entry.check} reports ${where} and accepts the correction`,
            async () => {
                const { failed: outcome, passed: correction } = await runFindingCase(testRepository, entry, REPOSITORY);
                expect(outcome.code, `${entry.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
                expect(outcome.report.checks[0]?.findings).toContainEqual(
                    containing({ check: entry.check, ...entry.expected }),
                );
                expect(correction.code, `${entry.check} corrected: ${correction.stdout}${correction.stderr}`).toBe(0);
                expect(correction.report.checks).toMatchObject([
                    { check: entry.check, status: 'passed', findings: [] },
                ]);
            },
            suiteTimeout(),
        );
    }

    test.each(INVALID)('invalid manifest $files refuses execution and accepts a valid manifest', async (invalid) => {
        const { root, environment } = testRepository;
        const outcome = await runCheckCase(root, invalid, environment, runGspot);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(2);
        expect(outcome.stdout + outcome.stderr).toContain(invalid.expected);
        const corrected = await runGspot(root, ['check', '--only', invalid.check, '--json'], environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: invalid.check, status: 'passed', findings: [] },
        ]);
    });
});

test.each(['bun.lock', 'bun.lockb'])(
    'Bun policy reports a missing bunfig.toml for %s and accepts its correction',
    async (lockfile) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['dependencies'], { level: 'all' }),
            [lockfile]: 'fixture lockfile bytes',
        });
        const failed = await runGspot(sandbox.path, ['check', '--only', 'dependencies/bun-release-age', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([
            { status: 'failed', findings: [{ file: 'bunfig.toml', line: 1, rule: 'release-age' }] },
        ]);
        await Bun.write(join(sandbox.path, 'bunfig.toml'), '[install]\nminimumReleaseAge = 604800\n');
        const corrected = await runGspot(sandbox.path, ['check', '--only', 'dependencies/bun-release-age', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
    },
);

test('Bun release-age policy reads each project scope and keeps findings inside the deficient scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            level: 'all',
            tables: '[[scope]]\npath = "apps/first"\nconfigurations = ["dependencies"]\n[[scope]]\npath = "apps/second"\nconfigurations = ["dependencies"]\n[scope.dependencies]\nmin_release_age_days = 14\n',
        }),
        'apps/first/bun.lock': '{}\n',
        'apps/first/bunfig.toml': '[install]\nminimumReleaseAge = 604800\n',
        'apps/second/bun.lockb': 'fixture lockfile bytes',
        'apps/second/bunfig.toml': '[install]\nminimumReleaseAge = 604800\n',
    });
    const failed = await runGspot(sandbox.path, ['check', '--only', 'dependencies/bun-release-age', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([
        { scope: 'apps/first', status: 'passed', findings: [] },
        {
            scope: 'apps/second',
            status: 'failed',
            findings: [{ file: 'apps/second/bunfig.toml', rule: 'release-age' }],
        },
    ]);
    await Bun.write(join(sandbox.path, 'apps/second/bunfig.toml'), '[install]\nminimumReleaseAge = 1209600\n');
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'dependencies/bun-release-age', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks.every((check) => check.status === 'passed')).toBe(true);
});

test('private Bun tool lockfiles do not activate the repository release-age or advisory checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['dependencies'], { level: 'all' }),
        '.gspot/bun.lock': '{}\n',
    });
    const checked = await runGspot(sandbox.path, [
        'check',
        '--only',
        'dependencies/bun-release-age',
        'dependencies/osv',
        '--json',
    ]);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(report.checks).toStrictEqual([]);
    expect(report.skips).toEqual(
        containingAll([
            expect.objectContaining({ check: 'dependencies/bun-release-age', cause: 'inputs' }),
            expect.objectContaining({ check: 'dependencies/osv', cause: 'inputs' }),
        ]),
    );
});
