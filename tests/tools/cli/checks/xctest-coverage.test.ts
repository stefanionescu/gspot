import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rmSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildFolder } from '#cli/platform/paths.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { onMac } from '#tests/harness/cli/platforms.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runOptions } from '#tests/harness/cli/command.ts';
import { textContaining } from '#tests/harness/expectations.ts';

const XCTEST_COVERAGE_SOURCE = 'func first() -> Int {\n    return 1\n}\nfunc second() -> Int {\n    return 2\n}\n';

const XCTEST_COVERAGE_TESTS =
    'import XCTest\nfinal class ValueTests: XCTestCase {\n    func testValues() {\n        XCTAssertEqual(first(), 1)\n    }\n}\n';

const XCTEST_COVERAGE_PROJECT = `// !$*UTF8*$!
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
 C1 = { isa = XCConfigurationList; buildConfigurations = (D1,); defaultKitIsVisible = 0; defaultKitName = Debug; };
 C2 = { isa = XCConfigurationList; buildConfigurations = (D2,); defaultKitIsVisible = 0; defaultKitName = Debug; };
 D1 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { SDKROOT = macosx; MACOSX_DEPLOYMENT_TARGET = 14.0; }; };
 D2 = { isa = XCBuildConfiguration; name = Debug; buildSettings = { PRODUCT_NAME = Inspection; PRODUCT_BUNDLE_IDENTIFIER = "com.example.gspot.coverage"; SWIFT_VERSION = 6.0; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; GENERATE_INFOPLIST_FILE = YES; CODE_SIGNING_ALLOWED = NO; }; };
 };
}
`;

if (onMac)
    test('XCTest and xccov report a below-floor target and pass after testing its uncovered function', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(
                ['xctest', 'xcode'],
                '[tools.xcode]\nproject = "Inspection.xcodeproj"\nscheme = "Inspection"\ndestination = "platform=macOS"\n[[tools.xctest.coverage]]\ntarget = "Inspection.xctest"\npercent = 100\n',
                'all',
            ),
            'Inspection.xcodeproj/project.pbxproj': XCTEST_COVERAGE_PROJECT,
            'Inspection.xcodeproj/xcshareddata/xcschemes/Inspection.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" codeCoverageEnabled="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></TestableReference></Testables></TestAction></Scheme>\n',
            'Value.swift': XCTEST_COVERAGE_SOURCE,
            'ValueTests.swift': XCTEST_COVERAGE_TESTS,
        });
        try {
            const failed = await executeRun(
                await openSession(sandbox.path),
                runOptions({ stage: 'push', only: ['xctest/coverage'], isDryRun: true }),
            );
            expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
            expect(failed.report.checks).toMatchObject([
                {
                    check: 'xctest/coverage',
                    status: 'failed',
                    findings: [{ rule: 'coverage', line: 1, message: textContaining('under the floor of 100') }],
                },
            ]);
            await Bun.write(
                join(sandbox.path, 'ValueTests.swift'),
                XCTEST_COVERAGE_TESTS.replace(
                    'XCTAssertEqual(first(), 1)',
                    'XCTAssertEqual(first(), 1)\n        XCTAssertEqual(second(), 2)',
                ),
            );
            const corrected = await executeRun(
                await openSession(sandbox.path),
                runOptions({ stage: 'push', only: ['xctest/coverage'], isDryRun: true }),
            );
            expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
            expect(corrected.report.checks).toMatchObject([
                { check: 'xctest/coverage', status: 'passed', findings: [] },
            ]);
            expect(readFileSync(join(sandbox.path, 'Value.swift'), 'utf8')).toBe(XCTEST_COVERAGE_SOURCE);
            expect(readFileSync(join(sandbox.path, 'Inspection.xcodeproj/project.pbxproj'), 'utf8')).toBe(
                XCTEST_COVERAGE_PROJECT,
            );
        } finally {
            rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
        }
    }, 180_000);
