import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { containing } from '#tests/setup/matchers.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { GROUPED_PBXPROJ, SINGLE_FILE_PBXPROJ } from '#tests/config/xcode.ts';

{
    const project = (name: string) => SINGLE_FILE_PBXPROJ.replace('path = Root.swift;', `path = ${name}.swift;`);

    test('Xcode sources follow group paths and target membership instead of duplicate filenames', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['xcode'], { level: 'all' }),
            'App.xcodeproj/project.pbxproj': GROUPED_PBXPROJ,
            'First Group/Shared.swift': 'let first = 1\n',
            'Second/Shared.swift': 'let second = 2\n',
            'Root.swift': 'let root = 1\n',
            'Synced/Included.swift': 'let included = 1\n',
            'Synced/Excluded.swift': 'let excluded = 1\n',
        });
        const command = ['check', '--only', 'xcode/files-without-target', '--json'];
        const broken = await checkReport(sandbox.path, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(broken.report.checks[0]!.findings).toStrictEqual([
            containing({ file: 'Second/Shared.swift', rule: 'untargeted' }),
            containing({ file: 'Synced/Excluded.swift', rule: 'untargeted' }),
        ]);
    });

    test('membership combines projects in a scope and checks nested scopes independently', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['xcode'], { tables: '[[scope]]\npath = "nested"\n' }),
            'One.xcodeproj/project.pbxproj': project('One'),
            'Two.xcodeproj/project.pbxproj': project('Two'),
            'One.swift': 'let one = 1\n',
            'Two.swift': 'let two = 2\n',
            'nested/App.xcodeproj/project.pbxproj': project('Nested'),
            'nested/Nested.swift': 'let nested = 1\n',
            'nested/Extra.swift': 'let verbatim = 1\n',
        });
        const command = ['check', '--only', 'xcode/files-without-target', '--json'];
        const broken = await checkReport(sandbox.path, command);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(
            broken.report.checks.map((check) => ({
                scope: check.scope,
                findings: check.findings,
            })),
        ).toStrictEqual([
            { scope: '', findings: [] },
            { scope: 'nested', findings: [containing({ file: 'nested/Extra.swift', rule: 'untargeted' })] },
        ]);
    });
}
