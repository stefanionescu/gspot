// Planted repository for the xctest preset: a skipped test with no reason, a sleep, a recording snapshot test, and references with no test.
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { underFloor } from '#cli/apple/xctest/coverage.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'xctest',
    '--without',
    'spelling,naming,structure',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const suite = (body: string): string =>
    `import XCTest\n\n/// Tests of the home screen.\nfinal class HomeTests: XCTestCase {\n    /// The title is shown.\n    func testTitle() throws {\n${body}    }\n}\n`;
const CLEAN = suite('        XCTAssertEqual("Home", "Home")\n');
const TESTS = 'AppTests/HomeTests.swift';

const CASES: PlantedCase[] = [
    {
        id: 'xctest/disabled',
        files: { [TESTS]: suite('        throw XCTSkip()\n') },
        expected: 'turned off and says no reason',
    },
    {
        id: 'xctest/no-sleep',
        files: { [TESTS]: suite('        Thread.sleep(forTimeInterval: 2)\n') },
        expected: 'A test that sleeps',
    },
    {
        id: 'xctest/recording',
        files: { [TESTS]: suite('        isRecording = true\n') },
        expected: 'Recording mode is on',
    },
    {
        id: 'xctest/reference-images',
        files: { 'AppTests/__Snapshots__/GoneTests/testTitle.1.png': 'png' },
        expected: 'No test file AppTests/GoneTests.swift exists',
    },
];

describe('the xctest preset', () => {
    test(
        'every static xctest check fires on its planted defect, and a reason or a test file makes it pass',
        async () => {
            await using fixture = await createFixture({
                [TESTS]: CLEAN,
                'AppTests/__Snapshots__/HomeTests/testTitle.1.png': 'png',
                'AppTests/SkippedTests.swift': suite(
                    '        // Waits for the new design of the header, issue 12.\n        throw XCTSkip()\n',
                ),
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            for (const planted of CASES) {
                const clean = run(fixture.path, ['check', planted.id, '--no-cache'], environment);
                expect(clean.code, `${planted.id}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
            const atCommit = JSON.parse(
                run(fixture.path, ['check', '--at', 'commit', '--json'], environment).stdout,
            ) as {
                checks: { id: string }[];
            };
            expect(atCommit.checks.map((check) => check.id)).not.toContain('xctest/coverage');
        },
        PLANTED_TIMEOUT_MS * 5,
    );

    test('the coverage check compares each named target with its floor', () => {
        const report = { targets: [{ name: 'App.app', lineCoverage: 0.617 }] };
        expect(underFloor(report, [{ target: 'App', percent: 60 }])).toEqual([]);
        expect(underFloor(report, [{ target: 'App', percent: 80 }])).toEqual([
            'App covers 61 of 100 lines, under the floor of 80.',
        ]);
        expect(underFloor(report, [{ target: 'Widget', percent: 10 }])).toEqual([
            'The coverage report holds no target named Widget.',
        ]);
    });
});
