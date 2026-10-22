import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isMacos } from '#tests/setup/system/platform.ts';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildPlan } from '#cli/checks/language/swift/cache.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    TEST_TARGET_PBXPROJ,
    XCTEST_COVERAGE_TESTS,
    XCTEST_COVERAGE_SOURCE,
    COVERAGE_TARGET_SETTINGS,
} from '#tests/config/integration/checks/language/swift/coverage.ts';

// This check needs the Xcode toolchain supplied by macOS.
test.skipIf(!isMacos)(
    'swift/coverage reports a target under its coverage limit and passes after testing the uncovered function',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], COVERAGE_TARGET_SETTINGS),
            'Inspection.xcodeproj/project.pbxproj': TEST_TARGET_PBXPROJ,
            'Inspection.xcodeproj/xcshareddata/xcschemes/Inspection.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" codeCoverageEnabled="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></TestableReference></Testables></TestAction></Scheme>\n',
            'Value.swift': XCTEST_COVERAGE_SOURCE,
            'ValueTests.swift': XCTEST_COVERAGE_TESTS,
        });

        try {
            const command = ['check', '--only', 'swift/coverage', '--json'];
            const failedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
            const failed = failedCommand.report;
            expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
            expect(failed.checks).toMatchObject([
                {
                    check: 'swift/coverage',
                    status: 'failed',
                    findings: [
                        {
                            rule: 'coverage',
                            line: 1,
                            message: expect.stringContaining('under the limit of 100') as string,
                        },
                    ],
                },
            ]);
            await writeFile(
                join(sandbox.path, 'ValueTests.swift'),
                XCTEST_COVERAGE_TESTS.replace(
                    'XCTAssertEqual(first(), 1)',
                    'XCTAssertEqual(first(), 1)\n        XCTAssertEqual(second(), 2)',
                ),
            );
            const correctedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
            const corrected = correctedCommand.report;
            expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
            expect(corrected.checks).toMatchObject([{ check: 'swift/coverage', status: 'passed', findings: [] }]);
            expect(await readFile(join(sandbox.path, 'Value.swift'), 'utf8')).toBe(XCTEST_COVERAGE_SOURCE);
            expect(await readFile(join(sandbox.path, 'Inspection.xcodeproj/project.pbxproj'), 'utf8')).toBe(
                TEST_TARGET_PBXPROJ,
            );
        } finally {
            const session = await openSession(sandbox.path);
            await rm(buildPlan(session, planSandboxCheck(session, 'swift/coverage'), { purpose: 'coverage' }).folder, {
                recursive: true,
                force: true,
            });
        }
    },
);
