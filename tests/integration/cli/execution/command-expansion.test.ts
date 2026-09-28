import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { commandConfigurations, substitute } from '#cli/execution/command-expansion.ts';

test('nested configuration inputs stop at the declared scope and reject linked ancestors', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n[[scope]]\npath = "app"\n',
        '.swiftlint.yml': 'disabled_rules: []\n',
        'app/.swiftlint.yml': 'disabled_rules: []\n',
        'app/Sources/.swiftlint.yml': 'disabled_rules: []\n',
        'app/Sources/Feature/One.swift': 'let one = 1\n',
        'app/Sources/Feature/Two.swift': 'let two = 2\n',
        'app/Other/.swiftlint.yml': 'disabled_rules: []\n',
    });
    const session = await openSession(sandbox.path);
    const plans = await planRun(session, { stage: 'commit', skips: [], only: ['swift/swiftlint'] });
    const planned = plans.find((plan) => plan.scope.scope.path === 'app')!;
    expect(commandConfigurations(session, planned)).toStrictEqual([
        '.gspot/config/app/swiftlint.yml',
        'app/.swiftlint.yml',
        'app/Sources/.swiftlint.yml',
    ]);
    await using outside = await testdir();
    await createFileTree(outside.path, { '.swiftlint.yml': 'disabled_rules: []\n' });
    symlinkSync(join(outside.path, '.swiftlint.yml'), join(sandbox.path, 'app/Sources/Feature/.swiftlint.yml'));
    expect(() => commandConfigurations(session, planned)).toThrow(/lifecycle/iu);
});

test.each([
    { scope: '', expected: [] },
    { scope: 'package', expected: ['--workspace', 'package'] },
    { scope: 'source', expected: [] },
])('workspace expansion retains arguments only for a package scope: $scope', async ({ scope, expected }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n',
        'Example.swift': 'let example = 1\n',
        'package.json': '{}',
        'package/package.json': '{}',
        'source/Example.swift': 'let source = 2\n',
    });
    const session = await openSession(sandbox.path);
    const plans = await planRun(session, { stage: 'commit', skips: [], only: ['swift/swiftlint'] });
    expect(
        substitute(session, plans[0]!, ['before', '{workspace:--workspace}', 'after'], {
            files: [],
            scope,
            root: sandbox.path,
            indent: 4,
        }),
    ).toStrictEqual(['before', ...expected, 'after']);
});
