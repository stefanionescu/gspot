import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { openSession } from '#cli/commands/session.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { SNAPSHOT_CASES, SNAPSHOT_REPOSITORY, IMAGE_RECORDING_CASES } from '#tests/config/swift/snapshots.ts';

test.each([...IMAGE_RECORDING_CASES])('SnapshotTesting syntax determines recording: $body', async ({ body, count }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['swift-snapshot-testing']),
        'Examples/Checks.swift': `import Testing\n@Test func checks() {\n    ${body}\n}\n`,
    });
    const session = await openSession(sandbox.path);
    const findings = await checkFindings(session.root, 'swift-snapshot-testing/recording');
    expect(findings).toHaveLength(count);
    if (count > 0) expect(findings[0]).toMatchObject({ file: 'Examples/Checks.swift', line: 3 });
});

test('a snapshot folder needs a test file of the same name, in each scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['swift-snapshot-testing'], {
            tables: '[[scope]]\npath = "custom"\n',
            level: 'all',
        }),
        'first/Checks.swift': 'import Testing\n@Test func title() {}\n',
        'first/__Snapshots__/Checks/title.1.png': 'png',
        'second/Checks.swift': 'struct Checks {}\n',
        'second/__Snapshots__/Checks/title.1.png': 'png',
        'custom/Checks.swift': 'import XCTest\n',
        'custom/__Snapshots__/Checks/title.png': 'png',
        'custom/__Snapshots__/Checks/title-dark.png': 'png',
        'custom/Multi-Part.swift': 'import Testing\n',
        'custom/__Snapshots__/Multi-Part/title-dark.png': 'png',
        'custom/__Snapshots__/Missing/title.png': 'png',
    });
    const command = ['check', '--only', 'swift-snapshot-testing/references', '--json'];
    const broken = await checkReport(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(
        broken.report.checks.map((check) => ({
            scope: check.scope,
            findings: check.findings,
        })),
    ).toStrictEqual([
        { scope: '', findings: [containing({ file: 'second/__Snapshots__/Checks/title.1.png' })] },
        { scope: 'custom', findings: [containing({ file: 'custom/__Snapshots__/Missing/title.png' })] },
    ]);
    await Bun.write(`${sandbox.path}/second/Checks.swift`, 'import Testing\n@Test func title() {}\n');
    await Bun.write(`${sandbox.path}/custom/Missing.swift`, 'import XCTest\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
for (const entry of SNAPSHOT_CASES) {
    test(entry.check + ' reports ' + entry.expected.rule + ' and passes after the fix', async () => {
        const plan = { ...SNAPSHOT_REPOSITORY };
        await using sandbox = await createSandbox(plan);
        await runCheckSample(sandbox, entry, plan);
    });
}
