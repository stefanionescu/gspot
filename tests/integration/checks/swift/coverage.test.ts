import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPlan } from '#cli/checks/swift/cache.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { planSandboxCheck } from '#tests/setup/check-input.ts';
import { isMacos, hasToolBuild } from '#tests/setup/system.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { TEST_TARGET_PBXPROJ } from '#tests/data/checks/xcode.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { rm, unlink, readFile, writeFile } from 'node:fs/promises';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';

import {
    PARSER_SOURCE,
    XCTEST_SCOPES,
    FIXED_PARSER_SOURCE,
    XCTEST_COVERAGE_TESTS,
    XCTEST_COVERAGE_SOURCE,
} from '#tests/data/checks/swift/tests.ts';

/** Create a sandbox with the SwiftLint sources and the generated test tool file for one scope. */
async function prepareSwiftScope(scope: string) {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(await testdir());
    const root = sandbox.path;
    const prefix = scope === '' ? '' : `${scope}/`;
    await createFileTree(root, {
        'gspot.toml': buildSandboxSettings(scope === '' ? ['swift'] : [], {
            level: 'all',
            tables:
                scope === ''
                    ? ''
                    : `[[scope]]
path = ${JSON.stringify(scope)}
configurations = ["swift"]
`,
        }),
        [`${prefix}Sources/Value.swift`]: FIXED_PARSER_SOURCE,
        [`${prefix}AppTests/Value.swift`]: PARSER_SOURCE,
        [`${prefix}AppTests/Deep/Value.swift`]: PARSER_SOURCE,
    });
    expect(await spawnGspot(root, ['apply'])).toMatchObject({ code: 0 });
    expect(await isOnDisk(join(root, `${prefix}AppTests/.swiftlint.yml`))).toBe(true);
    const lifetime = resources.move();
    return { root, prefix, [Symbol.asyncDispose]: lifetime[Symbol.asyncDispose].bind(lifetime) };
}

// This check needs the Xcode toolchain supplied by macOS.
test.skipIf(!isMacos)(
    'swift/coverage reports a target under its coverage limit and passes after testing the uncovered function',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['swift', 'xcode'], {
                tables: `[[coverage.swift_target]]
name = "Inspection.xctest"
lines = 100

[swift]
xcode_project = "Inspection.xcodeproj"
xcode_scheme = "Inspection"
xcode_destination = "platform=macOS"
`,
                level: 'all',
            }),
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

test.skipIf(!hasToolBuild('swiftlint')).each([...XCTEST_SCOPES])(
    'SwiftLint $name reports the source lint rules and passes after the fix',
    async ({ scope }) => {
        await using sandbox = await prepareSwiftScope(scope);
        const { root, prefix } = sandbox;
        await writeFile(join(root, `${prefix}Sources/Value.swift`), PARSER_SOURCE);
        const broken = parseCheckReport(await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const findings = broken.report.checks.flatMap((check) => check.findings);
        expect(findings).toStrictEqual(
            matchItems([
                matchFields({ file: `${prefix}Sources/Value.swift`, rule: 'force_unwrapping' }),
                matchFields({ file: `${prefix}Sources/Value.swift`, rule: 'missing_docs' }),
                matchFields({ file: `${prefix}Sources/Value.swift`, rule: 'no_magic_numbers' }),
            ]),
        );
        expect(findings.every((finding) => finding.file === `${prefix}Sources/Value.swift`)).toBe(true);
        await writeFile(join(root, `${prefix}Sources/Value.swift`), FIXED_PARSER_SOURCE);
        const corrected = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
test.skipIf(!hasToolBuild('swiftlint')).each([...XCTEST_SCOPES])(
    'SwiftLint $name fixes source formatting with --fix',
    async ({ scope }) => {
        await using sandbox = await prepareSwiftScope(scope);
        const { root, prefix } = sandbox;
        await writeFile(
            join(root, `${prefix}Sources/Value.swift`),
            FIXED_PARSER_SOURCE.replace('value: String', 'value:String'),
        );
        const fixed = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json', '--fix']);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await readFile(join(root, `${prefix}Sources/Value.swift`), 'utf8')).toBe(FIXED_PARSER_SOURCE);
    },
);
test.skipIf(!hasToolBuild('swiftlint')).each([...XCTEST_SCOPES])(
    'SwiftLint $name refuses a missing root tool file and names its path',
    async ({ scope }) => {
        await using sandbox = await prepareSwiftScope(scope);
        const { root, prefix } = sandbox;
        const path = join(root, `${prefix}.swiftlint.yml`);
        await unlink(path);
        const missing = await spawnGspot(root, ['check', '--only', 'swift/swiftlint', '--json']);
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect(missing.stdout).toContain(`${prefix}.swiftlint.yml`);
    },
);
test.skipIf(!hasToolBuild('swiftlint')).each(['AppTests', 'AppTests/Helpers'])(
    'a Swift test scope %s gets one complete SwiftLint tool file',
    async (scope) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], {
                tables: `[[scope]]
path = "${scope}"
configurations = ["swift"]
`,
                level: 'all',
            }),
            [`${scope}/Value.swift`]: PARSER_SOURCE,
        });

        expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
        expect(await isOnDisk(join(sandbox.path, `${scope}/.swiftlint.yml`))).toBe(true);
        const toolResult = await runCommand(
            ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
            { cwd: join(sandbox.path, scope) },
        );
        expect(toolResult.code, toolResult.stdout + toolResult.stderr).toBe(0);
        expect(JSON.parse(toolResult.stdout)).toStrictEqual([]);
        const result = await spawnGspot(sandbox.path, ['check', '--only', 'swift/swiftlint', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    },
);
