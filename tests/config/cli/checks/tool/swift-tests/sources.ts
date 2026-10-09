import { CLEAN } from '#tests/config/samples/swift/tests.ts';

/** Clean Swift tests used by the stage and source controls. */
export const XCTEST_FILES = {
    'AppTests/HomeTests.swift': CLEAN,
    'AppTests/SkippedTests.swift':
        'import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        throw XCTSkip("Waits for the new design of the header, issue 12.")\n    }\n}\n',
};
