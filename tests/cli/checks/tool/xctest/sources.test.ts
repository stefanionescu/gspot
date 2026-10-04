import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { sleeps, disabled, recording } from '#cli/checks/tool/xctest.ts';

test('Swift Testing outside test folders reports a sleep and accepts its correction', async () => {
    await using sandbox = await testdir();
    const source = 'import Testing\n@Test func checks() async {\n    try await Task.sleep(for: .seconds(1))\n}\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], { level: 'all' }),
        'Examples/Checks.swift': source,
        'AppTests/Helper.swift': 'func waits() { sleep(1) }\n',
    });
    const command = ['check', '--only', 'xctest/sleep', '--json'];
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
        { check: 'xctest/sleep', status: 'passed', findings: [] },
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
        'gspot.toml': buildPolicy(['xctest']),
        'Examples/Checks.swift': `import Testing\nfunc checks() throws {\n    ${body}\n}\n`,
    });
    const session = await openSession(sandbox.path);
    const findings = await disabled(buildEngineInput(session, 'xctest/disabled'));
    expect(findings.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual(
        missing ? [{ file: 'Examples/Checks.swift', rule: 'disabled', line: 3 }] : [],
    );
});

test('Swift test checks apply sleep allowances in their declared scope', async () => {
    await using sandbox = await testdir();
    const source = 'import Testing\n@Test func checks() { sleep(1) }\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], {
            tables: '[[scope]]\npath = "integration"\n[scope.tools.xctest]\nsleep_allowed = [{ paths = ["**"], reason = "Integration fixture verifies a native timeout." }]\n',
            level: 'all',
        }),
        'Examples/Checks.swift': source,
        'integration/Checks.swift': source,
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'xctest/sleep', '--json']);
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
    { check: 'xctest/sleep', body: 'let example = "Task.sleep(1)"', count: 0 },
    { check: 'xctest/sleep', body: 'Task<Never, Never>.sleep(nanoseconds: 1)', count: 1 },
    { check: 'xctest/sleep', body: 'Thread\n.sleep(forTimeInterval: 1)', count: 1 },
    { check: 'xctest/recording', body: 'let example = "isRecording = true"', count: 0 },
    { check: 'xctest/recording', body: 'SnapshotTesting.isRecording = true', count: 1 },
    { check: 'xctest/recording', body: 'withSnapshotTesting(record:\n.all) {}', count: 1 },
])('Swift syntax controls $check for $body', async ({ check, body, count }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], { level: 'all' }),
        'Examples/Checks.swift': `import Testing\n@Test func checks() {\n    ${body}\n}\n`,
    });
    const session = await openSession(sandbox.path);
    const engine = check === 'xctest/sleep' ? sleeps : recording;
    const findings = await engine(buildEngineInput(session, check));
    expect(findings).toHaveLength(count);
    if (count > 0) expect(findings[0]).toMatchObject({ file: 'Examples/Checks.swift', line: 3 });
});

test('snapshot layouts match semantic owners by path and respect nested scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], {
            tables: '[[scope]]\npath = "custom"\n[scope.tools.xctest]\nreference_layout = "References/{file}-{test}.png"\n',
            level: 'all',
        }),
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
    const command = ['check', '--only', 'xctest/references', '--json'];
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
])('invalid snapshot layout reports its setting as a policy finding: %s', async (layout) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], {
            tables: `[tools.xctest]\nreference_layout = ${JSON.stringify(layout)}\n`,
        }),
        'Checks.swift': 'import Testing\n',
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'xctest/references', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = JSON.parse(result.stdout) as RunReport;
    expect(report.checks).toMatchObject([
        { check: 'gspot/policy', status: 'failed', findings: [{ file: 'gspot.toml' }] },
    ]);
    expect(report.checks).not.toContainEqual(expect.objectContaining({ check: 'xctest/references' }));
    expect(report.checks[0]!.findings[0]!.message).toContain('tools.xctest.reference_layout');
    expect(report.checks[0]!.findings[0]!.message).toContain('relative snapshot layout');
    expect(report.checks[0]!.findings[0]!.message).toContain('{file} and {test} exactly once');
});

test('a scoped sleep allowance excludes an unreadable file before source parsing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], {
            tables: '[[scope]]\npath = "integration"\n[scope.tools.xctest]\nsleep_allowed = [{ paths = ["Allowed.swift"], reason = "This fixture checks the native timeout." }]\n',
            level: 'all',
        }),
        'integration/Allowed.swift': 'import Testing\n@Test func checks() { sleep(1) }\n',
        'integration/Blocked.swift': 'import Testing\n@Test func checks() { sleep(1) }\n',
    });
    const session = await openSession(sandbox.path);
    const input = buildEngineInput(session, 'xctest/sleep', { scope: 'integration' });
    expect(input.files.map(({ path }) => path)).toContain('integration/Allowed.swift');
    rmSync(join(sandbox.path, 'integration/Allowed.swift'));
    const findings = await sleeps(input);
    expect(findings.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual([
        { file: 'integration/Blocked.swift', rule: 'sleep', line: 2 },
    ]);
});

test('the default snapshot layout accepts a matching source and reference', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], { level: 'all' }),
        'Checks.swift': 'import Testing\n',
        '__Snapshots__/Checks/example.png': new Uint8Array([0, 1, 2]),
    });
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'xctest/references', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'xctest/references', status: 'passed', findings: [] },
    ]);
});

test('disabled tests and snapshot recording report through the CLI and accept their corrections', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], { level: 'all' }),
        'Examples/Checks.swift':
            'import Testing\n@Test func checks() throws {\n    try XCTSkip("")\n    SnapshotTesting.isRecording = true\n}\n',
    });
    const command = ['check', '--only', 'xctest/disabled', 'xctest/recording', '--json'];
    const broken = await runGspot(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect((JSON.parse(broken.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'xctest/disabled',
            status: 'failed',
            findings: [{ file: 'Examples/Checks.swift', rule: 'disabled', line: 3 }],
        },
        {
            check: 'xctest/recording',
            status: 'failed',
            findings: [{ file: 'Examples/Checks.swift', rule: 'recording', line: 4 }],
        },
    ]);
    await Bun.write(
        join(sandbox.path, 'Examples/Checks.swift'),
        'import Testing\n@Test func checks() throws {\n    try XCTSkip("Requires simulator")\n    SnapshotTesting.isRecording = false\n}\n',
    );
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'xctest/disabled', status: 'passed', findings: [] },
        { check: 'xctest/recording', status: 'passed', findings: [] },
    ]);
});
