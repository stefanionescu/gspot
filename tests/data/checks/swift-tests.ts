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

export const PARSER_SOURCE = `public func parsed(_ value: String) -> Int {
    Int(value)! + 42
}
`;

export const FIXED_PARSER_SOURCE = `/// Parses a sample value.
public func parsed(_ value: String) -> Int {
    Int(value) ?? 0
}
`;

export const XCTEST_SCOPES = [
    { name: 'at the root', scope: '' },
    { name: 'in a scope whose path has a space and #', scope: 'ios # app' },
] as const;

export const XCTEST_SETTINGS = `configurations = ["swift-tests", "xcode"]
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
        settings: `configurations = ["swift-tests", "xcode"]
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
        note: 'targets',
        settings: XCTEST_SETTINGS,
        build: '',
        coverage: undefined,
        code: 2,
        status: 'error',
        produced: true,
    },
    {
        failure: 'under-floor',
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

export const SKIP_REASON_CASES = [
    { body: 'try XCTSkip()', missing: true },
    { body: 'try XCTSkip("")', missing: true },
    { body: 'try XCTSkip("   ")', missing: true },
    { body: 'try XCTSkip(nil)', missing: true },
    { body: 'try XCTSkip("CI")', missing: false },
    { body: 'print("unrelated long string"); try XCTSkipIf(true, "")', missing: true },
    { body: 'try XCTSkipIf(condition("unrelated long string"))', missing: true },
    { body: 'try XCTSkipUnless(true, "Requires a simulator")', missing: false },
    { body: 'service.disabled(if: true)', missing: false },
    { body: 'let trait = .disabled(if: true, "")', missing: true },
    { body: 'let trait = .disabled(if: true, "Requires a simulator")', missing: false },
    { body: '@available(*, unavailable, message: "")\nfunc unavailableTest() {}', missing: true },
    {
        body: '@available(*, unavailable, message: "Requires a simulator")\nfunc unavailableTest() {}',
        missing: false,
    },
    { body: 'let example = "XCTSkip()"\n/* XCTSkip() */\n// XCTSkip()', missing: false },
] as const;

export const SWIFTLINT_COMMAND = ['check', '--only', 'swift/swiftlint', '--json'];

/** The same application and library coverage used with different configured limits. */
export const SWIFT_TARGET_COVERAGE_REPORT = {
    targets: [
        { name: 'App', lineCoverage: 0.6 },
        { name: 'Library', lineCoverage: 0.75 },
    ],
} as const;
