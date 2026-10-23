import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { GROUPED_PBXPROJ, SINGLE_FILE_PBXPROJ } from '#tests/config/checks/infrastructure/xcode.ts';

test('Xcode sources follow group paths and target membership instead of duplicate filenames', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['xcode'], { level: 'all' }),
        'App.xcodeproj/project.pbxproj': GROUPED_PBXPROJ,
        'First Group/Shared.swift': 'let first = 1\n',
        'Second/Shared.swift': 'let second = 2\n',
        'Root.swift': 'let root = 1\n',
        'Synced/Included.swift': 'let included = 1\n',
        'Synced/Excluded.swift': 'let excluded = 1\n',
    });

    const broken = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['xcode/files-without-target'] }),
    );

    expect(broken.report.checks[0]!.findings).toStrictEqual([
        matchFields({ file: 'Second/Shared.swift', rule: 'untargeted' }),
        matchFields({ file: 'Synced/Excluded.swift', rule: 'untargeted' }),
    ]);
});

test('membership combines projects in a scope and checks nested scopes independently', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['xcode'], { scopes: [{ path: 'nested' }] }),
        'One.xcodeproj/project.pbxproj': SINGLE_FILE_PBXPROJ.replace('path = Root.swift;', 'path = One.swift;'),
        'Two.xcodeproj/project.pbxproj': SINGLE_FILE_PBXPROJ.replace('path = Root.swift;', 'path = Two.swift;'),
        'One.swift': 'let one = 1\n',
        'Two.swift': 'let two = 2\n',
        'nested/App.xcodeproj/project.pbxproj': SINGLE_FILE_PBXPROJ.replace(
            'path = Root.swift;',
            'path = Nested.swift;',
        ),
        'nested/Nested.swift': 'let nested = 1\n',
        'nested/Extra.swift': 'let verbatim = 1\n',
    });

    const broken = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['xcode/files-without-target'] }),
    );

    expect(broken.report.checks.map(({ scope, findings }) => ({ scope, findings }))).toStrictEqual([
        { scope: '', findings: [] },
        { scope: 'nested', findings: [matchFields({ file: 'nested/Extra.swift', rule: 'untargeted' })] },
    ]);
});
