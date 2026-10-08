// Test repository for the xctest configuration: a skipped test with no reason and a sleep.
import { planRun } from '#cli/planning/plan.ts';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runGspot, spawnGspot } from '#tests/harness/gspot.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { REPOSITORY } from '#tests/config/cli/checks/tool/xctest/source.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';

describe('the xctest configuration', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        testRepository = resources.use(await createTestRepository(REPOSITORY, runGspot));
    });
    afterAll(async () => {
        await resources.disposeAsync();
    });

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
        'gspot.toml': buildPolicy(['swift', 'xctest'], { tables: '[scope."apps/second"]\n' }),
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
