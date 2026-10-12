import { test, expect } from 'bun:test';
import { parsePbxproj } from '#cli/parsers/xcode.ts';
import { GROUPED_PBXPROJ, XCODE_PROJECT_REFUSALS } from '#tests/config/xcode.ts';

test('the project folder offset and source roots apply separately', () => {
    const source = GROUPED_PBXPROJ.replace('mainGroup = MAIN;', 'mainGroup = MAIN; projectDirPath = ../Code;');
    const project = parsePbxproj(source, '/repo/project');
    expect([...project.sources]).toStrictEqual(['/repo/Code/First Group/Shared.swift', '/repo/project/Root.swift']);
    expect(project.folders).toStrictEqual([
        { path: '/repo/Code/Synced/', excluded: new Set(['/repo/Code/Synced/Excluded.swift']) },
    ]);
});

test('quoted project strings keep escapes and ignore comment-like text', () => {
    const source = GROUPED_PBXPROJ.replace(
        'path = "First Group";',
        String.raw`path = "First \U00e9 \"Group\"";`,
    ).replace('path = Shared.swift;', 'path = "//Shared.swift";');
    expect([...parsePbxproj(source, '/repo').sources]).toStrictEqual(['/Shared.swift', '/repo/Root.swift']);
    expect(
        [
            ...parsePbxproj(
                GROUPED_PBXPROJ.replace('path = "First Group";', String.raw`path = "First \U00e9 Group";`),
                '/repo',
            ).sources,
        ][0],
    ).toBe('/repo/First é Group/Shared.swift');
});

test.each([...XCODE_PROJECT_REFUSALS])('a project with $name is refused', ({ source, message }) => {
    expect(() => parsePbxproj(source, '/repo')).toThrow(message);
});
