import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { checkInput } from '#cli/execution/contracts.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { containing } from '#tests/harness/expectations.ts';
import { BUILT_IN_CALCULATIONS } from '#cli/checks/public.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import { XCTEST_FILES } from '#tests/config/cli/checks/tool/swift-tests/sources.ts';
import { createTestRepository, prepareCliRepository } from '#tests/harness/repository.ts';

test('Swift Testing outside test folders reports a sleep and passes after the fix', async () => {
    await using sandbox = await testdir();
    const source = 'import Testing\n@Test func checks() async {\n    try await Task.sleep(for: .seconds(1))\n}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift-tests'], { level: 'all' }),
        'Examples/Checks.swift': source,
        'AppTests/Helper.swift': 'func waits() { sleep(1) }\n',
    });
    const command = ['check', '--only', 'swift-tests/sleep', '--json'];
    const broken = await checkReport(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks[0]!.findings).toStrictEqual([
        containing({ file: 'Examples/Checks.swift', rule: 'sleep', line: 3 }),
    ]);
    await Bun.write(
        `${sandbox.path}/Examples/Checks.swift`,
        source.replace('try await Task.sleep(for: .seconds(1))', '#expect(true)'),
    );
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'swift-tests/sleep', status: 'passed', findings: [] }]);
});

test.each([
    { body: 'try XCTSkip()', missing: true },
    { body: 'try XCTSkip("")', missing: true },
    { body: 'try XCTSkip("   ")', missing: true },
    { body: 'try XCTSkip(nil)', missing: true },
    { body: 'try XCTSkip("CI")', missing: false },
    { body: 'print("unrelated long string"); try XCTSkipIf(true, "")', missing: true },
    { body: 'try XCTSkipIf(condition("unrelated long string"))', missing: true },
    { body: 'try XCTSkipUnless(true, "Requires a simulator")', missing: false },
    { body: 'service.disabled(if: true)', missing: false },
    { body: 'let trait = .disabled(if: true, "")', missing: true },
    { body: 'let trait = .disabled(if: true, "Requires a simulator")', missing: false },
    { body: '@available(*, unavailable, message: "")\nfunc unavailableTest() {}', missing: true },
    { body: '@available(*, unavailable, message: "Requires a simulator")\nfunc unavailableTest() {}', missing: false },
    { body: 'let example = "XCTSkip()"\n/* XCTSkip() */\n// XCTSkip()', missing: false },
])('Swift skip reason belongs to its argument: $body', async ({ body, missing }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift-tests']),
        'Examples/Checks.swift': `import Testing\nfunc checks() throws {\n    ${body}\n}\n`,
    });
    const session = await openSession(sandbox.path);
    const findings = await BUILT_IN_CALCULATIONS['swift-tests/skip-reasons'](
        buildCheckInput(session, 'swift-tests/skip-reasons'),
    );
    expect(findings.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual(
        missing ? [{ file: 'Examples/Checks.swift', rule: 'disabled', line: 3 }] : [],
    );
});

test('Swift test checks apply sleep allowances in their declared scope', async () => {
    await using sandbox = await testdir();
    const source = 'import Testing\n@Test func checks() { sleep(1) }\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift-tests'], {
            tables: '[scope."integration"]\n[[ignore]]\ncheck = "swift-tests/sleep"\npaths = ["integration/**"]\nreason = "The integration sandbox verifies a native timeout."\n',
            level: 'all',
        }),
        'Examples/Checks.swift': source,
        'integration/Checks.swift': source,
    });
    const result = await checkReport(sandbox.path, ['check', '--only', 'swift-tests/sleep', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(
        result.report.checks.map((check) => ({
            scope: check.scope,
            findings: check.findings,
        })),
    ).toStrictEqual([
        { scope: '', findings: [containing({ file: 'Examples/Checks.swift', rule: 'sleep' })] },
        { scope: 'integration', findings: [] },
    ]);
});
test.each([
    { check: 'swift-tests/sleep', body: 'let example = "Task.sleep(1)"', count: 0 },
    { check: 'swift-tests/sleep', body: 'Task<Never, Never>.sleep(nanoseconds: 1)', count: 1 },
    { check: 'swift-tests/sleep', body: 'Thread\n.sleep(forTimeInterval: 1)', count: 1 },
])('Swift syntax controls $check for $body', async ({ check, body, count }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift-tests'], { level: 'all' }),
        'Examples/Checks.swift': `import Testing\n@Test func checks() {\n    ${body}\n}\n`,
    });
    const session = await openSession(sandbox.path);
    const findings = await BUILT_IN_CALCULATIONS['swift-tests/sleep'](buildCheckInput(session, check));
    expect(findings).toHaveLength(count);
    if (count > 0) expect(findings[0]).toMatchObject({ file: 'Examples/Checks.swift', line: 3 });
});

test('a sleep path ignore excludes an unreadable file before source parsing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift-tests'], {
            tables: '[scope."integration"]\n[[ignore]]\ncheck = "swift-tests/sleep"\npaths = ["integration/Allowed.swift"]\nreason = "This sandbox checks the native timeout."\n',
            level: 'all',
        }),
        'integration/Allowed.swift': 'import Testing\n@Test func checks() { sleep(1) }\n',
        'integration/Blocked.swift': 'import Testing\n@Test func checks() { sleep(1) }\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', skips: [], only: ['swift-tests/sleep'] });
    const input = checkInput(session, planned.find((entry) => entry.scope.scope.path === 'integration')!);
    expect(input.files.map(({ path }) => path)).not.toContain('integration/Allowed.swift');
    await rm(join(sandbox.path, 'integration/Allowed.swift'));
    const findings = await BUILT_IN_CALCULATIONS['swift-tests/sleep'](input);
    expect(findings.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual([
        { file: 'integration/Blocked.swift', rule: 'sleep', line: 2 },
    ]);
});

test('the commit stage leaves the coverage run to its own stage', async () => {
    await using repository = await createTestRepository(
        { configurations: ['swift-tests'], files: XCTEST_FILES },
        runGspot,
        prepareCliRepository,
    );
    const { root, environment } = repository;
    gitOutput(root, ['add', '--all']);
    const selected = ['swift-tests/skip-reasons', 'swift-tests/coverage'];
    const checked = await checkReport(
        root,
        ['check', '--hook', 'pre-commit', '--only', ...selected, '--json'],
        environment,
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    const ids = checked.report.checks.map((check) => check.check);
    expect(ids).toStrictEqual(['swift-tests/skip-reasons']);
    const pushed = planRun(await openSession(root), { stage: 'push', skips: [], only: selected });
    expect(pushed.map(({ check }) => check.name)).toStrictEqual(['swift-tests/coverage']);
});

test('Swift checks report each scope independently and file-list inputs omit sibling sources', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift', 'swift-tests'], { tables: '[scope."apps/second"]\n' }),
        'Tests/RootTests.swift': 'import XCTest\nfunc testRoot() throws { throw XCTSkip() }\n',
        'apps/second/Tests/SecondTests.swift': 'import XCTest\nfunc testSecond() throws { throw XCTSkip() }\n',
    });
    const failed = await checkReport(sandbox.path, ['check', '--only', 'swift-tests/skip-reasons', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.map((check) => ({
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
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'swift-tests/skip-reasons', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
