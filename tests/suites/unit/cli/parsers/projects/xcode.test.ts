import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { GROUPED_PBXPROJ } from '#tests/config/checks/infrastructure/xcode.ts';
import { NAMED_TARGET_SOURCE, NATIVE_TARGET_SOURCE } from '#tests/config/xcode.ts';
import { parseBuildSettings, parseProjectSources } from '#cli/parsers/projects/xcode.ts';

import {
    PROJECT_SYNTAX_CASES,
    FIRST_GROUP_SWIFT_PATH,
    XCODE_PROJECT_REFUSALS,
} from '#tests/config/parsers/projects/xcode.ts';

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
        FIRST_GROUP_SWIFT_PATH,
        '/repo/Root.swift',
    ]);
});

test('each native target keeps its own name, sources, and folders', () => {
    const source = GROUPED_PBXPROJ.replace(NATIVE_TARGET_SOURCE, NAMED_TARGET_SOURCE);
    expect(parseProjectSources(source, '/repo/App.xcodeproj/project.pbxproj').targets).toStrictEqual([
        {
            name: 'App Kit',
            sources: [FIRST_GROUP_SWIFT_PATH, '/repo/Root.swift'],
            folders: [{ path: '/repo/Synced/', excluded: new Set(['/repo/Synced/Excluded.swift']) }],
        },
    ]);
});

test('invalid Xcode syntax names the file and uses the parse error code', () => {
    for (const parse of [parseProjectSources, parseBuildSettings]) {
        try {
            parse('{broken', 'App.xcodeproj/project.pbxproj');
        } catch (error) {
            expect(error).toBeInstanceOf(GspotError);
            expect(error).toMatchObject({ code: 'parse' });
            expect((error as Error).message).toContain('App.xcodeproj/project.pbxproj is not a valid Xcode project:');
            continue;
        }
        throw new Error('Invalid Xcode syntax was accepted.');
    }
});

test('an inherited object name is refused as an Xcode object reference', () => {
    const source = GROUPED_PBXPROJ.replace('B1, B2,', 'constructor, B2,');
    expect(() => parseProjectSources(source, 'App.xcodeproj/project.pbxproj')).toThrow('unknown object: constructor');
});
