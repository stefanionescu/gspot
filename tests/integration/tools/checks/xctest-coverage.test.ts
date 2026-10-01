import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rmSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildFolder } from '#cli/platform/paths.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { onMac } from '#tests/support/cli/platforms.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { textContaining } from '#tests/support/expectations.ts';

import {
    XCTEST_COVERAGE_TESTS,
    XCTEST_COVERAGE_SOURCE,
    XCTEST_COVERAGE_PROJECT,
} from '#tests/inputs/integration/tools/checks.ts';

if (onMac)
    test('XCTest and xccov report a below-floor target and pass after testing its uncovered function', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(
                ['xctest', 'xcode'],
                '[tools.xcode]\nproject = "Inspection.xcodeproj"\nscheme = "Inspection"\ndestination = "platform=macOS"\n[[tools.xctest.coverage]]\ntarget = "Inspection.xctest"\npercent = 100\n',
                'all',
            ),
            'Inspection.xcodeproj/project.pbxproj': XCTEST_COVERAGE_PROJECT,
            'Inspection.xcodeproj/xcshareddata/xcschemes/Inspection.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" codeCoverageEnabled="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></TestableReference></Testables></TestAction></Scheme>\n',
            'Value.swift': XCTEST_COVERAGE_SOURCE,
            'ValueTests.swift': XCTEST_COVERAGE_TESTS,
        });
        try {
            const failed = await executeRun(await openSession(sandbox.path), {
                stage: 'push',
                only: ['xctest/coverage'],
                skips: [],
                fix: false,
                isDryRun: true,
            });
            expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
            expect(failed.report.checks).toMatchObject([
                {
                    check: 'xctest/coverage',
                    status: 'fail',
                    findings: [{ rule: 'coverage', line: 1, message: textContaining('under the floor of 100') }],
                },
            ]);
            await Bun.write(
                join(sandbox.path, 'ValueTests.swift'),
                XCTEST_COVERAGE_TESTS.replace(
                    'XCTAssertEqual(first(), 1)',
                    'XCTAssertEqual(first(), 1)\n        XCTAssertEqual(second(), 2)',
                ),
            );
            const corrected = await executeRun(await openSession(sandbox.path), {
                stage: 'push',
                only: ['xctest/coverage'],
                skips: [],
                fix: false,
                isDryRun: true,
            });
            expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
            expect(corrected.report.checks).toMatchObject([{ check: 'xctest/coverage', status: 'ok', findings: [] }]);
            expect(readFileSync(join(sandbox.path, 'Value.swift'), 'utf8')).toBe(XCTEST_COVERAGE_SOURCE);
            expect(readFileSync(join(sandbox.path, 'Inspection.xcodeproj/project.pbxproj'), 'utf8')).toBe(
                XCTEST_COVERAGE_PROJECT,
            );
        } finally {
            rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
        }
    }, 180_000);
