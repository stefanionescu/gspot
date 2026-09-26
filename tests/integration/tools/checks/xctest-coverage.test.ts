import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { rmSync, readFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { buildFolder } from '#cli/platform/paths.ts';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { textContaining } from '#tests/support/expectations.ts';

import {
    XCTEST_COVERAGE_PROJECT,
    XCTEST_COVERAGE_SOURCE,
    XCTEST_COVERAGE_TESTS,
} from '#tests/constants/integration/tools/checks.ts';

if (process.platform === 'darwin')
    test('XCTest and xccov report a below-floor target and pass after testing its uncovered function', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nlevel = "all"\nconfigurations = ["xctest", "xcode"]\n[tools.xcode]\nproject = "Probe.xcodeproj"\nscheme = "Probe"\ndestination = "platform=macOS"\n[[tools.xctest.coverage]]\ntarget = "Probe.xctest"\npercent = 100\n',
            'Probe.xcodeproj/project.pbxproj': XCTEST_COVERAGE_PROJECT,
            'Probe.xcodeproj/xcshareddata/xcschemes/Probe.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Probe.xctest" BlueprintName="Probe" ReferencedContainer="container:Probe.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" codeCoverageEnabled="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Probe.xctest" BlueprintName="Probe" ReferencedContainer="container:Probe.xcodeproj"/></TestableReference></Testables></TestAction></Scheme>\n',
            'Value.swift': XCTEST_COVERAGE_SOURCE,
            'ValueTests.swift': XCTEST_COVERAGE_TESTS,
        });
        const check = async () =>
            await executeRun(await openSession(sandbox.path), {
                stage: 'push',
                only: ['xctest/coverage'],
                skips: [],
                fix: false,
                isDryRun: true,
                noCache: true,
            });
        try {
            const failed = await check();
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
            const corrected = await check();
            expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
            expect(corrected.report.checks).toMatchObject([{ check: 'xctest/coverage', status: 'ok', findings: [] }]);
            expect(readFileSync(join(sandbox.path, 'Value.swift'), 'utf8')).toBe(XCTEST_COVERAGE_SOURCE);
            expect(readFileSync(join(sandbox.path, 'Probe.xcodeproj/project.pbxproj'), 'utf8')).toBe(
                XCTEST_COVERAGE_PROJECT,
            );
        } finally {
            rmSync(buildFolder(sandbox.path), { recursive: true, force: true });
        }
    }, 180_000);
