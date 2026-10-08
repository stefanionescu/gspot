import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { checkInput } from '#cli/execution/built-in.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { containing } from '#tests/harness/expectations.ts';
import { sleeps, disabled } from '#cli/checks/tool/xctest.ts';
import type { RunReport } from '#cli/types/execution/check.ts';

test('Swift Testing outside test folders reports a sleep and passes after the fix', async () => {
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
    const findings = await disabled(buildCheckInput(session, 'xctest/skip-reasons'));
    expect(findings.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual(
        missing ? [{ file: 'Examples/Checks.swift', rule: 'disabled', line: 3 }] : [],
    );
});

test('Swift test checks apply sleep allowances in their declared scope', async () => {
    await using sandbox = await testdir();
    const source = 'import Testing\n@Test func checks() { sleep(1) }\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], {
            tables: '[scope."integration"]\n[[ignore]]\ncheck = "xctest/sleep"\npaths = ["integration/**"]\nreason = "The integration sandbox verifies a native timeout."\n',
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
])('Swift syntax controls $check for $body', async ({ check, body, count }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], { level: 'all' }),
        'Examples/Checks.swift': `import Testing\n@Test func checks() {\n    ${body}\n}\n`,
    });
    const session = await openSession(sandbox.path);
    const findings = await sleeps(buildCheckInput(session, check));
    expect(findings).toHaveLength(count);
    if (count > 0) expect(findings[0]).toMatchObject({ file: 'Examples/Checks.swift', line: 3 });
});

test('a sleep path ignore excludes an unreadable file before source parsing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest'], {
            tables: '[scope."integration"]\n[[ignore]]\ncheck = "xctest/sleep"\npaths = ["integration/Allowed.swift"]\nreason = "This sandbox checks the native timeout."\n',
            level: 'all',
        }),
        'integration/Allowed.swift': 'import Testing\n@Test func checks() { sleep(1) }\n',
        'integration/Blocked.swift': 'import Testing\n@Test func checks() { sleep(1) }\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', skips: [], only: ['xctest/sleep'] });
    const input = checkInput(session, planned.find((entry) => entry.scope.scope.path === 'integration')!);
    expect(input.files.map(({ path }) => path)).not.toContain('integration/Allowed.swift');
    await rm(join(sandbox.path, 'integration/Allowed.swift'));
    const findings = await sleeps(input);
    expect(findings.map(({ file, rule, line }) => ({ file, rule, line }))).toStrictEqual([
        { file: 'integration/Blocked.swift', rule: 'sleep', line: 2 },
    ]);
});
