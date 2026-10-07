import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rmSync, readFileSync } from 'node:fs';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { isMacos } from '#tests/config/harness/platforms.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { buildFolder } from '#cli/checks/language/swift/cache.ts';

import {
    XCTEST_COVERAGE_TESTS,
    XCTEST_COVERAGE_SOURCE,
    XCTEST_COVERAGE_PROJECT,
} from '#tests/config/tools/checks/xctest-coverage.ts';

test.skipIf(!isMacos)(
    'XCTest and xccov report a below-floor target and pass after testing its uncovered function',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['xctest', 'xcode'], {
                tables: '[tools.xcode]\nproject = "Inspection.xcodeproj"\nscheme = "Inspection"\ndestination = "platform=macOS"\n[[tools.xctest.coverage]]\ntarget = "Inspection.xctest"\npercent = 100\n',
                level: 'all',
            }),
            'Inspection.xcodeproj/project.pbxproj': XCTEST_COVERAGE_PROJECT,
            'Inspection.xcodeproj/xcshareddata/xcschemes/Inspection.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" codeCoverageEnabled="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></TestableReference></Testables></TestAction></Scheme>\n',
            'Value.swift': XCTEST_COVERAGE_SOURCE,
            'ValueTests.swift': XCTEST_COVERAGE_TESTS,
        });
        try {
            const failed = await executeRun(
                await openSession(sandbox.path),
                buildRunOptions({ stage: 'push', only: ['xctest/coverage'], isDryRun: true }),
            );
            expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
            expect(failed.report.checks).toMatchObject([
                {
                    check: 'xctest/coverage',
                    status: 'failed',
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
            const corrected = await executeRun(
                await openSession(sandbox.path),
                buildRunOptions({ stage: 'push', only: ['xctest/coverage'], isDryRun: true }),
            );
            expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
            expect(corrected.report.checks).toMatchObject([
                { check: 'xctest/coverage', status: 'passed', findings: [] },
            ]);
            expect(readFileSync(join(sandbox.path, 'Value.swift'), 'utf8')).toBe(XCTEST_COVERAGE_SOURCE);
            expect(readFileSync(join(sandbox.path, 'Inspection.xcodeproj/project.pbxproj'), 'utf8')).toBe(
                XCTEST_COVERAGE_PROJECT,
            );
        } finally {
            rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
        }
    },
);
