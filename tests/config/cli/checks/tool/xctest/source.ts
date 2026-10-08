import { CLEAN } from '#tests/config/samples/swift/tests.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const XCTEST_TESTS = 'AppTests/HomeTests.swift';

export const REPOSITORY: RepositoryScenario = {
    configurations: ['xctest'],
    modules: false,
    installs: false,
    files: {
        [XCTEST_TESTS]: CLEAN,
        'AppTests/SkippedTests.swift':
            'import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        throw XCTSkip("Waits for the new design of the header, issue 12.")\n    }\n}\n',
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'xctest/skip-reasons',
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
];
