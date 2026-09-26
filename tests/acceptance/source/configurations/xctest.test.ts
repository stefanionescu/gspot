import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
// Planted repository for the xctest configuration: a skipped test with no reason, a sleep, a recording snapshot test, and references with no test.
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { containing } from '#tests/support/expectations.ts';
import type { FindingCase } from '#tests/types/support/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { expectCorrected, runPlanted } from '#tests/support/cli/planted.ts';
import { XCTEST_INIT } from '#tests/constants/acceptance/source/configurations/init-arguments.ts';
import { XCTEST_TESTS } from '#tests/constants/acceptance/source/configurations/configurations.ts';

const suite = (body: string): string =>
    `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n${body}    }\n}\n`;
const CLEAN = suite('        XCTAssertEqual("Home", "Home")\n');
const CASES: (FindingCase & { correction: Record<string, string> })[] = [
    {
        check: 'xctest/disabled',
        files: { [XCTEST_TESTS]: suite('        throw XCTSkip()\n') },
        expected: { file: XCTEST_TESTS, rule: 'disabled', line: 7 },
        correction: { [XCTEST_TESTS]: suite('        throw XCTSkip("Requires a physical device")\n') },
    },
    {
        check: 'xctest/no-sleep',
        files: { [XCTEST_TESTS]: suite('        Thread.sleep(forTimeInterval: 2)\n') },
        expected: { file: XCTEST_TESTS, rule: 'sleep', line: 7 },
        correction: { [XCTEST_TESTS]: CLEAN },
    },
    {
        check: 'xctest/recording',
        files: { [XCTEST_TESTS]: suite('        isRecording = true\n') },
        expected: { file: XCTEST_TESTS, rule: 'recording', line: 7 },
        correction: { [XCTEST_TESTS]: suite('        isRecording = false\n') },
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
                'AppTests/SkippedTests.swift': suite(
                    '        throw XCTSkip("Waits for the new design of the header, issue 12.")\n',
                ),
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
            await expectCorrected(sandbox.path, planted.check, environment);
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const atCommit = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(atCommit.checks.map((check) => check.check)).not.toContain('xctest/coverage');
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
