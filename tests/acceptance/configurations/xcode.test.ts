// Planted repository for the xcode configuration: a project with a source in no target, a catalog with a hole, and a plist that opens the network.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { describe, expect, test } from 'bun:test';
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'xcode',
    '--without',
    'spelling',
    'swift',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const plist = (body: string): string =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${body}</dict>\n</plist>\n`;
const PROJECT = `// !$*UTF8*$!
{
    rootObject = P1;
    objects = {
        P1 = {isa = PBXProject; mainGroup = G1; targets = (T1,); };
        G1 = {isa = PBXGroup; children = (G2,); sourceTree = "<group>"; };
        G2 = {isa = PBXGroup; path = App; children = (A1,); sourceTree = "<group>"; };
        B1 = {isa = PBXBuildFile; fileRef = A1; };
        S1 = {isa = PBXSourcesBuildPhase; files = (B1,); };
        A1 = {isa = PBXFileReference; path = Home.swift; sourceTree = "<group>"; };
        T1 = {
            isa = PBXNativeTarget;
            name = AppTests;
            buildPhases = (S1,);
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
        check: 'xcode/plist',
        files: { 'App/Info.plist': '<plist><dict><key>broken</dict></plist>\n' },
        expected: 'App/Info.plist',
    },
    {
        check: 'xcode/xcconfig',
        files: { 'App/Base.xcconfig': 'SWIFT_VERSION = 5.9\nthis line means nothing\n' },
        expected: 'This line is no KEY = value setting',
    },
    {
        check: 'xcode/xcstrings',
        files: { 'App/Localizable.xcstrings': STRINGS_FILE('') },
        expected: '"bye" has no translation for de',
    },
    {
        check: 'xcode/asset-catalogues',
        files: {},
        removed: ['App/Assets.xcassets/Logo.imageset/logo.png'],
        expected: 'The image logo.png is not in the set',
    },
    {
        check: 'xcode/asset-catalogues',
        files: { 'App/Assets.xcassets/Unused.colorset/Contents.json': '{\n    "colors": []\n}\n' },
        expected: 'No source names the asset Unused',
    },
    {
        check: 'xcode/test-plan',
        files: { 'App.xcodeproj/project.pbxproj': PROJECT.replace('name = AppTests;', () => 'name = OtherTests;') },
        expected: 'The test target OtherTests is in no test plan',
    },
    {
        check: 'xcode/orphan-sources',
        files: { 'App/Extra.swift': 'let extra = 1\n' },
        expected: 'This Swift file is in no target',
    },
    {
        check: 'xcode/orphan-sources',
        files: {},
        removed: ['App/Home.swift'],
        expected: 'The project names App/Home.swift, and the tree holds no such file',
    },
    {
        check: 'xcode/entitlements-policy',
        files: { 'App/App.entitlements': ENTITLED },
        policyEdit: ['[tools.xcode]\n', '[tools.xcode]\nallowed_entitlements = ["aps-environment"]\n'],
        expected: 'com.apple.developer.healthkit is not an allowed entitlement',
    },
    {
        check: 'xcode/ats',
        files: {
            'App/Info.plist': plist(
                '    <key>NSAppTransportSecurity</key>\n    <dict>\n        <key>NSAllowsArbitraryLoads</key>\n        <true/>\n    </dict>\n',
            ),
        },
        expected: 'NSAllowsArbitraryLoads is true',
    },
];

describe('the xcode configuration', () => {
    test(
        'every xcode check fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
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
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['typos', 'ec', 'taplo', 'yamllint']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            commitAll(sandbox.path);
            const checkIds = new Set(CASES.map((planted) => planted.check));
            for (const id of checkIds) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                if (planted.check === 'xcode/plist' && process.platform !== 'darwin') {
                    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                    expect(outcome.stdout).toContain('runs on macos only');
                    continue;
                }
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
            symlinkSync('Home.swift', join(sandbox.path, 'App/Linked.swift'));
            commitAll(sandbox.path);
            const linked = await run(sandbox.path, ['check', '--only', 'xcode/symlinks', '--no-cache'], environment);
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
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'ios/App.xcodeproj/project.pbxproj': PROJECT,
                'ios/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme': '<Scheme/>\n',
                'ios/App/Home.swift': HOME,
            });
            commitAll(sandbox.path);
            const argv = [
                'init',
                '--yes',
                '--scope',
                'ios=swift,xcode',
                '--without',
                'spelling',
                'naming',
                '--no-runner',
                '--no-ci',
                '--no-hooks',
                '--no-rules',
                '--no-install',
            ];
            await install(sandbox.path, argv, {
                PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec', 'taplo', 'yamllint']),
            });
            const policy = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
            expect(policy).toContain('project = "App.xcodeproj"');
            expect(policy).toContain('scheme = "App"');
            // A later write into the same scope must still patch the file init wrote.
            const later = await run(
                sandbox.path,
                ['set', '--scope', 'ios', 'tools.xcode.destination', 'platform=macOS'],
                {},
            );
            expect(later.code, later.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 3,
    );
});
