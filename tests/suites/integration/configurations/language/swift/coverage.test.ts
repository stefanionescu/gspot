import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { isMacos } from '#tests/setup/system/platform.ts';
import { redirectCacheFolder } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

const XCTEST_COVERAGE_SOURCE = `func first() -> Int {
    return 1
}
func second() -> Int {
    return 2
}
`;

const XCTEST_COVERAGE_TESTS = `import XCTest
final class ValueTests: XCTestCase {
    func testValues() {
        XCTAssertEqual(first(), 1)
    }
}
`;

const COVERAGE_TARGET_SETTINGS = {
    tables: `[[coverage.swift_target]]
name = "Inspection.xctest"
min_line_percent = 100

[swift]
xcode_project = "Inspection.xcodeproj"
xcode_scheme = "Inspection"
xcode_destination = "platform=macOS"
`,
    level: 'all',
} as const;

const TEST_TARGET_PBXPROJ = `// !$*UTF8*$!
{
 archiveVersion = 1; objectVersion = 56; rootObject = P1;
 objects = {
 P1 = { isa = PBXProject; buildConfigurationList = C1; compatibilityVersion = "Xcode 14.0"; mainGroup = G1; productRefGroup = G2; targets = (T1,); };
 G1 = { isa = PBXGroup; children = (F1,F2,G2,); sourceTree = "<group>"; };
 G2 = { isa = PBXGroup; name = Products; children = (F3,); sourceTree = "<group>"; };
 F1 = { isa = PBXFileReference; path = Value.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
 F2 = { isa = PBXFileReference; path = ValueTests.swift; lastKnownFileType = sourcecode.swift; sourceTree = "<group>"; };
 F3 = { isa = PBXFileReference; path = Inspection.xctest; explicitFileType = "wrapper.cfbundle"; sourceTree = BUILT_PRODUCTS_DIR; };
 B1 = { isa = PBXBuildFile; fileRef = F1; }; B2 = { isa = PBXBuildFile; fileRef = F2; };
 S1 = { isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (B1,B2,); runOnlyForDeploymentPostprocessing = 0; };
 T1 = { isa = PBXNativeTarget; name = Inspection; productName = Inspection; productReference = F3; productType = "com.apple.product-type.bundle.unit-test"; buildConfigurationList = C2; buildPhases = (S1,); buildRules = (); dependencies = (); };
 C1 = { isa = XCConfigurationList; buildConfigurations = (D1,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 C2 = { isa = XCConfigurationList; buildConfigurations = (D2,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug; };
 D1 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 14.0; }; };
 D2 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = Inspection; PRODUCT_BUNDLE_IDENTIFIER = "com.example.gspot.coverage"; SWIFT_VERSION = 6.0; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; GENERATE_INFOPLIST_FILE = YES; CODE_SIGNING_ALLOWED = NO; }; };
 };
}
`;

test.skipIf(!isMacos)(
    'swift/tests reports a target under its coverage limit and passes after testing the uncovered function',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], COVERAGE_TARGET_SETTINGS),
            'Inspection.xcodeproj/project.pbxproj': TEST_TARGET_PBXPROJ,
            'Inspection.xcodeproj/xcshareddata/xcschemes/Inspection.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" codeCoverageEnabled="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></TestableReference></Testables></TestAction></Scheme>\n',
            'Value.swift': XCTEST_COVERAGE_SOURCE,
            'ValueTests.swift': XCTEST_COVERAGE_TESTS,
        });

        await using _cache = await redirectCacheFolder();
        const command = ['check', '--only', 'swift/tests', '--json'];
        const failed = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
        expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
        expect(failed.checks).toMatchObject([
            {
                check: 'swift/tests',
                status: 'failed',
                findings: [
                    {
                        file: 'Inspection.xcodeproj',
                        rule: 'coverage',
                        line: 1,
                        message: expect.stringMatching(/Inspection\.xctest.+\b72%.+\b100%/u) as string,
                    },
                ],
            },
        ]);
        await writeFile(
            join(sandbox.path, 'ValueTests.swift'),
            XCTEST_COVERAGE_TESTS.replace(
                'XCTAssertEqual(first(), 1)',
                'XCTAssertEqual(first(), 1)\n        XCTAssertEqual(second(), 2)',
            ),
        );
        const corrected = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
        expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
        expect(corrected.checks).toMatchObject([{ check: 'swift/tests', status: 'passed', findings: [] }]);
    },
);
