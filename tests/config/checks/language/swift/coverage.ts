import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

const EXAMPLE_TARGET_LIMIT = '[[coverage.swift_target]]\nname = "Example"\nlines = 80\n';

export const XCTEST_SETTINGS = buildSandboxSettings(['swift', 'xcode'], {
    tables: `${EXAMPLE_TARGET_LIMIT}[swift]\nxcode_project = "Example.xcodeproj"\nxcode_scheme = "Example"\n`,
});

export const XCTEST_FAILURES = [
    {
        failure: 'no-project',
        note: 'Set swift.xcode_project or add Package.swift in this scope.',
        settings: buildSandboxSettings(['swift', 'xcode'], {
            tables: `${EXAMPLE_TARGET_LIMIT}[swift]\nxcode_scheme = "Example"\n`,
        }),
        build: [],
        coverage: 1,
        code: 0,
        status: 'skipped',
        produced: false,
    },
    {
        failure: 'failed-test',
        note: 'The swift/coverage check failed: Cannot measure coverage because the test run exited 65: The test runner printed no error output.',
        settings: XCTEST_SETTINGS,
        build: ['--exit', '65'],
        coverage: 1,
        code: 2,
        status: 'error',
        produced: false,
    },
    {
        failure: 'malformed',
        note: 'The swift/coverage check failed: xccov printed output that gspot cannot read.',
        settings: XCTEST_SETTINGS,
        build: [],
        coverage: undefined,
        code: 2,
        status: 'error',
        produced: true,
    },
    {
        failure: 'under-minimum',
        note: undefined,
        settings: XCTEST_SETTINGS,
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

const SWIFT_TARGET_COVERAGE_REPORT = {
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

export const UNTESTED_COVERAGE_RESULTS = [
    {
        check: 'swift/coverage',
        status: 'skipped',
        note: 'Needs files marked swift-test or swift-test-target in this scope.',
    },
] as const;
