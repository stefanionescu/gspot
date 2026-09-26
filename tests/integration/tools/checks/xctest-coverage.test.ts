import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { rmSync, readFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { buildFolder } from '#cli/platform/paths.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';

const PROJECT = `// !$*UTF8*$!
{
 archiveVersion = 1; objectVersion = 56; rootObject = P1;
 objects = {
 P1 = { isa = PBXProject; buildConfigurationList = C1; compatibilityVersion = "Xcode 14.0"; mainGroup = G1; productRefGroup = G2; targets = (T1,); };
 G1 = { isa = PBXGroup; children = (F1,F2,G2,); sourceTree = "<group>"; };
 G2 = { isa = PBXGroup; name = Products; children = (F3,); sourceTree = "<group>"; };
 F1 = { isa = PBXFileReference; path = Value.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
 F2 = { isa = PBXFileReference; path = ValueTests.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
 F3 = { isa = PBXFileReference; path = Probe.xctest; explicitFileType = "wrapper.cfbundle"; sourceTree = BUILT_PRODUCTS_DIR; };
 B1 = { isa = PBXBuildFile; fileRef = F1; }; B2 = { isa = PBXBuildFile; fileRef = F2; };
 S1 = { isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (B1,B2,); runOnlyForDeploymentPostprocessing = 0; };
 T1 = { isa = PBXNativeTarget; name = Probe; productName = Probe; productReference = F3; productType = "com.apple.product-type.bundle.unit-test"; buildConfigurationList = C2; buildPhases = (S1,); buildRules = (); dependencies = (); };
 C1 = { isa = XCConfigurationList; buildConfigurations = (D1,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 C2 = { isa = XCConfigurationList; buildConfigurations = (D2,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 D1 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 14.0; }; };
 D2 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = Probe; PRODUCT_BUNDLE_IDENTIFIER = "com.example.gspot.coverage"; SWIFT_VERSION = 6.0; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; GENERATE_INFOPLIST_FILE = YES; CODE_SIGNING_ALLOWED = NO; }; };
 };
}
`;
const SOURCE = 'func first() -> Int {\n    return 1\n}\nfunc second() -> Int {\n    return 2\n}\n';
const TESTS =
    'import XCTest\nfinal class ValueTests: XCTestCase {\n    func testValues() {\n        XCTAssertEqual(first(), 1)\n    }\n}\n';

test.skipIf(process.platform !== 'darwin')(
    'XCTest and xccov report a below-floor target and pass after testing its uncovered function',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nlevel = "all"\nconfigurations = ["xctest", "xcode"]\n[tools.xcode]\nproject = "Probe.xcodeproj"\nscheme = "Probe"\ndestination = "platform=macOS"\n[[tools.xctest.coverage]]\ntarget = "Probe.xctest"\npercent = 100\n',
            'Probe.xcodeproj/project.pbxproj': PROJECT,
            'Probe.xcodeproj/xcshareddata/xcschemes/Probe.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Probe.xctest" BlueprintName="Probe" ReferencedContainer="container:Probe.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" codeCoverageEnabled="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Probe.xctest" BlueprintName="Probe" ReferencedContainer="container:Probe.xcodeproj"/></TestableReference></Testables></TestAction></Scheme>\n',
            'Value.swift': SOURCE,
            'ValueTests.swift': TESTS,
        });
        const check = async () =>
            await executeRun(await openSession(sandbox.path), {
                stage: 'push',
                only: ['xctest/coverage'],
                skips: [],
                fix: false,
                isDryRun: true,
                noCache: true,
            });
        try {
            const failed = await check();
            expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
            expect(failed.report.checks).toMatchObject([
                {
                    check: 'xctest/coverage',
                    status: 'fail',
                    findings: [
                        { rule: 'coverage', line: 1, message: expect.stringContaining('under the floor of 100') },
                    ],
                },
            ]);
            await Bun.write(
                join(sandbox.path, 'ValueTests.swift'),
                TESTS.replace(
                    'XCTAssertEqual(first(), 1)',
                    'XCTAssertEqual(first(), 1)\n        XCTAssertEqual(second(), 2)',
                ),
            );
            const corrected = await check();
            expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
            expect(corrected.report.checks).toMatchObject([{ check: 'xctest/coverage', status: 'ok', findings: [] }]);
            expect(readFileSync(join(sandbox.path, 'Value.swift'), 'utf8')).toBe(SOURCE);
            expect(readFileSync(join(sandbox.path, 'Probe.xcodeproj/project.pbxproj'), 'utf8')).toBe(PROJECT);
        } finally {
            rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
        }
    },
    180_000,
);
