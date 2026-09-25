import { join } from 'node:path';
import { reportSchema } from '#cli/execution/report.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the xctest configuration: a skipped test with no reason, a sleep, a recording snapshot test, and references with no test.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'xctest',
    '--without',
    'spelling',
    'naming',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const suite = (body: string): string =>
    `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n${body}    }\n}\n`;
const CLEAN = suite('        XCTAssertEqual("Home", "Home")\n');
const TESTS = 'AppTests/HomeTests.swift';

const CASES: (FindingCase & { correction: Record<string, string> })[] = [
    {
        check: 'xctest/disabled',
        files: { [TESTS]: suite('        throw XCTSkip()\n') },
        expected: { file: TESTS, rule: 'disabled', line: 7 },
        correction: { [TESTS]: suite('        throw XCTSkip("Requires a physical device")\n') },
    },
    {
        check: 'xctest/no-sleep',
        files: { [TESTS]: suite('        Thread.sleep(forTimeInterval: 2)\n') },
        expected: { file: TESTS, rule: 'sleep', line: 7 },
        correction: { [TESTS]: CLEAN },
    },
    {
        check: 'xctest/recording',
        files: { [TESTS]: suite('        isRecording = true\n') },
        expected: { file: TESTS, rule: 'recording', line: 7 },
        correction: { [TESTS]: suite('        isRecording = false\n') },
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
                [TESTS]: CLEAN,
                'AppTests/__Snapshots__/HomeTests/testTitle.1.png': 'png',
                'AppTests/SkippedTests.swift': suite(
                    '        throw XCTSkip("Waits for the new design of the header, issue 12.")\n',
                ),
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining(planted.expected));
            await createFileTree(sandbox.path, planted.correction);
            const corrected = await run(
                sandbox.path,
                ['check', '--only', planted.check, '--no-cache', '--json'],
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
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
