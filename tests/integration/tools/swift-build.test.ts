import { join } from 'node:path';
import { afterEach, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { buildFolder } from '#cli/platform/paths.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { swiftBuild } from '#cli/checks/swift/build.ts';
import { swiftBuildPlan } from '#cli/checks/swift/plan.ts';
import { rmSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';

const caches = new Set<string>();
afterEach(() => {
    for (const folder of caches) rmSync(folder, { recursive: true, force: true });
    caches.clear();
});

async function inputFor(root: string, check: string): Promise<EngineInput> {
    caches.add(buildFolder(root));
    const session = await openSession(root);
    const selection = session.scopes[0]!;
    const spec = selection.selected.flatMap((manifest) => manifest.checks).find((entry) => entry.name === check)!;
    return engineInput(session, {
        scope: session.scopes.find((entry) => entry.scope.path === '')!,
        spec: spec,
        files: session.repository.files,
    });
}

test('incremental Swift builds preserve compiler state and still detect a changed source', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["swift"]\n',
        'Package.swift':
            '// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "Example", targets: [.target(name: "Example")])\n',
        'Sources/Example/Value.swift': 'public let value: Int = 1\n',
    });
    const first = await inputFor(sandbox.path, 'swift/build');
    const start = performance.now();
    expect(await swiftBuild(first)).toStrictEqual([]);
    const initialMs = performance.now() - start;
    const plan = swiftBuildPlan(first);
    const files = [...new Bun.Glob('**/Value.swift.o').scanSync({ cwd: plan.folder })];
    expect(files).toHaveLength(1);
    const object = join(plan.folder, files[0]!);
    const modified = statSync(object).mtimeMs;
    const again = await inputFor(sandbox.path, 'swift/build');
    const repeatedStart = performance.now();
    expect(await swiftBuild(again)).toStrictEqual([]);
    const repeatedMs = performance.now() - repeatedStart;
    expect(statSync(object).mtimeMs).toBe(modified);
    console.log(`Swift compile: initial ${initialMs.toFixed(0)} ms; unchanged ${repeatedMs.toFixed(0)} ms`);
    writeFileSync(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = "wrong"\n');
    expect(await swiftBuild(await inputFor(sandbox.path, 'swift/build'))).toMatchObject([
        { file: 'Sources/Example/Value.swift', line: 1, rule: 'compiler' },
    ]);
    writeFileSync(join(sandbox.path, 'Sources/Example/Value.swift'), 'public let value: Int = 2\n');
    expect(await swiftBuild(await inputFor(sandbox.path, 'swift/build'))).toStrictEqual([]);
}, 120_000);

test.skipIf(process.platform !== 'darwin')(
    'Xcode reuses compiled objects and reports source errors without changing the project',
    async () => {
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
        C1 = { isa = XCConfigurationList; buildConfigurations = (D1,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
        C2 = { isa = XCConfigurationList; buildConfigurations = (D2,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
        D1 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 14.0; }; };
        D2 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = Example; SWIFT_VERSION = 6.0; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; }; };
    };
}
`;
        const source = 'let value: Int = 1\nprint(value)\n';
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nconfigurations = ["swift", "xcode"]\n[tools.xcode]\nproject = "Example.xcodeproj"\nscheme = "Example"\ndestination = "platform=macOS"\n',
            'Example.xcodeproj/project.pbxproj': project,
            'Example.xcodeproj/xcshareddata/xcschemes/Example.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Example" BlueprintName="Example" ReferencedContainer="container:Example.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug"/></Scheme>\n',
            'main.swift': source,
            'untracked.txt': 'authored content\n',
        });
        const first = await inputFor(sandbox.path, 'swift/build');
        expect(await swiftBuild(first)).toStrictEqual([]);
        const plan = swiftBuildPlan(first);
        const objects = [...new Bun.Glob('derived/**/main.o').scanSync({ cwd: plan.folder })];
        expect(objects.length).toBeGreaterThan(0);
        const times = objects.map((file) => statSync(join(plan.folder, file)).mtimeMs);
        expect(await swiftBuild(await inputFor(sandbox.path, 'swift/build'))).toStrictEqual([]);
        expect(objects.map((file) => statSync(join(plan.folder, file)).mtimeMs)).toStrictEqual(times);
        expect(readFileSync(join(sandbox.path, 'main.swift'), 'utf8')).toBe(source);
        expect(readFileSync(join(sandbox.path, 'Example.xcodeproj/project.pbxproj'), 'utf8')).toBe(project);
        expect(readFileSync(join(sandbox.path, 'untracked.txt'), 'utf8')).toBe('authored content\n');
        expect(existsSync(join(sandbox.path, 'build'))).toBe(false);
        writeFileSync(join(sandbox.path, 'main.swift'), 'let value: Int = "wrong"\nprint(value)\n');
        expect(await swiftBuild(await inputFor(sandbox.path, 'swift/build'))).toMatchObject([
            { file: 'main.swift', line: 1, column: 18, rule: 'compiler' },
        ]);
        writeFileSync(join(sandbox.path, 'main.swift'), source);
        expect(await swiftBuild(await inputFor(sandbox.path, 'swift/build'))).toStrictEqual([]);
    },
    120_000,
);
