import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readProject } from '#cli/checks/xcode/project-reader.ts';
import { run } from '#tests/support/cli/planted.ts';

const PROJECT = `// !$*UTF8*$!
{
    rootObject = P;
    objects = {
        P = {isa = PBXProject; mainGroup = MAIN; targets = (T,); };
        MAIN = {isa = PBXGroup; children = (FIRST, SECOND, ROOT, SYNC,); sourceTree = "<group>"; };
        FIRST = {isa = PBXGroup; name = "Display name"; path = "First Group"; children = (VIRTUAL,); sourceTree = "<group>"; };
        VIRTUAL = {isa = PBXGroup; name = "Virtual display"; children = (F1,); sourceTree = "<group>"; };
        SECOND = {isa = PBXGroup; path = Second; children = (F2,); sourceTree = "<group>"; };
        ROOT = {isa = PBXFileReference; path = Root.swift; sourceTree = SOURCE_ROOT; };
        F1 /* duplicate name */ = {isa = PBXFileReference; path = Shared.swift; sourceTree = "<group>"; };
        F2 = {isa = PBXFileReference; path = Shared.swift; sourceTree = "<group>"; };
        B1 = {isa = PBXBuildFile; fileRef = F1; };
        B2 = {isa = PBXBuildFile; fileRef = ROOT; };
        SOURCES = {isa = PBXSourcesBuildPhase; files = (B1, B2,); };
        T = {isa = PBXNativeTarget; buildPhases = (SOURCES,); fileSystemSynchronizedGroups = (SYNC,); };
        SYNC = {isa = PBXFileSystemSynchronizedRootGroup; path = Synced; sourceTree = "<group>"; exceptions = (EXCEPT,); };
        EXCEPT = {isa = PBXFileSystemSynchronizedBuildFileExceptionSet; target = T; membershipExceptions = (Excluded.swift,); };
    };
}
`;

test('Xcode sources follow group paths and target membership instead of duplicate filenames', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\npresets = ["xcode"]\n',
        'App.xcodeproj/project.pbxproj': PROJECT,
        'First Group/Shared.swift': 'let first = 1\n',
        'Second/Shared.swift': 'let second = 2\n',
        'Root.swift': 'let root = 1\n',
        'Synced/Included.swift': 'let included = 1\n',
        'Synced/Excluded.swift': 'let excluded = 1\n',
    });
    const command = ['check', '--only', 'xcode/orphan-sources', '--no-cache', '--json'];
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(JSON.parse(broken.stdout).checks[0].findings).toEqual([
        expect.objectContaining({ file: 'Second/Shared.swift', rule: 'no-target' }),
        expect.objectContaining({ file: 'Synced/Excluded.swift', rule: 'no-target' }),
    ]);
    const included = PROJECT.replace('files = (B1, B2,);', 'files = (B1, B2, B3,);')
        .replace('B1 = {', 'B3 = {isa = PBXBuildFile; fileRef = F2; };\nB1 = {')
        .replace('membershipExceptions = (Excluded.swift,);', 'membershipExceptions = ();');
    await Bun.write(`${sandbox.path}/App.xcodeproj/project.pbxproj`, included);
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    await Bun.file(`${sandbox.path}/Second/Shared.swift`).delete();
    const missing = await run(sandbox.path, command);
    expect(missing.code, missing.stdout + missing.stderr).toBe(1);
    expect(JSON.parse(missing.stdout).checks[0].findings).toEqual([
        expect.objectContaining({
            rule: 'missing-file',
            message: 'The project names Second/Shared.swift, and the tree holds no such file.',
        }),
    ]);
});

test('project directory offsets and source roots resolve separately', () => {
    const source = PROJECT.replace('mainGroup = MAIN;', 'mainGroup = MAIN; projectDirPath = ../Code;');
    const project = readProject(source, '/repo/project');
    expect([...project.sources]).toEqual(['/repo/Code/First Group/Shared.swift', '/repo/project/Root.swift']);
    expect(project.folders).toEqual([
        { path: '/repo/Code/Synced/', excluded: new Set(['/repo/Code/Synced/Excluded.swift']) },
    ]);
});

test('quoted project strings preserve escapes and ignore comment-like text', () => {
    const source = PROJECT.replace('path = "First Group";', 'path = "First \\U00e9 \\"Group\\"";').replace(
        'path = Shared.swift;',
        'path = "//Shared.swift";',
    );
    expect([...readProject(source, '/repo').sources]).toEqual(['/Shared.swift', '/repo/Root.swift']);
    expect(
        [...readProject(PROJECT.replace('path = "First Group";', 'path = "First \\U00e9 Group";'), '/repo').sources][0],
    ).toBe('/repo/First é Group/Shared.swift');
});

test.each([
    PROJECT.slice(0, -3),
    PROJECT.replace('B1, B2,', 'MISSING, B2,'),
    PROJECT.replace('children = (F1,);', 'children = (FIRST, F1,);').replace(
        'children = (FIRST, SECOND, ROOT, SYNC,);',
        'children = (SECOND, ROOT, SYNC,);',
    ),
    PROJECT.replace('sourceTree = SOURCE_ROOT;', 'sourceTree = CUSTOM_BUILD_ROOT;'),
])('an unreadable project returns execution status 2', async (source) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\npresets = ["xcode"]\n',
        'App.xcodeproj/project.pbxproj': source,
        'Root.swift': 'let root = 1\n',
    });
    const result = await run(sandbox.path, ['check', '--only', 'xcode/orphan-sources', '--no-cache', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
});

test('membership combines projects in a scope and checks nested scopes independently', async () => {
    await using sandbox = await testdir();
    const smallProject = (source: string): string =>
        PROJECT.replace('files = (B1, B2,);', 'files = (B2,);')
            .replace('fileSystemSynchronizedGroups = (SYNC,);', '')
            .replace('path = Root.swift;', `path = ${source};`);
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\npresets = ["xcode"]\n[[scope]]\npath = "nested"\n',
        'One.xcodeproj/project.pbxproj': smallProject('One.swift'),
        'Two.xcodeproj/project.pbxproj': smallProject('Two.swift'),
        'One.swift': 'let one = 1\n',
        'Two.swift': 'let two = 2\n',
        'nested/App.xcodeproj/project.pbxproj': smallProject('Nested.swift'),
        'nested/Nested.swift': 'let nested = 1\n',
        'nested/Extra.swift': 'let extra = 1\n',
    });
    const command = ['check', '--only', 'xcode/orphan-sources', '--no-cache', '--json'];
    const broken = await run(sandbox.path, command);
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(
        JSON.parse(broken.stdout).checks.map((check: { scope: string; findings: unknown[] }) => ({
            scope: check.scope,
            findings: check.findings,
        })),
    ).toEqual([
        { scope: '', findings: [] },
        { scope: 'nested', findings: [expect.objectContaining({ file: 'nested/Extra.swift', rule: 'no-target' })] },
    ]);
    await Bun.file(`${sandbox.path}/nested/Extra.swift`).delete();
    const corrected = await run(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
