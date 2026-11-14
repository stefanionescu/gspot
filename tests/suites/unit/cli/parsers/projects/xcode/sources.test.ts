import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { GROUPED_PBXPROJ } from '#tests/config/setup/configurations.ts';
import { parseProjectSources } from '#cli/parsers/projects/xcode/sources.ts';
import { NAMED_TARGET_SOURCE, NATIVE_TARGET_SOURCE } from '#tests/config/setup/languages.ts';
import { PROJECT_SYNTAX_CASES, FIRST_GROUP_SWIFT_PATH } from '#tests/config/parsers/formats.ts';

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

test('a project with an unresolved source tree is refused', () => {
    const source = GROUPED_PBXPROJ.replace('sourceTree = SOURCE_ROOT;', 'sourceTree = CUSTOM_BUILD_ROOT;');
    expect(() => parseProjectSources(source, '/repo/App.xcodeproj/project.pbxproj')).toThrow(
        matchFields<GspotError>({ name: 'GspotError', code: 'parse' }),
    );
});

test.each([...PROJECT_SYNTAX_CASES])('the project reader accepts $name', ({ source }) => {
    expect([...parseProjectSources(source, '/repo/App.xcodeproj/project.pbxproj').sources]).toStrictEqual([
        FIRST_GROUP_SWIFT_PATH,
        '/repo/Root.swift',
    ]);
});

test('each native target keeps its own name, sources, and folders', () => {
    const source = GROUPED_PBXPROJ.replace(NATIVE_TARGET_SOURCE, () => NAMED_TARGET_SOURCE);
    expect(parseProjectSources(source, '/repo/App.xcodeproj/project.pbxproj').targets).toStrictEqual([
        {
            name: 'App Kit',
            sources: [FIRST_GROUP_SWIFT_PATH, '/repo/Root.swift'],
            folders: [{ path: '/repo/Synced/', excluded: new Set(['/repo/Synced/Excluded.swift']) }],
        },
    ]);
});
