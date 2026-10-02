import { join } from 'node:path';
import { test, expect, afterEach } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { onMac } from '#tests/harness/cli/platforms.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { swiftBuild } from '#cli/checks/language/swift/build.ts';
import { swiftBuildPlan } from '#cli/checks/language/swift/plan.ts';
import { statSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { swiftInput, removeBuildFolders } from '#tests/harness/cli/swift.ts';

afterEach(() => {
    removeBuildFolders();
});

// The manifest assigns compiler-backed Swift checks to macOS.
if (onMac) {
    test('incremental Swift builds preserve compiler state and still detect a changed source', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['swift']),
            'Package.swift':
                '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Example", targets: [.target(name: "Example")])\n',
            'Sources/Example/Value.swift': 'public let value: Int = 1\n',
        });
        const first = await swiftInput(sandbox.path, 'swift/build');
        expect(await swiftBuild(first)).toStrictEqual([]);
        const plan = swiftBuildPlan(first);
        const files = [...new Bun.Glob('**/Value.swift.o').scanSync({ cwd: plan.folder })];
        expect(files).toHaveLength(1);
        const compiledFile = join(plan.folder, files[0]!);
        const modified = statSync(compiledFile).mtimeMs;
        const again = await swiftInput(sandbox.path, 'swift/build');
        expect(await swiftBuild(again)).toStrictEqual([]);
        expect(statSync(compiledFile).mtimeMs).toBe(modified);
        writeFileSync(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = "wrong"\n');
        expect(await swiftBuild(await swiftInput(sandbox.path, 'swift/build'))).toMatchObject([
            { file: 'Sources/Example/Value.swift', line: 1, rule: 'compiler' },
        ]);
        writeFileSync(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = 2\n');
        expect(await swiftBuild(await swiftInput(sandbox.path, 'swift/build'))).toStrictEqual([]);
    }, 120_000);

    test('Xcode reuses compiled objects and reports source errors without changing the project', async () => {
        await using sandbox = await testdir();
        const project = `// !$*UTF8*$!
{
    archiveVersion = 1;
    objectVersion = 56;
    rootObject = P1;
    objects = {
        P1 = { isa = PBXProject; buildConfigurationList = C1; compatibilityVersion = "Xcode 14.0"; mainGroup = G1; productRefGroup = G2; targets = (T1,); };
        G1 = { isa = PBXGroup; children = (F1, G2,); sourceTree = "<group>"; };
        G2 = { isa = PBXGroup; name = Products; children = (F2,); sourceTree = "<group>"; };
        F1 = { isa = PBXFileReference; path = main.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
        F2 = { isa = PBXFileReference; path = Example; explicitFileType = "compiled.mach-o.executable"; sourceTree = BUILT_PRODUCTS_DIR; };
        B1 = { isa = PBXBuildFile; fileRef = F1; };
        S1 = { isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (B1,); runOnlyForDeploymentPostprocessing = 0; };
        T1 = { isa = PBXNativeTarget; name = Example; productName = Example; productReference = F2; productType = "com.apple.product-type.tool"; buildConfigurationList = C2; buildPhases = (S1,); buildRules = (); dependencies = (); };
        C1 = { isa = XCConfigurationList; buildConfigurations = (D1,); defaultKitIsVisible = 0; defaultKitName = Debug; };
        C2 = { isa = XCConfigurationList; buildConfigurations = (D2,); defaultKitIsVisible = 0; defaultKitName = Debug; };
        D1 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 14.0; }; };
        D2 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = Example; SWIFT_VERSION = 6.0; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; }; };
    };
}
`;
        const source = 'let value: Int = 1\nprint(value)\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(
                ['swift', 'xcode'],
                '[tools.xcode]\nproject = "Example.xcodeproj"\nscheme = "Example"\ndestination = "platform=macOS"\n',
            ),
            'Example.xcodeproj/project.pbxproj': project,
            'Example.xcodeproj/xcshareddata/xcschemes/Example.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Example" BlueprintName="Example" ReferencedContainer="container:Example.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug"/></Scheme>\n',
            'main.swift': source,
            'untracked.txt': 'authored content\n',
        });
        const first = await swiftInput(sandbox.path, 'swift/build');
        expect(await swiftBuild(first)).toStrictEqual([]);
        const plan = swiftBuildPlan(first);
        const objects = [...new Bun.Glob('derived/**/main.o').scanSync({ cwd: plan.folder })];
        expect(objects.length).toBeGreaterThan(0);
        const times = objects.map((file) => statSync(join(plan.folder, file)).mtimeMs);
        expect(await swiftBuild(await swiftInput(sandbox.path, 'swift/build'))).toStrictEqual([]);
        expect(objects.map((file) => statSync(join(plan.folder, file)).mtimeMs)).toStrictEqual(times);
        expect(readFileSync(join(sandbox.path, 'main.swift'), 'utf8')).toBe(source);
        expect(readFileSync(join(sandbox.path, 'Example.xcodeproj/project.pbxproj'), 'utf8')).toBe(project);
        expect(readFileSync(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe('authored content\n');
        expect(existsSync(join(sandbox.path, 'build'))).toBe(false);
        writeFileSync(join(sandbox.path, 'main.swift'), 'let value: Int = "wrong"\nprint(value)\n');
        expect(await swiftBuild(await swiftInput(sandbox.path, 'swift/build'))).toMatchObject([
            { file: 'main.swift', line: 1, column: 18, rule: 'compiler' },
        ]);
        writeFileSync(join(sandbox.path, 'main.swift'), source);
        expect(await swiftBuild(await swiftInput(sandbox.path, 'swift/build'))).toStrictEqual([]);
    }, 120_000);
}
