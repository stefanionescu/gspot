import { CLEAN_XCTEST } from '#tests/config/swift-tests.ts';

const IMAGE_TEST_SOURCE = 'AppTests/HomeTests.swift';

export const SNAPSHOT_REPOSITORY = {
    configurations: ['swift-snapshot-testing'],

    files: { [IMAGE_TEST_SOURCE]: CLEAN_XCTEST, 'AppTests/__Snapshots__/HomeTests/testTitle.1.png': 'png' },
} as const;

export const SNAPSHOT_CASES = [
    {
        check: 'swift-snapshot-testing/recording',
        files: {
            [IMAGE_TEST_SOURCE]: `import XCTest

/// Tests of the home screen.
final class HomeTests: XCTestCase {
    /// The title is shown.
    func testTitle() throws {
        isRecording = true
    }
}
`,
        },
        expected: { file: IMAGE_TEST_SOURCE, rule: 'recording', line: 7 },
        corrected: {
            files: {
                [IMAGE_TEST_SOURCE]: `import XCTest

/// Tests of the home screen.
final class HomeTests: XCTestCase {
    /// The title is shown.
    func testTitle() throws {
        isRecording = false
    }
}
`,
            },
        },
    },
    {
        check: 'swift-snapshot-testing/references',
        files: { 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
        expected: { file: 'AppTests/__Snapshots__/GoneTests/testTitle.1.png', rule: 'orphan-reference', line: 1 },
        corrected: {
            files: {
                'AppTests/GoneTests.swift': CLEAN_XCTEST,
                'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png',
            },
        },
    },
] as const;

export const SOURCE_HEADER = `// Greeting.swift
// Created by Alex Garcia.
// Copyright 2026 Example Contributors.

`;

export const IMAGE_RECORDING_CASES = [
    { body: 'let example = "isRecording = true"', count: 0 },
    { body: 'SnapshotTesting.isRecording = true', count: 1 },
    { body: 'withSnapshotTesting(record:\n.all) {}', count: 1 },
] as const;
