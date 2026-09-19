// Planted repository for the xcode preset: a project with a source in no target, a catalog with a hole, and a plist that opens the network.
import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'xcode',
    '--without',
    'spelling,swift',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const plist = (body: string): string =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${body}</dict>\n</plist>\n`;
const PROJECT = `// !$*UTF8*$!
{
    objects = {
        A1 = {isa = PBXFileReference; path = Home.swift; sourceTree = "<group>"; };
        T1 = {
            isa = PBXNativeTarget;
            name = AppTests;
            productType = "com.apple.product-type.bundle.unit-test";
        };
    };
}
`;
const PLAN = '{\n    "testTargets": [{ "target": { "name": "AppTests" } }]\n}\n';
const STRINGS_FILE = (german: string): string =>
    `{\n    "sourceLanguage": "en",\n    "strings": {\n        "hello": { "localizations": { "de": {}, "en": {} } },\n        "bye": { "localizations": { ${german}"en": {} } }\n    },\n    "version": "1.0"\n}\n`;
const HOME = 'import SwiftUI\n\nlet logo = Image("Logo")\n';
const IMAGES =
    '{\n    "images": [{ "filename": "logo.png", "idiom": "universal" }],\n    "info": { "author": "xcode", "version": 1 }\n}\n';
const ENTITLED = plist('    <key>com.apple.developer.healthkit</key>\n    <true/>\n');

const CASES: PlantedCase[] = [
    {
        id: 'xcode/plist',
        files: { 'App/Info.plist': '<plist><dict><key>broken</dict></plist>\n' },
        expected: 'App/Info.plist',
    },
    {
        id: 'xcode/xcconfig',
        files: { 'App/Base.xcconfig': 'SWIFT_VERSION = 5.9\nthis line means nothing\n' },
        expected: 'This line is no KEY = value setting',
    },
    {
        id: 'xcode/xcstrings',
        files: { 'App/Localizable.xcstrings': STRINGS_FILE('') },
        expected: '"bye" has no translation for de',
    },
    {
        id: 'xcode/asset-catalogues',
        files: {},
        removed: ['App/Assets.xcassets/Logo.imageset/logo.png'],
        expected: 'The image logo.png is not in the set',
    },
    {
        id: 'xcode/asset-catalogues',
        files: { 'App/Assets.xcassets/Unused.colorset/Contents.json': '{\n    "colors": []\n}\n' },
        expected: 'No source names the asset Unused',
    },
    {
        id: 'xcode/test-plan',
        files: { 'App.xcodeproj/project.pbxproj': PROJECT.replace('name = AppTests;', () => 'name = OtherTests;') },
        expected: 'The test target OtherTests is in no test plan',
    },
    {
        id: 'xcode/orphan-sources',
        files: { 'App/Extra.swift': 'let extra = 1\n' },
        expected: 'This Swift file is in no target',
    },
    {
        id: 'xcode/orphan-sources',
        files: {},
        removed: ['App/Home.swift'],
        expected: 'The project names Home.swift, and the tree holds no such file',
    },
    {
        id: 'xcode/entitlements-policy',
        files: { 'App/App.entitlements': ENTITLED },
        policyEdit: ['[tools.xcode]\n', '[tools.xcode]\nallowed_entitlements = ["aps-environment"]\n'],
        expected: 'com.apple.developer.healthkit is not an allowed entitlement',
    },
    {
        id: 'xcode/ats',
        files: {
            'App/Info.plist': plist(
                '    <key>NSAppTransportSecurity</key>\n    <dict>\n        <key>NSAllowsArbitraryLoads</key>\n        <true/>\n    </dict>\n',
            ),
        },
        expected: 'NSAllowsArbitraryLoads is true',
    },
];

describe('the xcode preset', () => {
    test(
        'every xcode check fires on its planted defect',
        async () => {
            await using fixture = await createFixture({
                'App.xcodeproj/project.pbxproj': PROJECT,
                'App.xcodeproj/xcshareddata/xcschemes/App.xcscheme':
                    '<Scheme>\n    <TestAction>\n        <TestPlans><TestPlanReference reference="container:App.xctestplan"/></TestPlans>\n    </TestAction>\n</Scheme>\n',
                'App.xctestplan': PLAN,
                'App/Home.swift': HOME,
                'App/Info.plist': plist('    <key>CFBundleName</key>\n    <string>App</string>\n'),
                'App/Base.xcconfig': '// The base settings.\nSWIFT_VERSION = 5.9\n#include "Shared.xcconfig"\n',
                'App/Shared.xcconfig': 'OTHER[sdk=iphoneos*] = value\n',
                'App/Localizable.xcstrings': STRINGS_FILE('"de": {}, '),
                'App/Assets.xcassets/Contents.json': '{\n    "info": { "author": "xcode", "version": 1 }\n}\n',
                'App/Assets.xcassets/Logo.imageset/Contents.json': IMAGES,
                'App/Assets.xcassets/Logo.imageset/logo.png': 'png',
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['typos', 'ec', 'taplo', 'yamllint']) };
            await install(fixture.path, INIT, environment);
            commitAll(fixture.path);
            const checkIds = new Set(CASES.map((planted) => planted.id));
            for (const id of checkIds) {
                const clean = run(fixture.path, ['check', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
            symlinkSync('Home.swift', join(fixture.path, 'App/Linked.swift'));
            commitAll(fixture.path);
            const linked = run(fixture.path, ['check', 'xcode/symlinks', '--no-cache'], environment);
            expect(linked.code, linked.stdout).toBe(1);
            expect(linked.stdout).toContain('A symlink to Home.swift');
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});

describe('init in a repository with an Xcode project', () => {
    test(
        'writes the project and the first shared scheme into the scope that holds them',
        async () => {
            await using fixture = await createFixture({
                'ios/App.xcodeproj/project.pbxproj': PROJECT,
                'ios/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme': '<Scheme/>\n',
                'ios/App/Home.swift': HOME,
            });
            commitAll(fixture.path);
            const argv = [
                'init',
                '--yes',
                '--scope',
                'ios=swift,xcode',
                '--without',
                'spelling,naming,structure',
                '--runner',
                'none',
                '--ci',
                'none',
                '--hooks',
                'none',
                '--no-rules',
                '--no-install',
            ];
            await install(fixture.path, argv, {
                PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec', 'taplo', 'yamllint']),
            });
            const policy = await Bun.file(join(fixture.path, 'gspot.toml')).text();
            expect(policy).toContain('project = "App.xcodeproj"');
            expect(policy).toContain('scheme = "App"');
        },
        PLANTED_TIMEOUT_MS * 3,
    );
});
