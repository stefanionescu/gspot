// Planted repository for the xctest configuration: a skipped test with no reason, a sleep, a recording snapshot test, and references with no test.
import { test, expect } from 'bun:test';
import { run } from '#tests/harness/cli/command.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { XCTEST_TESTS } from '#tests/inputs/acceptance/source/kits/kits.ts';

const CLEAN = `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        XCTAssertEqual("Home", "Home")\n    }\n}\n`;

const BODY = '        XCTAssertEqual("Home", "Home")\n';

plantedCases(
    'the xctest configuration',
    {
        kits: ['xctest'],
        modules: false,
        without: ['spelling', 'naming'],
        tools: ['swiftlint', 'swiftformat'],
        files: {
            [XCTEST_TESTS]: CLEAN,
            'AppTests/__Snapshots__/HomeTests/testTitle.1.png': 'png',
            'AppTests/SkippedTests.swift': CLEAN.replace(
                BODY,
                '        throw XCTSkip("Waits for the new design of the header, issue 12.")\n',
            ),
        },
    },
    [
        {
            check: 'xctest/disabled',
            files: { [XCTEST_TESTS]: CLEAN.replace(BODY, '        throw XCTSkip()\n') },
            expected: { file: XCTEST_TESTS, rule: 'disabled', line: 7 },
            corrected: {
                files: { [XCTEST_TESTS]: CLEAN.replace(BODY, '        throw XCTSkip("Requires a physical device")\n') },
            },
        },
        {
            check: 'xctest/no-sleep',
            files: { [XCTEST_TESTS]: CLEAN.replace(BODY, '        Thread.sleep(forTimeInterval: 2)\n') },
            expected: { file: XCTEST_TESTS, rule: 'sleep', line: 7 },
        },
        {
            check: 'xctest/recording',
            files: { [XCTEST_TESTS]: CLEAN.replace(BODY, '        isRecording = true\n') },
            expected: { file: XCTEST_TESTS, rule: 'recording', line: 7 },
            corrected: { files: { [XCTEST_TESTS]: CLEAN.replace(BODY, '        isRecording = false\n') } },
        },
        {
            check: 'xctest/reference-images',
            files: { 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
            expected: { file: 'AppTests/__Snapshots__/GoneTests/testTitle.1.png', rule: 'orphan-reference', line: 1 },
            corrected: {
                files: { 'AppTests/GoneTests.swift': CLEAN, 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
            },
        },
    ],
    (planted) => {
        test(
            'the commit stage leaves the coverage run to its own stage',
            async () => {
                const { root, environment } = planted();
                const checked = await run(root, ['check', '--stage', 'commit', '--json'], environment);
                const ids = (JSON.parse(checked.stdout) as RunReport).checks.map((check) => check.check);
                expect(ids).not.toContain('xctest/coverage');
            },
            PLANTED_TIMEOUT_MS * 2,
        );
    },
);
