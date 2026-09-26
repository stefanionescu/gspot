// Planted repository for the swift configuration: a force cast, doubled spaces, a snake case function, and the structural defects.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import type { Finding } from '#cli/types/checks/checks.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/types/support/cli.ts';
import { SWIFT_INIT } from '#tests/support/cli/swift-fixtures.ts';
import { installAtLevel, toolsPath } from '#tests/support/cli/tools.ts';
import { containing, containingAll } from '#tests/support/expectations.ts';
import { CAST_SWIFT, CLEAN_SWIFT, PLANTED_TIMEOUT_MS } from '#tests/constants/support/cli.ts';
import { BELOW, COPIES, FORWARD, STRUCTURAL, TINY } from '#tests/constants/acceptance/source/configurations/swift.ts';

const SPACED = CLEAN_SWIFT.replace('func greeting', () => 'func   greeting');
const SNAKE = CLEAN_SWIFT.replace('func greeting', () => 'func make_greeting');

const reader = (name: string): string =>
    `import Foundation\n\n/// Reads one variable.\nfunc ${name}() -> String? {\n    ProcessInfo.processInfo.environment["HOME"]\n}\n`;

const CASES: FindingCase[] = [
    {
        check: 'swift/swiftlint',
        files: { 'Sources/App/Cast.swift': CAST_SWIFT },
        expected: { file: 'Sources/App/Cast.swift', rule: 'force_cast', line: 5 },
    },
    {
        check: 'swift/swiftformat',
        files: { 'Sources/App/Greeting.swift': SPACED },
        expected: { file: 'Sources/App/Greeting.swift', rule: 'consecutiveSpaces', line: 4 },
    },
    {
        check: 'naming/identifiers',
        files: { 'Sources/App/Greeting.swift': SNAKE },
        expected: { file: 'Sources/App/Greeting.swift', rule: 'case', line: 4 },
    },
    {
        check: 'swift/trivial-function',
        files: { 'Sources/App/Welcome.swift': FORWARD },
        expected: { file: 'Sources/App/Welcome.swift', rule: 'trivial-function', line: 4 },
    },
    {
        check: 'swift/trivial-function',
        files: { 'Sources/App/Pair.swift': TINY },
        expected: { file: 'Sources/App/Pair.swift', rule: 'trivial-function', line: 3 },
    },
    {
        check: 'swift/duplicate-functions',
        files: { 'Sources/App/Mix.swift': COPIES },
        expected: { file: 'Sources/App/Mix.swift', rule: 'same-body', line: 4 },
    },
    {
        check: 'swift/private-before-public',
        files: { 'Sources/App/Limits.swift': BELOW },
        expected: { file: 'Sources/App/Limits.swift', rule: 'private-below-shared', line: 6 },
    },
    {
        check: 'swift/env-access-owner',
        files: { 'Sources/App/Home.swift': reader('homeFolder'), 'Sources/App/User.swift': reader('userFolder') },
        expected: { file: 'Sources/App/Home.swift', rule: 'read-outside-owner', line: 5 },
    },
    {
        check: 'swift/env-access-owner',
        files: { 'Sources/App/Home.swift': reader('homeFolder') },
        policy: '[architecture]\nroles = { env = "Sources/App/Environment.swift" }\n',
        expected: { file: 'Sources/App/Home.swift', rule: 'read-outside-owner', line: 5 },
    },
];

describe('the swift configuration', () => {
    test(
        'Swift checks preserve source headers during linting and formatting',
        async () => {
            const header = '// Greeting.swift\n// Created by Alex Garcia.\n// Copyright 2026 Example Contributors.\n\n';
            const path = 'Sources/App/Greeting.swift';
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { [path]: header + CLEAN_SWIFT });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            await installAtLevel(sandbox.path, SWIFT_INIT, environment);
            for (const check of ['swift/swiftlint', 'swift/swiftformat']) {
                const result = await run(sandbox.path, ['check', '--only', check, '--no-cache'], environment);
                expect(result.code, result.stdout + result.stderr).toBe(0);
            }
            await Bun.write(join(sandbox.path, path), header + SPACED);
            const fixed = await run(
                sandbox.path,
                ['check', '--only', 'swift/swiftformat', '--fix', '--no-cache'],
                environment,
            );
            expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
            expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(header + CLEAN_SWIFT);
        },
        PLANTED_TIMEOUT_MS * 3,
    );

    test.each([...CASES, ...STRUCTURAL])(
        '$check reports $expected.rule in $expected.file and accepts corrected Swift source',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'Sources/App/Greeting.swift': CLEAN_SWIFT });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            await installAtLevel(sandbox.path, SWIFT_INIT, environment);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            // SwiftLint has no Windows build, so that check is skipped there and the run passes.
            const isSkipped = process.platform === 'win32' && planted.check === 'swift/swiftlint';
            const withExpected: Finding[] = containingAll([containing(planted.expected)]);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(isSkipped ? 0 : 1);
            expect(failed.checks).toMatchObject([{ check: planted.check, status: isSkipped ? 'skipped' : 'fail' }]);
            expect(failed.checks[0]!.findings).toStrictEqual(isSkipped ? [] : withExpected);
            const files = Object.fromEntries(
                Object.keys(planted.files).map((path, index) => [
                    path,
                    CLEAN_SWIFT.replaceAll('greeting', index === 0 ? 'greetPerson' : 'greetVisitor').replaceAll(
                        'hello',
                        `welcome ${String(index)}`,
                    ),
                ]),
            );
            const corrected = await runPlanted(sandbox.path, { ...planted, files }, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([
                { check: planted.check, status: isSkipped ? 'skipped' : 'ok', findings: [] },
            ]);
            const checked = await run(sandbox.path, ['check', '--stage', 'commit', '--json'], environment);
            const atCommit = JSON.parse(checked.stdout) as {
                checks: { check: string }[];
            };
            const ids = atCommit.checks.map((check) => check.check);
            expect(ids).not.toContain('swift/build');
            expect(ids).not.toContain('swift/swiftlint-analyze');
            expect(ids).not.toContain('swift/periphery');
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
