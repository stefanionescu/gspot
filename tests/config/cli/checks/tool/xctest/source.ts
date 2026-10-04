import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const CLEAN = `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        XCTAssertEqual("Home", "Home")\n    }\n}\n`;

export const XCTEST_TESTS = 'AppTests/HomeTests.swift';

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['xctest'],
    modules: false,
    installs: false,
    files: {
        [XCTEST_TESTS]: CLEAN,
        'AppTests/__Snapshots__/HomeTests/testTitle.1.png': 'png',
        'AppTests/SkippedTests.swift':
            'import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        throw XCTSkip("Waits for the new design of the header, issue 12.")\n    }\n}\n',
    },
};

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        check: 'xctest/disabled',
        files: {
            [XCTEST_TESTS]:
                'import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        throw XCTSkip()\n    }\n}\n',
        },
        expected: { file: XCTEST_TESTS, rule: 'disabled', line: 7 },
        corrected: {
            files: {
                [XCTEST_TESTS]:
                    'import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        throw XCTSkip("Requires a physical device")\n    }\n}\n',
            },
        },
    },
    {
        check: 'xctest/sleep',
        files: {
            [XCTEST_TESTS]:
                'import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        Thread.sleep(forTimeInterval: 2)\n    }\n}\n',
        },
        expected: { file: XCTEST_TESTS, rule: 'sleep', line: 7 },
    },
    {
        check: 'xctest/recording',
        files: {
            [XCTEST_TESTS]:
                'import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        isRecording = true\n    }\n}\n',
        },
        expected: { file: XCTEST_TESTS, rule: 'recording', line: 7 },
        corrected: {
            files: {
                [XCTEST_TESTS]:
                    'import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        isRecording = false\n    }\n}\n',
            },
        },
    },
    {
        check: 'xctest/references',
        files: { 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
        expected: { file: 'AppTests/__Snapshots__/GoneTests/testTitle.1.png', rule: 'orphan-reference', line: 1 },
        corrected: {
            files: { 'AppTests/GoneTests.swift': CLEAN, 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
        },
    },
];
