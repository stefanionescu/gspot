import { test, expect } from 'bun:test';
import { parseProjectSources } from '#cli/parsers/xcode.ts';
import { GROUPED_PBXPROJ } from '#tests/data/checks/xcode.ts';
import { PROJECT_SYNTAX_CASES, XCODE_PROJECT_REFUSALS } from '#tests/data/parsers/xcode.ts';

test('the project folder offset and source roots apply separately', () => {
    const source = GROUPED_PBXPROJ.replace('mainGroup = MAIN;', 'mainGroup = MAIN; projectDirPath = ../Code;');
    const project = parseProjectSources(source, '/repo/project/App.xcodeproj/project.pbxproj');
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
    expect([...parseProjectSources(source, '/repo/App.xcodeproj/project.pbxproj').sources]).toStrictEqual([
        '/Shared.swift',
        '/repo/Root.swift',
    ]);
    expect(
        [
            ...parseProjectSources(
                GROUPED_PBXPROJ.replace('path = "First Group";', String.raw`path = "First \U00e9 Group";`),
                '/repo/App.xcodeproj/project.pbxproj',
            ).sources,
        ][0],
    ).toBe('/repo/First é Group/Shared.swift');
});

test.each([...XCODE_PROJECT_REFUSALS])('a project with $name is refused', ({ source, message }) => {
    expect(() => parseProjectSources(source, '/repo/App.xcodeproj/project.pbxproj')).toThrow(message);
});

test.each([...PROJECT_SYNTAX_CASES])('the project reader accepts $name', ({ source }) => {
    expect([...parseProjectSources(source, '/repo/App.xcodeproj/project.pbxproj').sources]).toStrictEqual([
        '/repo/First Group/Shared.swift',
        '/repo/Root.swift',
    ]);
});

test('each native target keeps its own name, sources, and folders', () => {
    const source = GROUPED_PBXPROJ.replace(
        'T = {isa = PBXNativeTarget;',
        'T = {isa = PBXNativeTarget; name = "App Kit";',
    );
    expect(parseProjectSources(source, '/repo/App.xcodeproj/project.pbxproj').targets).toStrictEqual([
        {
            name: 'App Kit',
            sources: ['/repo/First Group/Shared.swift', '/repo/Root.swift'],
            folders: [{ path: '/repo/Synced/', excluded: new Set(['/repo/Synced/Excluded.swift']) }],
        },
    ]);
});
