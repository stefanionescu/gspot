// Planted repository for the xctest configuration: a skipped test with no reason, a sleep, a recording snapshot test, and references with no test.
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/cli.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import { toolsPath, installAtLevel } from '#tests/support/cli/tools.ts';
import { XCTEST_TESTS } from '#tests/config/acceptance/source/kits/kits.ts';
import { XCTEST_INIT } from '#tests/config/acceptance/source/kits/init-arguments.ts';

const CLEAN = `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        XCTAssertEqual("Home", "Home")\n    }\n}\n`;
const CASES: (FindingCase & { correction: Record<string, string> })[] = [
    {
        check: 'xctest/disabled',
        files: {
            [XCTEST_TESTS]: `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        throw XCTSkip()\n    }\n}\n`,
        },
        expected: { file: XCTEST_TESTS, rule: 'disabled', line: 7 },
        correction: {
            [XCTEST_TESTS]: `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        throw XCTSkip("Requires a physical device")\n    }\n}\n`,
        },
    },
    {
        check: 'xctest/no-sleep',
        files: {
            [XCTEST_TESTS]: `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        Thread.sleep(forTimeInterval: 2)\n    }\n}\n`,
        },
        expected: { file: XCTEST_TESTS, rule: 'sleep', line: 7 },
        correction: { [XCTEST_TESTS]: CLEAN },
    },
    {
        check: 'xctest/recording',
        files: {
            [XCTEST_TESTS]: `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        isRecording = true\n    }\n}\n`,
        },
        expected: { file: XCTEST_TESTS, rule: 'recording', line: 7 },
        correction: {
            [XCTEST_TESTS]: `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        isRecording = false\n    }\n}\n`,
        },
    },
    {
        check: 'xctest/reference-images',
        files: { 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
        expected: { file: 'AppTests/__Snapshots__/GoneTests/testTitle.1.png', rule: 'orphan-reference', line: 1 },
        correction: { 'AppTests/GoneTests.swift': CLEAN, 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
    },
];

describe('the xctest configuration', () => {
    test.each(CASES)(
        '$check reports $expected.rule at its source and accepts a correction',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                [XCTEST_TESTS]: CLEAN,
                'AppTests/__Snapshots__/HomeTests/testTitle.1.png': 'png',
                'AppTests/SkippedTests.swift': `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n        throw XCTSkip("Waits for the new design of the header, issue 12.")\n    }\n}\n`,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            await installAtLevel(sandbox.path, XCTEST_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(containing(planted.expected));
            await createFileTree(sandbox.path, planted.correction);
            const correctedCheck = await run(
                sandbox.path,
                ['check', '--only', planted.check, '--no-cache', '--json'],
                environment,
            );
            expect(correctedCheck.code, correctedCheck.stdout + correctedCheck.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(correctedCheck.stdout)).checks).toMatchObject([
                { check: planted.check, status: 'ok', findings: [] },
            ]);
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const atCommit = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(atCommit.checks.map((check) => check.check)).not.toContain('xctest/coverage');
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
