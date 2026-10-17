import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { rm, unlink, readFile } from 'node:fs/promises';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { isMacos, hasToolBuild } from '#tests/setup/system.ts';
import { buildPlan } from '#cli/checks/language/swift/cache.ts';
import { type RunReport } from '#cli/types/checks/run/check.ts';
import { TEST_TARGET_PBXPROJ } from '#tests/data/checks/xcode.ts';
import { matchItems, matchFields, matchSubstring } from '#tests/setup/matchers.ts';

import {
    PARSER_SOURCE,
    XCTEST_SCOPES,
    SWIFTLINT_COMMAND,
    FIXED_PARSER_SOURCE,
    XCTEST_COVERAGE_TESTS,
    XCTEST_COVERAGE_SOURCE,
} from '#tests/data/checks/swift-tests.ts';

// This check needs the Xcode toolchain supplied by macOS.
test.skipIf(!isMacos)(
    'swift-tests/coverage reports a target under its coverage limit and passes after testing the uncovered function',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['swift-tests', 'xcode'], {
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
            const command = ['check', '--only', 'swift-tests/coverage', '--json'];
            const failedCommand = await spawnGspot(sandbox.path, command);
            const failed = JSON.parse(failedCommand.stdout) as RunReport;
            expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
            expect(failed.checks).toMatchObject([
                {
                    check: 'swift-tests/coverage',
                    status: 'failed',
                    findings: [{ rule: 'coverage', line: 1, message: matchSubstring('under the limit of 100') }],
                },
            ]);
            await Bun.write(
                join(sandbox.path, 'ValueTests.swift'),
                XCTEST_COVERAGE_TESTS.replace(
                    'XCTAssertEqual(first(), 1)',
                    'XCTAssertEqual(first(), 1)\n        XCTAssertEqual(second(), 2)',
                ),
            );
            const correctedCommand = await spawnGspot(sandbox.path, command);
            const corrected = JSON.parse(correctedCommand.stdout) as RunReport;
            expect(corrected.exitCode, JSON.stringify(corrected)).toBe(0);
            expect(corrected.checks).toMatchObject([{ check: 'swift-tests/coverage', status: 'passed', findings: [] }]);
            expect(await readFile(join(sandbox.path, 'Value.swift'), 'utf8')).toBe(XCTEST_COVERAGE_SOURCE);
            expect(await readFile(join(sandbox.path, 'Inspection.xcodeproj/project.pbxproj'), 'utf8')).toBe(
                TEST_TARGET_PBXPROJ,
            );
        } finally {
            await rm(
                buildPlan(buildCheckInput(await openSession(sandbox.path), 'swift-tests/coverage'), {
                    purpose: 'coverage',
                }).folder,
                { recursive: true, force: true },
            );
        }
    },
);
/** Prepare the shared SwiftLint source and generated test configuration for each scope. */
async function prepareSwiftScope(scope: string) {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(await testdir());
    const root = sandbox.path;
    const prefix = scope === '' ? '' : `${scope}/`;
    await createFileTree(root, {
        'gspot.toml': buildSettingsText(scope === '' ? ['swift-tests'] : [], {
            level: 'all',
            tables:
                scope === ''
                    ? ''
                    : `[[scope]]
path = ${JSON.stringify(scope)}
configurations = ["swift-tests"]
`,
        }),
        [`${prefix}Sources/Value.swift`]: FIXED_PARSER_SOURCE,
        [`${prefix}AppTests/Value.swift`]: PARSER_SOURCE,
        [`${prefix}AppTests/Deep/Value.swift`]: PARSER_SOURCE,
    });
    expect(await spawnGspot(root, ['apply'])).toMatchObject({ code: 0 });
    expect(await Bun.file(join(root, `${prefix}AppTests/.swiftlint.yml`)).exists()).toBe(true);
    const lifetime = resources.move();
    return { root, prefix, [Symbol.asyncDispose]: lifetime[Symbol.asyncDispose].bind(lifetime) };
}

// The pinned swiftlint tool has no build for some operating systems.
test.skipIf(!hasToolBuild('swiftlint')).each([...XCTEST_SCOPES])(
    'SwiftLint $name reports the source lint rules and passes after the fix',
    async ({ scope }) => {
        await using sandbox = await prepareSwiftScope(scope);
        const { root, prefix } = sandbox;
        await Bun.write(join(root, `${prefix}Sources/Value.swift`), PARSER_SOURCE);
        const broken = await spawnGspot(root, SWIFTLINT_COMMAND);
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        const findings = (JSON.parse(broken.stdout) as RunReport).checks.flatMap((check) => check.findings);
        expect(findings).toStrictEqual(
            matchItems([
                matchFields({ file: `${prefix}Sources/Value.swift`, rule: 'force_unwrapping' }),
                matchFields({ file: `${prefix}Sources/Value.swift`, rule: 'missing_docs' }),
                matchFields({ file: `${prefix}Sources/Value.swift`, rule: 'no_magic_numbers' }),
            ]),
        );
        expect(findings.every((finding) => finding.file === `${prefix}Sources/Value.swift`)).toBe(true);
        await Bun.write(join(root, `${prefix}Sources/Value.swift`), FIXED_PARSER_SOURCE);
        const corrected = await spawnGspot(root, SWIFTLINT_COMMAND);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
// The pinned swiftlint tool has no build for some operating systems.
// The pinned swiftlint tool has no build for some operating systems.
test.skipIf(!hasToolBuild('swiftlint')).each([...XCTEST_SCOPES])(
    'SwiftLint $name fixes source formatting with --fix',
    async ({ scope }) => {
        await using sandbox = await prepareSwiftScope(scope);
        const { root, prefix } = sandbox;
        await Bun.write(
            join(root, `${prefix}Sources/Value.swift`),
            FIXED_PARSER_SOURCE.replace('value: String', 'value:String'),
        );
        const fixed = await spawnGspot(root, [...SWIFTLINT_COMMAND, '--fix']);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(root, `${prefix}Sources/Value.swift`)).text()).toBe(FIXED_PARSER_SOURCE);
    },
);
// The pinned swiftlint tool has no build for some operating systems.
test.skipIf(!hasToolBuild('swiftlint')).each([...XCTEST_SCOPES])(
    'SwiftLint $name refuses a missing root tool file and names its path',
    async ({ scope }) => {
        await using sandbox = await prepareSwiftScope(scope);
        const { root, prefix } = sandbox;
        const path = join(root, `${prefix}.swiftlint.yml`);
        await unlink(path);
        const missing = await spawnGspot(root, SWIFTLINT_COMMAND);
        expect(missing.code, missing.stdout + missing.stderr).toBe(2);
        expect(missing.stdout).toContain(`${prefix}.swiftlint.yml`);
    },
);
// The pinned swiftlint tool has no build for some operating systems.
test.skipIf(!hasToolBuild('swiftlint')).each(['AppTests', 'AppTests/Helpers'])(
    'a swift-tests scope %s gets one complete SwiftLint tool file',
    async (scope) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText([], {
                tables: `[[scope]]
path = "${scope}"
configurations = ["swift-tests"]
`,
                level: 'all',
            }),
            [`${scope}/Value.swift`]: PARSER_SOURCE,
        });
        expect(await spawnGspot(sandbox.path, ['apply'])).toMatchObject({ code: 0 });
        expect(await Bun.file(join(sandbox.path, `${scope}/.swiftlint.yml`)).exists()).toBe(true);
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
