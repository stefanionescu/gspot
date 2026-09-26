import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { symlinkSync, unlinkSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
// Planted repository for the xcode configuration: a project with a source in no target, a catalog with a hole, and a plist that opens the network.
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import type { Finding } from '#cli/types/checks/checks.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/types/support/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';
import { install, installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { XCODE_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';
import { HOME, IMAGES, PLAN, XCODE_PROJECT } from '#tests/constants/acceptance/source/configurations/configurations.ts';

const plist = (body: string): string =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n${body}</dict>\n</plist>\n`;
const STRINGS_FILE = (german: string): string =>
    `{\n    "sourceLanguage": "en",\n    "strings": {\n        "hello": { "localizations": { "de": {}, "en": {} } },\n        "bye": { "localizations": { ${german}"en": {} } }\n    },\n    "version": "1.0"\n}\n`;
const ENTITLED = plist('    <key>com.apple.developer.healthkit</key>\n    <true/>\n');

const CASES: FindingCase[] = [
    {
        check: 'xcode/plist',
        files: { 'App/Info.plist': '<plist><dict><key>broken</dict></plist>\n' },
        expected: { file: 'App/Info.plist' },
    },
    {
        check: 'xcode/xcconfig',
        files: { 'App/Base.xcconfig': 'SWIFT_VERSION = 5.9\nthis line means nothing\n' },
        expected: { file: 'App/Base.xcconfig', rule: 'xcconfig-line', line: 2 },
    },
    {
        check: 'xcode/xcstrings',
        files: { 'App/Localizable.xcstrings': STRINGS_FILE('') },
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
    },
    {
        check: 'xcode/test-plan',
        files: {
            'App.xcodeproj/project.pbxproj': XCODE_PROJECT.replace('name = AppTests;', () => 'name = OtherTests;'),
        },
        expected: { file: 'App.xcodeproj/project.pbxproj', rule: 'target-plan', line: 1 },
    },
    {
        check: 'xcode/orphan-sources',
        files: { 'App/Extra.swift': 'let extra = 1\n' },
        expected: { file: 'App/Extra.swift', rule: 'no-target', line: 1 },
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
        policyEdit: ['[tools.xcode]\n', '[tools.xcode]\nentitlements_allowed = ["aps-environment"]\n'],
        expected: { file: 'App/App.entitlements', rule: 'entitlement', line: 5 },
    },
    {
        check: 'xcode/ats',
        files: {
            'App/Info.plist': plist(
                '    <key>NSAppTransportSecurity</key>\n    <dict>\n        <key>NSAllowsArbitraryLoads</key>\n        <true/>\n    </dict>\n',
            ),
        },
        expected: { file: 'App/Info.plist', rule: 'arbitrary-loads', line: 7 },
    },
];

async function installedXcodeProject() {
    const sandbox = await testdir();
    try {
        await createFileTree(sandbox.path, {
            'App.xcodeproj/project.pbxproj': XCODE_PROJECT,
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
        await installAtLevel(sandbox.path, XCODE_INIT, environment);
        commitAll(sandbox.path);
        return { sandbox, environment };
    } catch (error) {
        await sandbox[Symbol.asyncDispose]();
        throw error;
    }
}

describe('the xcode configuration', () => {
    test.each(CASES)(
        '$check reports its defect in $expected.file and accepts corrected project files',
        async (planted) => {
            const prepared = await installedXcodeProject();
            await using sandbox = prepared.sandbox;
            const environment = prepared.environment;
            const outcome = await runPlanted(sandbox.path, planted, environment);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            // The plist check needs the macOS plutil, so it is skipped elsewhere and the run passes.
            const isSkipped = planted.check === 'xcode/plist' && process.platform !== 'darwin';
            const withExpected: Finding[] = containingAll([containing(planted.expected)]);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(isSkipped ? 0 : 1);
            expect(failed.checks).toMatchObject([{ check: planted.check, status: isSkipped ? 'skipped' : 'fail' }]);
            expect(failed.checks[0]!.findings).toStrictEqual(isSkipped ? [] : withExpected);
            const files: Record<string, string> = {};
            if (planted.expected.rule === 'orphan-asset') {
                Object.assign(files, planted.files);
                files['App/Home.swift'] = HOME + '\nlet accent = Color("Unused")\n';
            }
            if (planted.expected.rule === 'no-target') {
                Object.assign(files, planted.files);
                files['App.xcodeproj/project.pbxproj'] = XCODE_PROJECT.replace(
                    'children = (A1,);',
                    'children = (A1, A2,);',
                )
                    .replace('files = (B1,);', 'files = (B1, B2,);')
                    .replace(
                        'objects = {',
                        'objects = {\nA2 = {isa = PBXFileReference; path = Extra.swift; sourceTree = "<group>"; };\nB2 = {isa = PBXBuildFile; fileRef = A2; };',
                    );
            }
            if (planted.expected.rule === 'target-plan') {
                Object.assign(files, planted.files);
                files['App.xctestplan'] = PLAN.replace('AppTests', 'OtherTests');
            }
            if (planted.expected.rule === 'entitlement')
                files['App/App.entitlements'] = plist(
                    '    <key>aps-environment</key>\n    <string>development</string>\n',
                );
            if (planted.expected.rule === 'arbitrary-loads')
                files['App/Info.plist'] = planted.files['App/Info.plist']!.replace('<true/>', '<false/>');
            const corrected = await runPlanted(sandbox.path, { ...planted, files, removed: [] }, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([
                { check: planted.check, status: isSkipped ? 'skipped' : 'ok', findings: [] },
            ]);
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});

test(
    'Xcode reports a tracked symlink and accepts replacement with a regular source file',
    async () => {
        const prepared = await installedXcodeProject();
        await using sandbox = prepared.sandbox;
        const environment = prepared.environment;
        symlinkSync('Home.swift', join(sandbox.path, 'App/Linked.swift'));
        commitAll(sandbox.path);
        const args = ['check', '--only', 'xcode/symlinks', '--no-cache', '--json'];
        const linked = await run(sandbox.path, args, environment);
        expect(linked.code, linked.stdout + linked.stderr).toBe(1);
        expect(reportSchema.parse(JSON.parse(linked.stdout)).checks).toMatchObject([
            {
                check: 'xcode/symlinks',
                status: 'fail',
                findings: [{ file: 'App/Linked.swift', rule: 'symlink', line: 1 }],
            },
        ]);
        unlinkSync(join(sandbox.path, 'App/Linked.swift'));
        await Bun.write(join(sandbox.path, 'App/Linked.swift'), HOME);
        commitAll(sandbox.path);
        const corrected = await run(sandbox.path, args, environment);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
            { check: 'xcode/symlinks', status: 'ok', findings: [] },
        ]);
    },
    PLANTED_TIMEOUT_MS * 3,
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
