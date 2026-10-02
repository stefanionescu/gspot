import { test, expect } from 'bun:test';
import { CHECKS } from '#cli/checks/registry.ts';
import { testdir, createFileTree } from 'testdirs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

test('Swift Testing outside test folders reports a sleep and accepts its correction', async () => {
    await using sandbox = await testdir();
    const source = 'import Testing\n@Test func checks() async {\n    try await Task.sleep(for: .seconds(1))\n}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['xctest'], '', 'all'),
        'Examples/Checks.swift': source,
        'AppTests/Helper.swift': 'func waits() { sleep(1) }\n',
    });
    const command = ['check', '--only', 'xctest/no-sleep', '--json'];
    const broken = await runGspot(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect((JSON.parse(broken.stdout) as RunReport).checks[0]!.findings).toStrictEqual([
        containing({ file: 'Examples/Checks.swift', rule: 'sleep', line: 3 }),
    ]);
    await Bun.write(
        `${sandbox.path}/Examples/Checks.swift`,
        source.replace('try await Task.sleep(for: .seconds(1))', '#expect(true)'),
    );
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'xctest/no-sleep', status: 'ok', findings: [] },
    ]);
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
        'gspot.toml': policyOf(['xctest']),
        'Examples/Checks.swift': `import Testing\nfunc checks() throws {\n    ${body}\n}\n`,
    });
    const result = await executeRun(await openSession(sandbox.path), {
        checks: CHECKS,
        stage: 'all',
        only: ['xctest/disabled'],
        skips: [],
        fix: false,
        isDryRun: false,
    });
    const findings = result.report.checks.flatMap((check) => check.findings);
    expect(result.report.exitCode).toBe(missing ? 1 : 0);
    expect(result.report.checks).toMatchObject([{ check: 'xctest/disabled', status: missing ? 'fail' : 'ok' }]);
    expect(findings).toMatchObject(missing ? [{ file: 'Examples/Checks.swift', rule: 'disabled', line: 3 }] : []);
});

test('Swift test checks apply sleep allowances in their declared scope', async () => {
    await using sandbox = await testdir();
    const source = 'import Testing\n@Test func checks() { sleep(1) }\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['xctest'],
            '[[scope]]\npath = "integration"\n[scope.tools.xctest]\nsleep_allowed = [{ paths = ["integration/**"], reason = "Integration fixture verifies a native timeout." }]\n',
            'all',
        ),
        'Examples/Checks.swift': source,
        'integration/Checks.swift': source,
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'xctest/no-sleep', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(
        (JSON.parse(result.stdout) as RunReport).checks.map((check) => ({
            scope: check.scope,
            findings: check.findings,
        })),
    ).toStrictEqual([
        { scope: '', findings: [containing({ file: 'Examples/Checks.swift', rule: 'sleep' })] },
        { scope: 'integration', findings: [] },
    ]);
});
test.each([
    { check: 'xctest/no-sleep', body: 'let example = "Task.sleep(1)"', count: 0 },
    { check: 'xctest/no-sleep', body: 'Task<Never, Never>.sleep(nanoseconds: 1)', count: 1 },
    { check: 'xctest/no-sleep', body: 'Thread\n.sleep(forTimeInterval: 1)', count: 1 },
    { check: 'xctest/recording', body: 'let example = "isRecording = true"', count: 0 },
    { check: 'xctest/recording', body: 'SnapshotTesting.isRecording = true', count: 1 },
    { check: 'xctest/recording', body: 'withSnapshotTesting(record:\n.all) {}', count: 1 },
])('Swift syntax controls $check for $body', async ({ check, body, count }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['xctest'], '', 'all'),
        'Examples/Checks.swift': `import Testing\n@Test func checks() {\n    ${body}\n}\n`,
    });
    const result = await executeRun(await openSession(sandbox.path), {
        checks: CHECKS,
        stage: 'all',
        only: [check],
        skips: [],
        fix: false,
        isDryRun: false,
    });
    expect(result.report.exitCode).toBe(count > 0 ? 1 : 0);
    expect(result.report.checks).toMatchObject([{ check, status: count > 0 ? 'fail' : 'ok' }]);
    expect(result.report.checks.flatMap((entry) => entry.findings)).toHaveLength(count);
    // A reported body is corrected and inspected again; a clean body already stands as the corrected run.
    if (count > 0)
        await Bun.write(
            `${sandbox.path}/Examples/Checks.swift`,
            `import Testing\n@Test func checks() {\n    #expect(true)\n}\n`,
        );
    const corrected =
        count > 0
            ? await executeRun(await openSession(sandbox.path), {
                  checks: CHECKS,
                  stage: 'all',
                  only: [check],
                  skips: [],
                  fix: false,
                  isDryRun: false,
              })
            : result;
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check, status: 'ok', findings: [] }]);
});

test('snapshot layouts match semantic owners by path and respect nested scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['xctest'],
            '[[scope]]\npath = "custom"\n[scope.tools.xctest]\nreference_layout = "References/{file}-{test}.png"\n',
            'all',
        ),
        'first/Checks.swift': 'import Testing\n@Test func title() {}\n',
        'first/__Snapshots__/Checks/title.1.png': 'png',
        'second/Checks.swift': 'struct Checks {}\n',
        'second/__Snapshots__/Checks/title.1.png': 'png',
        'custom/Checks.swift': 'import XCTest\n',
        'custom/References/Checks-title.png': 'png',
        'custom/References/Checks-title-dark.png': 'png',
        'custom/Multi-Part.swift': 'import Testing\n',
        'custom/References/Multi-Part-title-dark.png': 'png',
        'custom/References/Missing-title.png': 'png',
    });
    const command = ['check', '--only', 'xctest/reference-images', '--json'];
    const broken = await runGspot(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(
        (JSON.parse(broken.stdout) as RunReport).checks.map((check) => ({
            scope: check.scope,
            findings: check.findings,
        })),
    ).toStrictEqual([
        { scope: '', findings: [containing({ file: 'second/__Snapshots__/Checks/title.1.png' })] },
        { scope: 'custom', findings: [containing({ file: 'custom/References/Missing-title.png' })] },
    ]);
    await Bun.write(`${sandbox.path}/second/Checks.swift`, 'import Testing\n@Test func title() {}\n');
    await Bun.write(`${sandbox.path}/custom/Missing.swift`, 'import XCTest\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each([
    '../{file}/{test}.*',
    '/{file}/{test}.*',
    '__Snapshots__/{file}.*',
    '{file}/{file}/{test}',
    '{file}/{test}/{other}',
])('invalid snapshot layout is a policy error: %s', async (layout) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['xctest'], `[tools.xctest]\nreference_layout = ${JSON.stringify(layout)}\n`),
        'Checks.swift': 'import Testing\n',
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'xctest/reference-images']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(result.stdout + result.stderr).toContain('reference_layout');
    await Bun.write(`${sandbox.path}/gspot.toml`, policyOf(['xctest'], '', 'all'));
    await Bun.write(`${sandbox.path}/__Snapshots__/Checks/example.png`, new Uint8Array([0, 1, 2]));
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'xctest/reference-images', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'xctest/reference-images', status: 'ok', findings: [] },
    ]);
});
