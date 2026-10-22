export const XCTEST_COVERAGE_SOURCE = `func first() -> Int {
    return 1
}
func second() -> Int {
    return 2
}
`;
export const XCTEST_COVERAGE_TESTS = `import XCTest
final class ValueTests: XCTestCase {
    func testValues() {
        XCTAssertEqual(first(), 1)
    }
}
`;
export const XCTEST_SETTINGS = `configurations = ["swift", "xcode"]
[[coverage.swift_target]]
name = "Example"
lines = 80

[swift]
xcode_project = "Example.xcodeproj"
xcode_scheme = "Example"
`;
export const XCTEST_FAILURES = [
    {
        failure: 'no-project',
        note: undefined,
        settings: `configurations = ["swift", "xcode"]
[[coverage.swift_target]]
name = "Example"
lines = 80

[swift]
xcode_scheme = "Example"
`,
        build: '',
        coverage: 1,
        code: 0,
        status: 'skipped',
        produced: false,
    },
    {
        failure: 'failed-test',
        note: 'test run exited 65',
        settings: XCTEST_SETTINGS,
        build: 'process.exitCode = 65;',
        coverage: 1,
        code: 2,
        status: 'error',
        produced: false,
    },
    {
        failure: 'malformed',
        note: 'xccov printed output that gspot cannot read.',
        settings: XCTEST_SETTINGS,
        build: '',
        coverage: undefined,
        code: 2,
        status: 'error',
        produced: true,
    },
    {
        failure: 'under-minimum',
        note: undefined,
        settings: XCTEST_SETTINGS,
        build: '',
        coverage: 0.5,
        code: 1,
        status: 'failed',
        produced: true,
    },
] as const;
export const SWIFT_PACKAGE_COVERAGE_TARGETS = [
    {
        name: 'Core',
        path: 'Custom/Core',
        type: 'library',
        module_type: 'SwiftTarget',
        sources: ['First.swift', 'Second.swift'],
    },
    { name: 'API', path: 'Sources/API', type: 'library', module_type: 'SwiftTarget', sources: ['API.swift'] },
    {
        name: 'CoreTests',
        path: 'Tests/CoreTests',
        type: 'test',
        module_type: 'SwiftTarget',
        sources: ['CoreTests.swift'],
    },
    { name: 'Native', path: 'Sources/Native', type: 'library', module_type: 'ClangTarget', sources: ['native.c'] },
] as const;
export const SWIFT_PACKAGE_COVERAGE_FILES = [
    { filename: 'Custom/Core/First.swift', summary: { lines: { count: 3, covered: 1 } } },
    { filename: 'Custom/Core/Second.swift', summary: { lines: { count: 1, covered: 1 } } },
    { filename: 'Sources/API/API.swift', summary: { lines: { count: 3, covered: 2 } } },
    { filename: 'Tests/CoreTests/CoreTests.swift', summary: { lines: { count: 2, covered: 2 } } },
] as const;

/** One coverage report for the app and library targets, checked against different limits. */
const SWIFT_TARGET_COVERAGE_REPORT = {
    targets: [
        { name: 'App', lineCoverage: 0.6 },
        { name: 'Library', lineCoverage: 0.75 },
    ],
} as const;

/** Shared and per-target coverage limits, written as the TOML each run reads. */
export const COVERAGE_LIMIT_CASES = [
    {
        name: 'a named target passes its limit',
        report: { targets: [{ name: 'App.app', lineCoverage: 0.617 }] },
        tables: '[coverage]\nlines = 0\n[[coverage.swift_target]]\nname = "App"\nlines = 61\nreason = "Required target coverage."\n',
        expected: [],
    },
    {
        name: 'a named target misses its limit',
        report: { targets: [{ name: 'App.app', lineCoverage: 0.617 }] },
        tables: '[coverage]\nlines = 0\n[[coverage.swift_target]]\nname = "App"\nlines = 62\nreason = "Required target coverage."\n',
        expected: ['App covers 61% of its lines, under the limit of 62%.'],
    },
    {
        name: 'a named target is absent',
        report: { targets: [{ name: 'App.app', lineCoverage: 0.617 }] },
        tables: '[coverage]\nlines = 0\n[[coverage.swift_target]]\nname = "Widget"\nlines = 10\nreason = "Required target coverage."\n',
        expected: ['The coverage report has no target named Widget.'],
    },
    {
        name: 'a target misses the shared limit',
        report: SWIFT_TARGET_COVERAGE_REPORT,
        tables: '[coverage]\nlines = 70\nswift_target = []\n',
        expected: ['App covers 60% of its lines, under the limit of 70%.'],
    },
    {
        name: 'a named target overrides the shared limit',
        report: SWIFT_TARGET_COVERAGE_REPORT,
        tables: '[coverage]\nlines = 70\n[[coverage.swift_target]]\nname = "App"\nlines = 60\nreason = "Required target coverage."\n',
        expected: [],
    },
    {
        name: 'no coverage limit is enabled',
        report: SWIFT_TARGET_COVERAGE_REPORT,
        tables: '[coverage]\nlines = 0\nswift_target = []\n',
        expected: [],
    },
] as const;

/** Settings with shared and per-target Swift coverage limits. */
export const COVERAGE_TARGET_SETTINGS = {
    tables: `[[coverage.swift_target]]
name = "Inspection.xctest"
lines = 100

[swift]
xcode_project = "Inspection.xcodeproj"
xcode_scheme = "Inspection"
xcode_destination = "platform=macOS"
`,
    level: 'all',
} as const;

/** The swift/coverage results of a scope without Swift tests. */
export const UNTESTED_COVERAGE_RESULTS = [
    {
        check: 'swift/coverage',
        status: 'skipped',
        note: 'Needs files marked swift-test or swift-test-target in this scope.',
    },
] as const;
export const TEST_TARGET_PBXPROJ = `// !$*UTF8*$!
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
