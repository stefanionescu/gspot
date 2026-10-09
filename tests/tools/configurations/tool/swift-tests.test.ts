import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { hasToolBuild } from '#tests/harness/platforms.ts';
import { isMacos } from '#tests/config/harness/platforms.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { buildFolder } from '#cli/checks/language/swift/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { XCODE_PROJECT } from '#tests/config/samples/swift/xcode.ts';
import { rm, stat, chmod, unlink, readFile } from 'node:fs/promises';
import { spawnGspot, buildRunOptions } from '#tests/harness/gspot.ts';
import { containing, containingAll, textContaining } from '#tests/harness/expectations.ts';

import {
    SAMPLE,
    CORRECT,
    XCTEST_SCOPES,
    XCTEST_COMMAND,
    XCTEST_COVERAGE_TESTS,
    XCTEST_COVERAGE_SOURCE,
} from '#tests/config/tools/configurations/tool/swift-tests.ts';

test.skipIf(!isMacos)(
    'XCTest and xccov report a below-floor target and pass after testing its uncovered function',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['swift-tests', 'xcode'], {
                tables: '[swift]\nxcode_project = "Inspection.xcodeproj"\nxcode_scheme = "Inspection"\nxcode_destination = "platform=macOS"\n[coverage]\noverrides = [{ target = "Inspection.xctest", percent = 100 }]\n',
                level: 'all',
            }),
            'Inspection.xcodeproj/project.pbxproj': XCODE_PROJECT,
            'Inspection.xcodeproj/xcshareddata/xcschemes/Inspection.xcscheme':
                '<Scheme version="1.3"><BuildAction><BuildActionEntries><BuildActionEntry buildForTesting="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" codeCoverageEnabled="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="T1" BuildableName="Inspection.xctest" BlueprintName="Inspection" ReferencedContainer="container:Inspection.xcodeproj"/></TestableReference></Testables></TestAction></Scheme>\n',
            'Value.swift': XCTEST_COVERAGE_SOURCE,
            'ValueTests.swift': XCTEST_COVERAGE_TESTS,
        });
        try {
            const failed = await executeRun(
                await openSession(sandbox.path),
                buildRunOptions({ stage: 'push', only: ['swift-tests/coverage'] }),
            );
            expect(failed.report.exitCode, JSON.stringify(failed.report)).toBe(1);
            expect(failed.report.checks).toMatchObject([
                {
                    check: 'swift-tests/coverage',
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
                buildRunOptions({ stage: 'push', only: ['swift-tests/coverage'] }),
            );
            expect(corrected.report.exitCode, JSON.stringify(corrected.report)).toBe(0);
            expect(corrected.report.checks).toMatchObject([
                { check: 'swift-tests/coverage', status: 'passed', findings: [] },
            ]);
            expect(await readFile(join(sandbox.path, 'Value.swift'), 'utf8')).toBe(XCTEST_COVERAGE_SOURCE);
            expect(await readFile(join(sandbox.path, 'Inspection.xcodeproj/project.pbxproj'), 'utf8')).toBe(
                XCODE_PROJECT,
            );
        } finally {
            await rm(buildFolder(sandbox.path), { recursive: true, force: true });
        }
    },
);

const configurationCases = [
    {
        name: 'preserve source rules and pass after the source fix',
        check: async (root: string, prefix: string) => {
            await Bun.write(join(root, `${prefix}Sources/Value.swift`), SAMPLE);
            const broken = await spawnGspot(root, XCTEST_COMMAND);
            expect(broken.code, broken.stdout + broken.stderr).toBe(1);
            const findings = (JSON.parse(broken.stdout) as RunReport).checks.flatMap((check) => check.findings);
            expect(findings).toStrictEqual(
                containingAll([
                    containing({ file: `${prefix}Sources/Value.swift`, rule: 'force_unwrapping' }),
                    containing({ file: `${prefix}Sources/Value.swift`, rule: 'missing_docs' }),
                    containing({ file: `${prefix}Sources/Value.swift`, rule: 'no_magic_numbers' }),
                ]),
            );
            expect(findings.every((finding) => finding.file === `${prefix}Sources/Value.swift`)).toBe(true);
            await Bun.write(join(root, `${prefix}Sources/Value.swift`), CORRECT);
            const corrected = await spawnGspot(root, XCTEST_COMMAND);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        },
    },
    {
        name: 'report the rule restored by an edited nested configuration',
        check: async (root: string, prefix: string) => {
            const nestedPath = join(root, `${prefix}AppTests/.swiftlint.yml`);
            const nested = await Bun.file(nestedPath).text();
            const attributes = await stat(nestedPath);
            const mode = attributes.mode & 0o777;
            // The sandbox changes a managed configuration to exercise native enforcement.
            await chmod(nestedPath, mode | 0o200);
            await Bun.write(nestedPath, nested.replace('    - force_unwrapping\n', ''));
            const changedConfiguration = await spawnGspot(root, XCTEST_COMMAND);
            expect(changedConfiguration.code, changedConfiguration.stdout + changedConfiguration.stderr).toBe(1);
            expect((JSON.parse(changedConfiguration.stdout) as RunReport).checks[0]!.findings).toContainEqual(
                containing({ file: `${prefix}AppTests/Value.swift`, rule: 'force_unwrapping' }),
            );
        },
    },
    {
        name: 'correct source formatting with --fix',
        check: async (root: string, prefix: string) => {
            await Bun.write(
                join(root, `${prefix}Sources/Value.swift`),
                CORRECT.replace('value: String', 'value:String'),
            );
            const fixed = await spawnGspot(root, [...XCTEST_COMMAND, '--fix']);
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            expect(await Bun.file(join(root, `${prefix}Sources/Value.swift`)).text()).toBe(CORRECT);
        },
    },
    {
        name: 'refuse a missing root configuration with its path',
        check: async (root: string, prefix: string) => {
            const path = join(root, `${prefix}.swiftlint.yml`);
            await unlink(path);
            const missing = await spawnGspot(root, XCTEST_COMMAND);
            expect(missing.code, missing.stdout + missing.stderr).toBe(2);
            expect(missing.stdout).toContain(`${prefix}.swiftlint.yml`);
        },
    },
];

for (const { name, scope } of XCTEST_SCOPES) {
    test.skipIf(!hasToolBuild('swiftlint')).each(configurationCases)(
        `Swift test overrides ${name} $name`,
        async ({ check }) => {
            await using sandbox = await testdir();
            const root = sandbox.path;
            const prefix = scope === '' ? '' : `${scope}/`;
            await createFileTree(root, {
                'gspot.toml': buildPolicy(scope === '' ? ['swift-tests'] : [], {
                    level: 'all',
                    tables: scope === '' ? '' : `[scope.${JSON.stringify(scope)}]\nconfigurations = ["swift-tests"]\n`,
                }),
                [`${prefix}Sources/Value.swift`]: CORRECT,
                [`${prefix}AppTests/Value.swift`]: SAMPLE,
                [`${prefix}AppTests/Deep/Value.swift`]: SAMPLE,
            });
            const session = await openSession(root);
            const emitted = emitAll(session);
            const outputs = emitted.files.filter(({ path }) => path.endsWith('swiftlint.yml'));
            expect(outputs.map(({ path }) => path)).toContain(`${prefix}AppTests/.swiftlint.yml`);
            using log = openOwnership(root);
            writeGeneratedFiles(session, emitted, log);
            await check(root, prefix);
        },
    );
}

test.skipIf(!hasToolBuild('swiftlint')).each(['AppTests', 'AppTests/Helpers'])(
    'a Swift test scope %s has one complete native configuration',
    async (scope) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy([], {
                tables: `[scope."${scope}"]\nconfigurations = ["swift-tests"]\n`,
                level: 'all',
            }),
            [`${scope}/Value.swift`]: SAMPLE,
        });
        const session = await openSession(sandbox.path);
        const emitted = emitAll(session);
        const outputs = emitted.files.filter(({ path }) => path.endsWith('swiftlint.yml'));
        expect(outputs.filter(({ path }) => path === `${scope}/.swiftlint.yml`)).toHaveLength(1);
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, emitted, log);
        const native = await runTestCommand(
            ['swiftlint', 'lint', '--strict', '--quiet', '--no-cache', '--reporter', 'json', 'Value.swift'],
            { cwd: join(sandbox.path, scope) },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
        expect(JSON.parse(native.stdout)).toStrictEqual([]);
        const result = await spawnGspot(sandbox.path, ['check', '--only', 'swift/swiftlint', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    },
);
