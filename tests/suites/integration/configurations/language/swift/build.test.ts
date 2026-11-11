import { readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { readCacheFolder } from '#cli/system/environment.ts';
import { SWIFT_LANGUAGE_PACKAGE } from '#tests/config/setup/languages.ts';
import { redirectCacheFolder } from '#tests/setup/cli/checks.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { hasToolBuild, isMacos } from '#tests/setup/system/platform.ts';

const SWIFT_PACKAGE_SANDBOX = {
    install: false,
    configurations: ['swift', 'naming'],
    files: {
        '.gitignore': '.build\nnode_modules/\n',
        'Package.swift': `// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "App",
    products: [.library(name: "App", targets: ["App"])],
    targets: [.target(name: "App")]
)
`,
        'Sources/App/Greeting.swift': String.raw`/// Builds the greeting for a person.
public func greeting(for name: String) -> String {
    "hello \(name)"
}
`,
    },
} as const;

const PAIR_SIZE_SOURCE = `/// The size of a pair.
public func pairSize(of count: Int) -> Int {
    count * 2
}
`;

const SWIFT_PACKAGE_CASES = [
    {
        check: 'swift/swiftlint-analyze',
        tool: 'swiftlint',
        files: { 'Sources/App/Pair.swift': `import Foundation\n\n${PAIR_SIZE_SOURCE}` },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused_import', line: 1 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR_SIZE_SOURCE } },
    },
    {
        check: 'swift/periphery',
        tool: 'periphery',
        files: {
            'Sources/App/Pair.swift': `${PAIR_SIZE_SOURCE}
private func neverCalled() -> Int {
    3
}
`,
        },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused', line: 6 },
        corrected: { files: { 'Sources/App/Pair.swift': PAIR_SIZE_SOURCE } },
    },
] as const;

const XCODE_TOOL_PROJECT = `// !$*UTF8*$!
{
 archiveVersion = 1; objectVersion = 56; rootObject = P1;
 objects = {
 P1 = { isa = PBXProject; buildConfigurationList = C1; compatibilityVersion = "Xcode 14.0"; mainGroup = G1; productRefGroup = G2; targets = (T1,); };
 G1 = { isa = PBXGroup; children = (F1, G2,); sourceTree = "<group>"; };
 G2 = { isa = PBXGroup; name = Products; children = (F2,); sourceTree = "<group>"; };
 F1 = { isa = PBXFileReference; path = main.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
 F2 = { isa = PBXFileReference; path = Example; explicitFileType = "compiled.mach-o.executable"; sourceTree = BUILT_PRODUCTS_DIR; };
 B1 = { isa = PBXBuildFile; fileRef = F1; };
 S1 = { isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (B1,); runOnlyForDeploymentPostprocessing = 0; };
 T1 = { isa = PBXNativeTarget; name = Example; productName = Example; productReference = F2; productType = "com.apple.product-type.tool"; buildConfigurationList = C2; buildPhases = (S1,); buildRules = (); dependencies = (); };
 C1 = { isa = XCConfigurationList; buildConfigurations = (D1,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 C2 = { isa = XCConfigurationList; buildConfigurations = (D2,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 D1 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 14.0; }; };
 D2 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = Example; SWIFT_VERSION = 6.0; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; }; };
 };
}
`;

test.skipIf(!isMacos)('swift/build reuses its compiled objects and still reports a changed source', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift']),
        'Package.swift': SWIFT_LANGUAGE_PACKAGE,
        'Sources/Example/Value.swift': 'public let value: Int = 1\n',
    });
    await using _cache = await redirectCacheFolder();
    const command = ['check', '--only', 'swift/build', '--json'];
    const first = await runGspot(sandbox.path, command);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const files = await Array.fromAsync(new Bun.Glob('**/Value.swift.o').scan({ cwd: readCacheFolder() }));
    expect(files).toHaveLength(1);
    const compiledFile = join(readCacheFolder(), files[0]!);
    const { mtimeMs: modified } = await stat(compiledFile);
    const again = await runGspot(sandbox.path, command);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    expect(await stat(compiledFile)).toMatchObject({ mtimeMs: modified });
    await writeFile(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = "wrong"\n');
    const failedBuild = parseCheckReport(await runGspot(sandbox.path, command));
    expect(failedBuild.code, failedBuild.stdout + failedBuild.stderr).toBe(1);
    expect(failedBuild.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'Sources/Example/Value.swift', line: 1, rule: 'compiler' },
    ]);
    await writeFile(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = 2\n');
    const repairedBuild = parseCheckReport(await runGspot(sandbox.path, command));
    expect(repairedBuild.code, repairedBuild.stdout + repairedBuild.stderr).toBe(0);
    expect(repairedBuild.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test.skipIf(!isMacos)(
    'swift/build reuses the compiled objects of an Xcode project and reports source errors without changing the project',
    async () => {
        const source = 'let value: Int = 1\nprint(value)\n';
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], {
                tables: `[swift]
xcode_project = "Example.xcodeproj"
xcode_scheme = "Example"
xcode_destination = "platform=macOS"
`,
            }),
            'Example.xcodeproj/project.pbxproj': XCODE_TOOL_PROJECT,
            'Example.xcodeproj/xcshareddata/xcschemes/Example.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Example" BlueprintName="Example" ReferencedContainer="container:Example.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug"/></Scheme>\n',
            'main.swift': source,
        });
        await using _cache = await redirectCacheFolder();
        const command = ['check', '--only', 'swift/build', '--json'];
        const first = await runGspot(sandbox.path, command);
        expect(first.code, first.stdout + first.stderr).toBe(0);
        const unchangedBuild = parseCheckReport(await runGspot(sandbox.path, command));
        expect(unchangedBuild.code, unchangedBuild.stdout + unchangedBuild.stderr).toBe(0);
        expect(unchangedBuild.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
        expect(await readFile(join(sandbox.path, 'Example.xcodeproj/project.pbxproj'), 'utf8')).toBe(
            XCODE_TOOL_PROJECT,
        );
        await writeFile(join(sandbox.path, 'main.swift'), 'let value: Int = "wrong"\nprint(value)\n');
        const changedBuild = parseCheckReport(await runGspot(sandbox.path, command));
        expect(changedBuild.code, changedBuild.stdout + changedBuild.stderr).toBe(1);
        expect(changedBuild.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
            { file: 'main.swift', line: 1, column: 18, rule: 'compiler' },
        ]);
        await writeFile(join(sandbox.path, 'main.swift'), source);
        const restoredBuild = parseCheckReport(await runGspot(sandbox.path, command));
        expect(restoredBuild.code, restoredBuild.stdout + restoredBuild.stderr).toBe(0);
        expect(restoredBuild.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
    },
);

describe.skipIf(!isMacos)('Swift package samples', () => {
    const installedSandbox = shareInstalledSandbox(SWIFT_PACKAGE_SANDBOX);

    for (const sample of SWIFT_PACKAGE_CASES) {
        test.skipIf(!hasToolBuild(sample.tool))(
            `${sample.check} reports ${sample.expected.rule} in a Swift package and passes after the fix`,
            async () => {
                await assertCheckSample(installedSandbox(), sample);
            },
        );
    }
});
