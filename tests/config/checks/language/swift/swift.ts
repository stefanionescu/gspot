export const PRIVATE_OTHER_FINDING = {
    file: '/var/folders/project/Other.swift',
    line: 5,
    column: 3,
    rule: 'compiler',
    message: 'Unknown name',
} as const;

export const PRIVATE_MAIN_FINDING = {
    file: '/var/folders/project/Main.swift',
    line: 4,
    column: 2,
    rule: 'compiler',
    message: 'Missing value',
} as const;

export const FAILED_BUILD_FINDINGS = [
    {
        check: 'swift/build',
        file: 'Main.swift',
        line: 4,
        column: 2,
        rule: 'compiler',
        message: 'Missing value',
        fixable: false,
        help: 'Fix the first compiler error; later ones often come from the same mistake.',
    },
] as const;

export const SWIFT_REPLACEMENT_CASES = [
    { checkId: 'swift/build', rule: 'compiler' },
    { checkId: 'swift/swiftlint-analyze', rule: 'analyzer' },
    { checkId: 'swift/periphery', rule: 'unused' },
] as const;

const EXAMPLE_TARGET_LIMIT = '[[coverage.swift_target]]\nname = "Example"\nlines = 80\n';

export const XCTEST_TABLES = `${EXAMPLE_TARGET_LIMIT}[swift]\nxcode_project = "Example.xcodeproj"\nxcode_scheme = "Example"\n`;

export const XCTEST_FAILURES = [
    {
        failure: 'no-project',
        note: 'Set swift.xcode_project or add Package.swift in this scope.',
        tables: `${EXAMPLE_TARGET_LIMIT}[swift]\nxcode_scheme = "Example"\n`,
        build: [],
        coverage: 1,
        code: 0,
        status: 'skipped',
        produced: false,
    },
    {
        failure: 'failed-test',
        note: undefined,
        tables: XCTEST_TABLES,
        build: ['--exit', '65', '--failure', 'ExampleTests.swift:3: error: -[ExampleTests testValue] : Expected true.'],
        coverage: 1,
        code: 1,
        status: 'failed',
        produced: false,
    },
    {
        failure: 'malformed',
        note: 'The swift/coverage check failed: xccov printed output that gspot cannot read.',
        tables: XCTEST_TABLES,
        build: [],
        coverage: undefined,
        code: 2,
        status: 'error',
        produced: true,
    },
    {
        failure: 'under-minimum',
        note: undefined,
        tables: XCTEST_TABLES,
        build: [],
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

const SWIFT_TARGET_COVERAGE_OUTPUT = {
    targets: [
        { name: 'App', lineCoverage: 0.6 },
        { name: 'Library', lineCoverage: 0.75 },
    ],
} as const;

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
        report: SWIFT_TARGET_COVERAGE_OUTPUT,
        tables: '[coverage]\nlines = 70\nswift_target = []\n',
        expected: ['App covers 60% of its lines, under the limit of 70%.'],
    },
    {
        name: 'a named target overrides the shared limit',
        report: SWIFT_TARGET_COVERAGE_OUTPUT,
        tables: '[coverage]\nlines = 70\n[[coverage.swift_target]]\nname = "App"\nlines = 60\nreason = "Required target coverage."\n',
        expected: [],
    },
    {
        name: 'no coverage limit is enabled',
        report: SWIFT_TARGET_COVERAGE_OUTPUT,
        tables: '[coverage]\nlines = 0\nswift_target = []\n',
        expected: [],
    },
] as const;

export const UNTESTED_COVERAGE_RESULTS = [
    {
        check: 'swift/coverage',
        status: 'skipped',
        note: 'Needs files marked swift-test or swift-test-target in this scope.',
    },
] as const;

export const SKIP_REASON_CASES = [
    { body: 'let trait = .enabled(if: false)', missing: true },
    { body: 'let trait = Testing.ConditionTrait.enabled(if: false, "Requires a simulator")', missing: false },

    { body: 'try XCTSkip()', missing: true },
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

export const ANALYZER_EXIT_CASES = [
    { buildCode: 7, analyzerCode: 0, message: 'Cannot analyze Swift because the build exited 7.' },
    {
        buildCode: 0,
        analyzerCode: 7,
        message: 'The swiftlint command failed (exit 7): The tool printed no error output.',
    },
] as const;

export const NESTED_SWIFTLINT_FILES = [
    'app/.swiftlint.yml',
    'app/Sources/.swiftlint.yml',
    'app/Sources/Feature/.swiftlint.yml',
] as const;
