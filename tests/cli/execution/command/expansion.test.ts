import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { unlinkSync, symlinkSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { substitute, commandConfigurations } from '#cli/execution/command/placeholders.ts';

test('nested configuration inputs stop at the declared scope and reject ancestors linked outside the repository', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift'], { tables: '[[scope]]\npath = "app"\n' }),
        '.swiftlint.yml': 'disabled_rules: []\n',
        'app/.swiftlint.yml': 'disabled_rules: []\n',
        'app/Sources/.swiftlint.yml': 'disabled_rules: []\n',
        'app/Sources/Feature/One.swift': 'let one = 1\n',
        'app/Sources/Feature/Two.swift': 'let two = 2\n',
        'app/Other/.swiftlint.yml': 'disabled_rules: []\n',
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['swift/swiftlint'] });
    const planned = plans.find((plan) => plan.scope.scope.path === 'app')!;
    expect(commandConfigurations(session, planned)).toStrictEqual([
        '.gspot/config/app/swiftlint.yml',
        'app/.swiftlint.yml',
        'app/Sources/.swiftlint.yml',
    ]);
    await using outside = await testdir();
    await createFileTree(outside.path, { '.swiftlint.yml': 'disabled_rules: []\n' });
    symlinkSync(join(outside.path, '.swiftlint.yml'), join(sandbox.path, 'app/Sources/Feature/.swiftlint.yml'));
    expect(() => commandConfigurations(session, planned)).toThrow(
        'Source link leaves the repository: app/Sources/Feature/.swiftlint.yml',
    );
    unlinkSync(join(sandbox.path, 'app/Sources/Feature/.swiftlint.yml'));
    symlinkSync('../.swiftlint.yml', join(sandbox.path, 'app/Sources/Feature/.swiftlint.yml'));
    expect(commandConfigurations(session, planned)).toStrictEqual([
        '.gspot/config/app/swiftlint.yml',
        'app/.swiftlint.yml',
        'app/Sources/.swiftlint.yml',
        'app/Sources/Feature/.swiftlint.yml',
    ]);
});

test.each([
    { scope: '', expected: [] },
    { scope: 'package', expected: ['--workspace', 'package'] },
    { scope: 'source', expected: [] },
])('workspace expansion retains arguments only for a package scope: $scope', async ({ scope, expected }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift']),
        'Example.swift': 'let example = 1\n',
        'package.json': '{}',
        'package/package.json': '{}',
        'source/Example.swift': 'let source = 2\n',
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['swift/swiftlint'] });
    expect(
        substitute(session, plans[0]!, ['before', '{workspace:--workspace}', 'after'], {
            files: [],
            scope,
            root: sandbox.path,
            indent: 4,
        }),
    ).toStrictEqual(['before', ...expected, 'after']);
});

test('command execution reads linked authored configs and preserves strict managed-config reads', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['swift']),
        'source.swift': 'let value = 1\n',
        'settings/swiftlint.yml': 'disabled_rules: []\n',
        '.gspot/config/swiftlint.yml': 'disabled_rules: []\n',
    });
    symlinkSync('settings/swiftlint.yml', join(sandbox.path, '.swiftlint.yml'));
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'commit', skips: [], only: ['swift/swiftlint'] })[0]!;
    planned.check = {
        ...planned.check,
        command: [process.execPath, '-e', 'process.exitCode = 0'],
        output: { format: 'lines' },
    };
    planned.tool = { name: process.execPath, installers: {}, kind: 'binary' };
    const result = await runCheckCommand(session, planned);
    expect(result.status, result.note).toBe('passed');
    expect(result.findings).toStrictEqual([]);
    unlinkSync(join(sandbox.path, '.gspot/config/swiftlint.yml'));
    symlinkSync('../../settings/swiftlint.yml', join(sandbox.path, '.gspot/config/swiftlint.yml'));
    expect(await rejection(runCheckCommand(session, planned))).toContain('private regular file');
    expect(await Bun.file(join(sandbox.path, 'settings/swiftlint.yml')).text()).toBe('disabled_rules: []\n');
});
