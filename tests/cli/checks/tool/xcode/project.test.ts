import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { containing } from '#tests/harness/expectations.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import { PBXPROJ_PROJECT } from '#tests/config/samples/xcode.ts';

const project = (name: string) =>
    PBXPROJ_PROJECT.replace('files = (B1, B2,);', 'files = (B2,);')
        .replace('fileSystemSynchronizedGroups = (SYNC,);', '')
        .replace('path = Root.swift;', `path = ${name}.swift;`);

test('Xcode sources follow group paths and target membership instead of duplicate filenames', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xcode'], { level: 'all' }),
        'App.xcodeproj/project.pbxproj': PBXPROJ_PROJECT,
        'First Group/Shared.swift': 'let first = 1\n',
        'Second/Shared.swift': 'let second = 2\n',
        'Root.swift': 'let root = 1\n',
        'Synced/Included.swift': 'let included = 1\n',
        'Synced/Excluded.swift': 'let excluded = 1\n',
    });
    const command = ['check', '--only', 'xcode/orphan-sources', '--json'];
    const broken = await checkReport(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks[0]!.findings).toStrictEqual([
        containing({ file: 'Second/Shared.swift', rule: 'untargeted' }),
        containing({ file: 'Synced/Excluded.swift', rule: 'untargeted' }),
    ]);
    const included = PBXPROJ_PROJECT.replace('files = (B1, B2,);', 'files = (B1, B2, B3,);')
        .replace('B1 = {', 'B3 = {isa = PBXBuildFile; fileRef = F2; };\nB1 = {')
        .replace('membershipExceptions = (Excluded.swift,);', 'membershipExceptions = ();');
    await Bun.write(`${sandbox.path}/App.xcodeproj/project.pbxproj`, included);
    await Bun.file(`${sandbox.path}/Second/Shared.swift`).delete();
    const missing = await checkReport(sandbox.path, command);
    expect(missing.code, missing.stdout + missing.stderr).toBe(1);
    expect(missing.report.checks[0]!.findings).toStrictEqual([
        containing({
            rule: 'missing-file',
            message: 'The project names Second/Shared.swift, and the tree holds no such file.',
        }),
    ]);
});

test('membership combines projects in a scope and checks nested scopes independently', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xcode'], { tables: '[scope."nested"]\n' }),
        'One.xcodeproj/project.pbxproj': project('One'),
        'Two.xcodeproj/project.pbxproj': project('Two'),
        'One.swift': 'let one = 1\n',
        'Two.swift': 'let two = 2\n',
        'nested/App.xcodeproj/project.pbxproj': project('Nested'),
        'nested/Nested.swift': 'let nested = 1\n',
        'nested/Extra.swift': 'let verbatim = 1\n',
    });
    const command = ['check', '--only', 'xcode/orphan-sources', '--json'];
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

test('an unreadable project returns execution status 2', async () => {
    const source = PBXPROJ_PROJECT.slice(0, -3);
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['xcode'], { level: 'all' }),
        'App.xcodeproj/project.pbxproj': source,
        'Root.swift': 'let root = 1\n',
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'xcode/orphan-sources', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
});
