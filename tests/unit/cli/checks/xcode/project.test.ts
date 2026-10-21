import { openSession } from '#cli/session.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { GROUPED_PBXPROJ, SINGLE_FILE_PBXPROJ, DEEPEST_SCOPE_SETTINGS } from '#tests/data/checks/xcode.ts';

describe('project', () => {
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
    test('xcode/entitlements checks the deepest scope only', async () => {
        const { path, unlisted: broken, allowed: corrected } = DEEPEST_SCOPE_SETTINGS;
        const check = 'xcode/entitlements';
        await using sandbox = await testdir();
        const rootContent = corrected.replace('nested-capability', 'root-capability');
        const settings = buildSandboxSettings(['xcode'], {
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
        const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: [check] }));
        const report = result.report;
        expect(report.checks.map(({ scope, status }) => ({ scope, status }))).toStrictEqual([
            { scope: '', status: 'passed' },
            { scope: 'app', status: 'passed' },
            { scope: 'app/child', status: 'failed' },
            { scope: 'sibling', status: 'passed' },
        ]);
        expect(report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: `app/child/${path}`, line: 1, rule: 'entitlement' },
        ]);
    });
});
