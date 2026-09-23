// Planted repository for the xctest preset: a skipped test with no reason, a sleep, a recording snapshot test, and references with no test.
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/support/cli/planted.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/support/cli/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
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

const CASES: PlantedCase[] = [
    {
        check: 'xctest/disabled',
        files: { [TESTS]: suite('        throw XCTSkip()\n') },
        expected: 'turned off and says no reason',
    },
    {
        check: 'xctest/no-sleep',
        files: { [TESTS]: suite('        Thread.sleep(forTimeInterval: 2)\n') },
        expected: 'A test that sleeps',
    },
    {
        check: 'xctest/recording',
        files: { [TESTS]: suite('        isRecording = true\n') },
        expected: 'Recording mode is on',
    },
    {
        check: 'xctest/reference-images',
        files: { 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
        expected: 'No test file AppTests/GoneTests.swift exists',
    },
];

describe('the xctest preset', () => {
    test(
        'every static xctest check fires on its planted defect, and a reason or a test file makes it pass',
        async () => {
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
            for (const planted of CASES) {
                const clean = await run(sandbox.path, ['check', '--only', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const atCommit = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            expect(atCommit.checks.map((check) => check.check)).not.toContain('xctest/coverage');
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
