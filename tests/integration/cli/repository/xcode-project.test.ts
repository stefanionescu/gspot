import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/harness/cli/command.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { containing } from '#tests/harness/expectations.ts';
import { readProject } from '#cli/checks/tool/xcode/pbxproj.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { PBXPROJ_PROJECT } from '#tests/inputs/integration/cli/repository.ts';

test('Xcode sources follow group paths and target membership instead of duplicate filenames', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['xcode'], '', 'all'),
        'App.xcodeproj/project.pbxproj': PBXPROJ_PROJECT,
        'First Group/Shared.swift': 'let first = 1\n',
        'Second/Shared.swift': 'let second = 2\n',
        'Root.swift': 'let root = 1\n',
        'Synced/Included.swift': 'let included = 1\n',
        'Synced/Excluded.swift': 'let excluded = 1\n',
    });
    const command = ['check', '--only', 'xcode/orphan-sources', '--json'];
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect((JSON.parse(broken.stdout) as RunReport).checks[0]!.findings).toStrictEqual([
        containing({ file: 'Second/Shared.swift', rule: 'no-target' }),
        containing({ file: 'Synced/Excluded.swift', rule: 'no-target' }),
    ]);
    const included = PBXPROJ_PROJECT.replace('files = (B1, B2,);', 'files = (B1, B2, B3,);')
        .replace('B1 = {', 'B3 = {isa = PBXBuildFile; fileRef = F2; };\nB1 = {')
        .replace('membershipExceptions = (Excluded.swift,);', 'membershipExceptions = ();');
    await Bun.write(`${sandbox.path}/App.xcodeproj/project.pbxproj`, included);
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    await Bun.file(`${sandbox.path}/Second/Shared.swift`).delete();
    const missing = await run(sandbox.path, command);
    expect(missing.code, missing.stdout + missing.stderr).toBe(1);
    expect((JSON.parse(missing.stdout) as RunReport).checks[0]!.findings).toStrictEqual([
        containing({
            rule: 'missing-file',
            message: 'The project names Second/Shared.swift, and the tree holds no such file.',
        }),
    ]);
});

test('project directory offsets and source roots resolve separately', () => {
    const source = PBXPROJ_PROJECT.replace('mainGroup = MAIN;', 'mainGroup = MAIN; projectDirPath = ../Code;');
    const project = readProject(source, '/repo/project');
    expect([...project.sources]).toStrictEqual(['/repo/Code/First Group/Shared.swift', '/repo/project/Root.swift']);
    expect(project.folders).toStrictEqual([
        { path: '/repo/Code/Synced/', excluded: new Set(['/repo/Code/Synced/Excluded.swift']) },
    ]);
});

test('quoted project strings preserve escapes and ignore comment-like text', () => {
    const source = PBXPROJ_PROJECT.replace(
        'path = "First Group";',
        String.raw`path = "First \U00e9 \"Group\"";`,
    ).replace('path = Shared.swift;', 'path = "//Shared.swift";');
    expect([...readProject(source, '/repo').sources]).toStrictEqual(['/Shared.swift', '/repo/Root.swift']);
    expect(
        [
            ...readProject(
                PBXPROJ_PROJECT.replace('path = "First Group";', String.raw`path = "First \U00e9 Group";`),
                '/repo',
            ).sources,
        ][0],
    ).toBe('/repo/First é Group/Shared.swift');
});
test.each([
    PBXPROJ_PROJECT.slice(0, -3),
    PBXPROJ_PROJECT.replace('B1, B2,', 'MISSING, B2,'),
    PBXPROJ_PROJECT.replace('children = (F1,);', 'children = (FIRST, F1,);').replace(
        'children = (FIRST, SECOND, ROOT, SYNC,);',
        'children = (SECOND, ROOT, SYNC,);',
    ),
    PBXPROJ_PROJECT.replace('sourceTree = SOURCE_ROOT;', 'sourceTree = CUSTOM_BUILD_ROOT;'),
])('an unreadable project returns execution status 2', async (source) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['xcode'], '', 'all'),
        'App.xcodeproj/project.pbxproj': source,
        'Root.swift': 'let root = 1\n',
    });
    const result = await run(sandbox.path, ['check', '--only', 'xcode/orphan-sources', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
});

test('membership combines projects in a scope and checks nested scopes independently', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['xcode'], '[[scope]]\npath = "nested"\n'),
        'One.xcodeproj/project.pbxproj': PBXPROJ_PROJECT.replace('files = (B1, B2,);', 'files = (B2,);')
            .replace('fileSystemSynchronizedGroups = (SYNC,);', '')
            .replace('path = Root.swift;', `path = One.swift;`),
        'Two.xcodeproj/project.pbxproj': PBXPROJ_PROJECT.replace('files = (B1, B2,);', 'files = (B2,);')
            .replace('fileSystemSynchronizedGroups = (SYNC,);', '')
            .replace('path = Root.swift;', `path = Two.swift;`),
        'One.swift': 'let one = 1\n',
        'Two.swift': 'let two = 2\n',
        'nested/App.xcodeproj/project.pbxproj': PBXPROJ_PROJECT.replace('files = (B1, B2,);', 'files = (B2,);')
            .replace('fileSystemSynchronizedGroups = (SYNC,);', '')
            .replace('path = Root.swift;', `path = Nested.swift;`),
        'nested/Nested.swift': 'let nested = 1\n',
        'nested/Extra.swift': 'let extra = 1\n',
    });
    const command = ['check', '--only', 'xcode/orphan-sources', '--json'];
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(
        (JSON.parse(broken.stdout) as RunReport).checks.map((check) => ({
            scope: check.scope,
            findings: check.findings,
        })),
    ).toStrictEqual([
        { scope: '', findings: [] },
        { scope: 'nested', findings: [containing({ file: 'nested/Extra.swift', rule: 'no-target' })] },
    ]);
    await Bun.file(`${sandbox.path}/nested/Extra.swift`).delete();
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
