// Test repository for the xctest configuration: a skipped test with no reason, a sleep, a recording snapshot test, and references with no test.
import { planRun } from '#cli/planning/plan.ts';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { hasLinuxDocker } from '#tests/harness/docker.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runGspot, spawnGspot } from '#tests/harness/gspot.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { CASES, REPOSITORY } from '#tests/config/cli/checks/tool/xctest/source.ts';

describe('the xctest configuration', () => {
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

    test('the commit stage leaves the coverage run to its own stage', async () => {
        const { root, environment } = testRepository;
        gitOutput(root, ['add', '--all']);
        const selected = ['xctest/disabled', 'xctest/coverage'];
        const checked = await spawnGspot(
            root,
            ['check', '--hook', 'pre-commit', '--only', ...selected, '--json'],
            environment,
        );
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const ids = (JSON.parse(checked.stdout) as RunReport).checks.map((check) => check.check);
        expect(ids).toStrictEqual(['xctest/disabled']);
        const pushed = planRun(await openSession(root), { stage: 'push', skips: [], only: selected });
        expect(pushed.map(({ check }) => check.name)).toStrictEqual(['xctest/coverage']);
    });
});

test('Swift checks report each scope independently and file-list inputs omit sibling sources', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift', 'xctest'], { tables: '[[scope]]\npath = "apps/second"\n' }),
        'Tests/RootTests.swift': 'import XCTest\nfunc testRoot() throws { throw XCTSkip() }\n',
        'apps/second/Tests/SecondTests.swift': 'import XCTest\nfunc testSecond() throws { throw XCTSkip() }\n',
    });
    const failed = await runGspot(sandbox.path, ['check', '--only', 'xctest/disabled', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks.map((check) => ({
            scope: check.scope,
            files: check.findings.map((finding) => finding.file),
        })),
    ).toStrictEqual([
        { scope: '', files: ['Tests/RootTests.swift'] },
        { scope: 'apps/second', files: ['apps/second/Tests/SecondTests.swift'] },
    ]);
    await Bun.write(
        `${sandbox.path}/Tests/RootTests.swift`,
        'import XCTest\nfunc testRoot() throws { throw XCTSkip("Requires a physical device") }\n',
    );
    await Bun.write(
        `${sandbox.path}/apps/second/Tests/SecondTests.swift`,
        'import XCTest\nfunc testSecond() throws { throw XCTSkip("Requires a physical device") }\n',
    );
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'xctest/disabled', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
