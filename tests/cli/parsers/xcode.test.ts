import { test, expect } from 'bun:test';
import { readPbxproj } from '#cli/parsers/xcode.ts';
import { PBXPROJ_PROJECT } from '#tests/config/samples/xcode.ts';

test('project directory offsets and source roots resolve separately', () => {
    const source = PBXPROJ_PROJECT.replace('mainGroup = MAIN;', 'mainGroup = MAIN; projectDirPath = ../Code;');
    const project = readPbxproj(source, '/repo/project');
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
    expect([...readPbxproj(source, '/repo').sources]).toStrictEqual(['/Shared.swift', '/repo/Root.swift']);
    expect(
        [
            ...readPbxproj(
                PBXPROJ_PROJECT.replace('path = "First Group";', String.raw`path = "First \U00e9 Group";`),
                '/repo',
            ).sources,
        ][0],
    ).toBe('/repo/First é Group/Shared.swift');
});
test.each([
    {
        name: 'missing value',
        source: PBXPROJ_PROJECT.slice(0, -3),
        message: 'Unexpected end of input in object at line 19, column 7',
    },
    {
        name: 'unknown object',
        source: PBXPROJ_PROJECT.replace('B1, B2,', 'MISSING, B2,'),
        message: 'The Xcode project references an unknown object: MISSING.',
    },
    {
        name: 'group cycle',
        source: PBXPROJ_PROJECT.replace('children = (F1,);', 'children = (FIRST, F1,);').replace(
            'children = (FIRST, SECOND, ROOT, SYNC,);',
            'children = (SECOND, ROOT, SYNC,);',
        ),
        message: 'The Xcode project contains a group cycle.',
    },
    {
        name: 'unresolved source tree',
        source: PBXPROJ_PROJECT.replace('sourceTree = SOURCE_ROOT;', 'sourceTree = CUSTOM_BUILD_ROOT;'),
        message: 'Cannot find the folder of Xcode source tree CUSTOM_BUILD_ROOT without build settings.',
    },
])('the parser refuses a project with $name', ({ source, message }) => {
    expect(() => readPbxproj(source, '/repo')).toThrow(message);
});
