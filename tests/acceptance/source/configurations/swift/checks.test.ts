// Planted repository for the swift configuration: a force cast, doubled spaces, a snake case function, and the structural defects.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { CAST_SWIFT, CLEAN_SWIFT, SWIFT_INIT } from '#tests/support/cli/swift-fixtures.ts';

const SPACED = CLEAN_SWIFT.replace('func greeting', () => 'func   greeting');
const SNAKE = CLEAN_SWIFT.replace('func greeting', () => 'func make_greeting');

const FORWARD =
    'import Foundation\n\n/// Builds the greeting for a person.\nfunc welcome(for name: String) -> String {\n    return greeting(for: name)\n}\n';
const TINY =
    'import Foundation\n\nprivate func doubled(_ count: Int) -> Int {\n    count * 2\n}\n\n/// The size of a pair.\nfunc pairSize(of count: Int) -> Int {\n    let size = doubled(count)\n    return size + 1\n}\n';
const BODY =
    '    let first = name.uppercased()\n    let second = first.lowercased()\n    let third = second + first\n    return third\n';
const COPIES = `import Foundation\n\n/// One way to mix a name.\nfunc mixed(_ name: String) -> String {\n${BODY}}\n\n/// The same way again.\nfunc blended(_ name: String) -> String {\n${BODY}}\n`;
const BELOW =
    'import Foundation\n\n/// The limit other files read.\nlet sharedLimit = 3\n\nprivate let localLimit = 2\n\n/// Adds the two limits.\nfunc bothLimits() -> Int {\n    sharedLimit + localLimit\n}\n';
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

const SWITCHED =
    'import Foundation\n\nprivate func label(_ count: Int) -> String {\n    switch count {\n    case 0:\n        "none"\n    case 1:\n        "one"\n    default:\n        "many"\n    }\n}\n\n/// The label of a pair.\nfunc pairLabel() -> String {\n    let text = label(2)\n    return text + "!"\n}\n';
const NEGATED =
    'import Foundation\n\n/// Whether a name is new.\nfunc isNew(_ name: String) -> Bool {\n    !["a", "b"].contains(name)\n}\n';

const STRUCTURAL: FindingCase[] = [
    {
        check: 'swift/trivial-function',
        files: { 'Sources/App/Label.swift': SWITCHED },
        expected: { file: 'Sources/App/Label.swift', rule: 'trivial-function', line: 15 },
    },
    {
        check: 'swift/trivial-function',
        files: { 'Sources/App/Fresh.swift': NEGATED },
        expected: { file: 'Sources/App/Fresh.swift', rule: 'trivial-function', line: 4 },
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
            await install(sandbox.path, SWIFT_INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
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
            await install(sandbox.path, SWIFT_INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            // SwiftLint has no Windows build, so that check is skipped there and the run passes.
            const isSkipped = process.platform === 'win32' && planted.check === 'swift/swiftlint';
            const withExpected = expect.arrayContaining([expect.objectContaining(planted.expected)]);
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
