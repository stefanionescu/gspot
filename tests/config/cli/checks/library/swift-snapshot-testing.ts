import { CLEAN } from '#tests/config/samples/swift/tests.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

const TEST_SOURCE = 'AppTests/HomeTests.swift';

export const REPOSITORY: RepositoryScenario = {
    configurations: ['swift-snapshot-testing'],
    modules: false,
    installs: false,
    files: { [TEST_SOURCE]: CLEAN, 'AppTests/__Snapshots__/HomeTests/testTitle.1.png': 'png' },
};

export const CASES: FindingCase[] = [
    {
        check: 'swift-snapshot-testing/recording',
        files: {
            [TEST_SOURCE]:
                'import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        isRecording = true\n    }\n}\n',
        },
        expected: { file: TEST_SOURCE, rule: 'recording', line: 7 },
        corrected: {
            files: {
                [TEST_SOURCE]:
                    'import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        isRecording = false\n    }\n}\n',
            },
        },
    },
    {
        check: 'swift-snapshot-testing/references',
        files: { 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
        expected: { file: 'AppTests/__Snapshots__/GoneTests/testTitle.1.png', rule: 'orphan-reference', line: 1 },
        corrected: {
            files: { 'AppTests/GoneTests.swift': CLEAN, 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
        },
    },
];

/** Package.swift dependency discovery controls automatic snapshot configuration selection. */
export const PACKAGE_PROJECTS = [
    {
        source: 'let package = Package(dependencies: [.package(url: "https://github.com/pointfreeco/swift-snapshot-testing", from: "1.0.0")])\n',
        selected: true,
    },
    {
        source: 'let package = Package(dependencies: [.package(url: "https://github.com/apple/swift-collections", from: "1.0.0")])\n',
        selected: false,
    },
];

export const DOCUMENTATION_LEVELS: ('recommended' | 'all')[] = ['recommended', 'all'];
