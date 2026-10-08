import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runFindingCase } from '#tests/harness/check-case.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { detectUnselected } from '#cli/configurations/detect.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { recording } from '#cli/checks/library/swift-snapshot-testing.ts';

import {
    CASES,
    REPOSITORY,
    PACKAGE_PROJECTS,
    DOCUMENTATION_LEVELS,
} from '#tests/config/cli/checks/library/swift-snapshot-testing.ts';

test.each([
    { body: 'let example = "isRecording = true"', count: 0 },
    { body: 'SnapshotTesting.isRecording = true', count: 1 },
    { body: 'withSnapshotTesting(record:\n.all) {}', count: 1 },
])('SnapshotTesting syntax determines recording: $body', async ({ body, count }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift-snapshot-testing']),
        'Examples/Checks.swift': `import Testing\n@Test func checks() {\n    ${body}\n}\n`,
    });
    const session = await openSession(sandbox.path);
    const findings = await recording(buildCheckInput(session, 'swift-snapshot-testing/recording'));
    expect(findings).toHaveLength(count);
    if (count > 0) expect(findings[0]).toMatchObject({ file: 'Examples/Checks.swift', line: 3 });
});

test('snapshot references name semantic test owners and respect nested scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift-snapshot-testing'], {
            tables: '[scope.custom]\n',
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
    const broken = await runGspot(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(
        (JSON.parse(broken.stdout) as RunReport).checks.map((check) => ({
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

test('the default snapshot layout accepts a matching source and reference', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift-snapshot-testing'], { level: 'all' }),
        'Checks.swift': 'import Testing\n',
        '__Snapshots__/Checks/example.png': new Uint8Array([0, 1, 2]),
    });
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'swift-snapshot-testing/references', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'swift-snapshot-testing/references', status: 'passed', findings: [] },
    ]);
    expect(
        new Uint8Array(await Bun.file(join(sandbox.path, '__Snapshots__/Checks/example.png')).arrayBuffer()),
    ).toStrictEqual(new Uint8Array([0, 1, 2]));
    expect(await Bun.file(join(sandbox.path, 'Checks.swift')).text()).toBe('import Testing\n');
});

test('disabled tests and snapshot recording report through the CLI and pass after the fixes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xctest', 'swift-snapshot-testing'], { level: 'all' }),
        'Examples/Checks.swift':
            'import Testing\n@Test func checks() throws {\n    try XCTSkip("")\n    SnapshotTesting.isRecording = true\n}\n',
    });
    const command = ['check', '--only', 'xctest/disabled', 'swift-snapshot-testing/recording', '--json'];
    const broken = await runGspot(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect((JSON.parse(broken.stdout) as RunReport).checks).toMatchObject([
        {
            check: 'xctest/disabled',
            status: 'failed',
            findings: [{ file: 'Examples/Checks.swift', rule: 'disabled', line: 3 }],
        },
        {
            check: 'swift-snapshot-testing/recording',
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
        { check: 'swift-snapshot-testing/recording', status: 'passed', findings: [] },
    ]);
});

test.each(CASES)('$check reports its finding and passes after the fix', async (entry) => {
    await using repository = await createTestRepository(REPOSITORY, runGspot);
    const { failed, passed } = await runFindingCase(repository, entry, REPOSITORY);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
    expect(failed.report.checks[0]?.findings).toContainEqual(containing({ check: entry.check, ...entry.expected }));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(passed.report.checks).toMatchObject([{ check: entry.check, status: 'passed', findings: [] }]);
});

test.each(PACKAGE_PROJECTS)(
    'the package dependency proposes the snapshot configuration: $selected',
    async ({ source, selected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['swift']),
            'Package.swift': source,
            'Tests/Checks.swift': 'import XCTest\n',
        });
        const session = await openSession(sandbox.path);
        expect(
            detectUnselected(
                sandbox.path,
                session.repository.files,
                session.manifests,
                session.scopes.flatMap(({ selected }) => selected),
            ).some(({ configuration }) => configuration === 'swift-snapshot-testing'),
        ).toBe(selected);
        const planned = planRun(session, { stage: 'commit', skips: [], only: ['swift-snapshot-testing/recording'] });
        expect(planned).toStrictEqual([]);
        expect(
            session.manifests
                .get('xctest')
                ?.checks.some(({ name }) => name === 'xctest/recording' || name === 'xctest/references'),
        ).toBe(false);
        expect(await Bun.file(join(sandbox.path, 'Package.swift')).text()).toBe(source);
    },
);

test.each(DOCUMENTATION_LEVELS)('the selected snapshot library ships checks at %s', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift-snapshot-testing'], { level }),
        'Tests/Checks.swift': 'import XCTest\n',
        'Tests/__Snapshots__/Checks/example.png': new Uint8Array([0, 1, 2]),
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, {
        stage: 'commit',
        skips: [],
        only: ['swift-snapshot-testing/recording', 'swift-snapshot-testing/references'],
    });
    expect(planned.map(({ check }) => check.name)).toStrictEqual(
        level === 'all'
            ? ['swift-snapshot-testing/recording', 'swift-snapshot-testing/references']
            : ['swift-snapshot-testing/recording'],
    );
});
