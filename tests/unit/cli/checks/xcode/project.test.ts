import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { GROUPED_PBXPROJ, SINGLE_FILE_PBXPROJ, DEEPEST_SCOPE_SETTINGS } from '#tests/data/checks/xcode.ts';

/** Build a one-file project whose only source has the given name. */
function buildPbxproj(name: string): string {
    return SINGLE_FILE_PBXPROJ.replace('path = Root.swift;', `path = ${name}.swift;`);
}

describe('project', () => {
    test('Xcode sources follow group paths and target membership instead of duplicate filenames', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['xcode'], { level: 'all' }),
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
            matchFields({ file: 'Second/Shared.swift', rule: 'untargeted' }),
            matchFields({ file: 'Synced/Excluded.swift', rule: 'untargeted' }),
        ]);
    });

    test('membership combines projects in a scope and checks nested scopes independently', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['xcode'], { tables: '[[scope]]\npath = "nested"\n' }),
            'One.xcodeproj/project.pbxproj': buildPbxproj('One'),
            'Two.xcodeproj/project.pbxproj': buildPbxproj('Two'),
            'One.swift': 'let one = 1\n',
            'Two.swift': 'let two = 2\n',
            'nested/App.xcodeproj/project.pbxproj': buildPbxproj('Nested'),
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
            { scope: 'nested', findings: [matchFields({ file: 'nested/Extra.swift', rule: 'untargeted' })] },
        ]);
    });
});
describe('settings', () => {
    test.each([...DEEPEST_SCOPE_SETTINGS])(
        '%s checks the deepest scope only',
        async (check, path, broken, corrected, rule) => {
            await using sandbox = await testdir();
            const rootContent =
                check === 'xcode/entitlements' ? corrected.replace('nested-capability', 'root-capability') : corrected;
            const settings = buildSettingsText(['xcode'], {
                tables: '[xcode]\nallowed_entitlements = ["root-capability"]\n[[scope]]\npath = "app"\n[scope.xcode]\nallowed_entitlements = ["nested-capability"]\n[[scope]]\npath = "app/child"\n[[scope]]\npath = "sibling"\n',
                level: 'all',
            });
            await createFileTree(sandbox.path, {
                'gspot.toml': settings,
                [path]: rootContent,
                [`app/${path}`]: corrected,
                [`app/child/${path}`]: broken,
                [`sibling/${path}`]: rootContent,
            });
            const command = ['check', '--only', check, '--json'];
            const result = await checkReport(sandbox.path, command);
            expect(result.code, result.stdout + result.stderr).toBe(1);
            const report = result.report;
            expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
                { scope: '', status: 'passed' },
                { scope: 'app', status: 'passed' },
                { scope: 'app/child', status: 'failed' },
                { scope: 'sibling', status: 'passed' },
            ]);
            expect(report.checks.flatMap(({ findings }) => findings)).toMatchObject([
                { file: `app/child/${path}`, line: 1, rule },
            ]);
        },
    );
});
