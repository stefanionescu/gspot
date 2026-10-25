import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { rm, writeFile } from 'node:fs/promises';
import { isMacos } from '#tests/setup/system/platform.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { readCheckoutCacheFolder } from '#cli/checks/language/swift/cache.ts';

import {
    TEST_TARGET_PBXPROJ,
    XCTEST_COVERAGE_TESTS,
    XCTEST_COVERAGE_SOURCE,
    COVERAGE_TARGET_SETTINGS,
} from '#tests/config/integration/checks/language/swift/coverage.ts';

test.skipIf(!isMacos)(
    'swift/coverage reports a target under its coverage limit and passes after testing the uncovered function',
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], COVERAGE_TARGET_SETTINGS),
            'Inspection.xcodeproj/project.pbxproj': TEST_TARGET_PBXPROJ,
            'Inspection.xcodeproj/xcshareddata/xcschemes/Inspection.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" codeCoverageEnabled="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></TestableReference></Testables></TestAction></Scheme>\n',
            'Value.swift': XCTEST_COVERAGE_SOURCE,
            'ValueTests.swift': XCTEST_COVERAGE_TESTS,
        });

        await using _cache = {
            [Symbol.asyncDispose]: () => rm(readCheckoutCacheFolder(sandbox.path), { recursive: true, force: true }),
        };
        const command = ['check', '--only', 'swift/coverage', '--json'];
        const failed = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
        expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
        expect(failed.checks).toMatchObject([
            {
                check: 'swift/coverage',
                status: 'failed',
                findings: [
                    {
                        file: 'Inspection.xcodeproj',
                        rule: 'coverage',
                        line: 1,
                        message: 'Inspection.xctest covers 72% of its lines, under the limit of 100%.',
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
        const corrected = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
        expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
        expect(corrected.checks).toMatchObject([{ check: 'swift/coverage', status: 'passed', findings: [] }]);
    },
);
