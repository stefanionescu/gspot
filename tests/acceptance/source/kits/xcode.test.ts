// Planted repository for the xcode configuration: a project with a source in no target, a catalog with a hole, and a plist that opens the network.
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { unlinkSync, symlinkSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { plantedCases } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { HOME, PLAN, IMAGES, XCODE_PROJECT } from '#tests/inputs/acceptance/source/kits/kits.ts';

const PLIST_HEAD = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n`;
const PLIST_TAIL = '</dict>\n</plist>\n';
const ENTITLED = `${PLIST_HEAD}    <key>com.apple.developer.healthkit</key>\n    <true/>\n${PLIST_TAIL}`;

const LOADS_ON = `${PLIST_HEAD}    <key>NSAppTransportSecurity</key>\n    <dict>\n        <key>NSAllowsArbitraryLoads</key>\n        <true/>\n    </dict>\n${PLIST_TAIL}`;
const LOADS_OFF = LOADS_ON.replace('<true/>', '<false/>');

plantedCases(
    'the xcode configuration',
    {
        kits: ['xcode'],
        modules: false,
        without: ['spelling', 'swift'],
        tools: ['taplo', 'yamllint'],
        files: {
            'App.xcodeproj/project.pbxproj': XCODE_PROJECT,
            'App.xcodeproj/xcshareddata/xcschemes/App.xcscheme':
                '<Scheme>\n    <TestAction>\n        <TestPlans><TestPlanReference reference="container:App.xctestplan"/></TestPlans>\n    </TestAction>\n</Scheme>\n',
            'App.xctestplan': PLAN,
            'App/Home.swift': HOME,
            'App/Info.plist': `${PLIST_HEAD}    <key>CFBundleName</key>\n    <string>App</string>\n${PLIST_TAIL}`,
            'App/Base.xcconfig': '// The base settings.\nSWIFT_VERSION = 5.9\n#include "Shared.xcconfig"\n',
            'App/Shared.xcconfig': 'OTHER[sdk=iphoneos*] = value\n',
            'App/Localizable.xcstrings': `{\n    "sourceLanguage": "en",\n    "strings": {\n        "hello": { "localizations": { "de": {}, "en": {} } },\n        "bye": { "localizations": { "de": {}, "en": {} } }\n    },\n    "version": "1.0"\n}\n`,
            'App/Assets.xcassets/Contents.json': '{\n    "info": { "author": "xcode", "version": 1 }\n}\n',
            'App/Assets.xcassets/Logo.imageset/Contents.json': IMAGES,
            'App/Assets.xcassets/Logo.imageset/logo.png': 'png',
        },
        prepare: commitAll,
    },
    [
        // The plist check needs the macOS plutil.
        {
            check: 'xcode/plist',
            files: { 'App/Info.plist': '<plist><dict><key>broken</dict></plist>\n' },
            expected: { file: 'App/Info.plist' },
            platforms: ['darwin'],
        },
        {
            check: 'xcode/xcconfig',
            files: { 'App/Base.xcconfig': 'SWIFT_VERSION = 5.9\nthis line means nothing\n' },
            expected: { file: 'App/Base.xcconfig', rule: 'xcconfig-line', line: 2 },
        },
        {
            check: 'xcode/xcstrings',
            files: {
                'App/Localizable.xcstrings': `{\n    "sourceLanguage": "en",\n    "strings": {\n        "hello": { "localizations": { "de": {}, "en": {} } },\n        "bye": { "localizations": { "en": {} } }\n    },\n    "version": "1.0"\n}\n`,
            },
            expected: { file: 'App/Localizable.xcstrings', rule: 'missing-translation', line: 1 },
        },
        {
            check: 'xcode/asset-catalogs',
            files: {},
            removed: ['App/Assets.xcassets/Logo.imageset/logo.png'],
            expected: { file: 'App/Assets.xcassets/Logo.imageset/Contents.json', rule: 'missing-image', line: 1 },
        },
        {
            check: 'xcode/asset-catalogs',
            files: { 'App/Assets.xcassets/Unused.colorset/Contents.json': '{\n    "colors": []\n}\n' },
            expected: { file: 'App/Assets.xcassets/Unused.colorset/Contents.json', rule: 'orphan-asset', line: 1 },
            corrected: {
                files: {
                    'App/Assets.xcassets/Unused.colorset/Contents.json': '{\n    "colors": []\n}\n',
                    'App/Home.swift': `${HOME}\nlet accent = Color("Unused")\n`,
                },
            },
        },
        {
            check: 'xcode/test-plan',
            files: {
                'App.xcodeproj/project.pbxproj': XCODE_PROJECT.replace('name = AppTests;', () => 'name = OtherTests;'),
            },
            expected: { file: 'App.xcodeproj/project.pbxproj', rule: 'target-plan', line: 1 },
            corrected: {
                files: {
                    'App.xcodeproj/project.pbxproj': XCODE_PROJECT.replace('name = AppTests;', 'name = OtherTests;'),
                    'App.xctestplan': PLAN.replace('AppTests', 'OtherTests'),
                },
            },
        },
        {
            check: 'xcode/orphan-sources',
            files: { 'App/Extra.swift': 'let extra = 1\n' },
            expected: { file: 'App/Extra.swift', rule: 'no-target', line: 1 },
            corrected: {
                files: {
                    'App/Extra.swift': 'let extra = 1\n',
                    'App.xcodeproj/project.pbxproj': XCODE_PROJECT.replace('children = (A1,);', 'children = (A1, A2,);')
                        .replace('files = (B1,);', 'files = (B1, B2,);')
                        .replace(
                            'objects = {',
                            'objects = {\nA2 = {isa = PBXFileReference; path = Extra.swift; sourceTree = "<group>"; };\nB2 = {isa = PBXBuildFile; fileRef = A2; };',
                        ),
                },
            },
        },
        {
            check: 'xcode/orphan-sources',
            files: {},
            removed: ['App/Home.swift'],
            expected: { file: 'App.xcodeproj/project.pbxproj', rule: 'missing-file', line: 1 },
        },
        {
            check: 'xcode/entitlements-policy',
            files: { 'App/App.entitlements': ENTITLED },
            policy: '[tools.xcode]\nentitlements_allowed = ["aps-environment"]\n',
            expected: { file: 'App/App.entitlements', rule: 'entitlement', line: 5 },
            corrected: {
                files: {
                    'App/App.entitlements': `${PLIST_HEAD}    <key>aps-environment</key>\n    <string>development</string>\n${PLIST_TAIL}`,
                },
            },
        },
        {
            check: 'xcode/ats',
            files: { 'App/Info.plist': LOADS_ON },
            expected: { file: 'App/Info.plist', rule: 'arbitrary-loads', line: 7 },
            corrected: { files: { 'App/Info.plist': LOADS_OFF } },
        },
    ],
    (planted) => {
        test(
            'xcode/symlinks reports a tracked symlink and accepts replacement with a regular source file',
            async () => {
                const { root, environment } = planted();
                symlinkSync('Home.swift', join(root, 'App/Linked.swift'));
                commitAll(root);
                const args = ['check', '--only', 'xcode/symlinks', '--no-cache', '--json'];
                const linked = await run(root, args, environment);
                expect(linked.code, linked.stdout + linked.stderr).toBe(1);
                expect(reportSchema.parse(JSON.parse(linked.stdout)).checks).toMatchObject([
                    {
                        check: 'xcode/symlinks',
                        status: 'fail',
                        findings: [{ file: 'App/Linked.swift', rule: 'symlink', line: 1 }],
                    },
                ]);
                unlinkSync(join(root, 'App/Linked.swift'));
                await Bun.write(join(root, 'App/Linked.swift'), HOME);
                commitAll(root);
                const corrected = await run(root, args, environment);
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                    { check: 'xcode/symlinks', status: 'ok', findings: [] },
                ]);
            },
            PLANTED_TIMEOUT_MS * 3,
        );
    },
);

describe('init in a repository with an Xcode project', () => {
    test(
        'writes the project and the first shared scheme into the scope that holds them',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'ios/App.xcodeproj/project.pbxproj': XCODE_PROJECT,
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
                '--no-guides',
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
