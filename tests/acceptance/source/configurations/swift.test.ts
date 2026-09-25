import { reportSchema } from '#cli/execution/report.ts';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { install, toolsPath } from '#tests/support/cli/tools.ts';
// Planted repository for the swift configuration: a force cast, doubled spaces, and a snake case function.
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

const INIT = [
    'init',
    '--yes',
    '--configurations',
    'swift',
    'naming',
    '--without',
    'spelling',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const CLEAN =
    'import Foundation\n\n/// Builds the greeting for a person.\npublic func greeting(for name: String) -> String {\n    let person = name.trimmingCharacters(in: .whitespacesAndNewlines)\n    if person.isEmpty {\n        return "hello"\n    }\n    return "hello \\(person)"\n}\n';
const CAST =
    'import Foundation\n\n/// Reads a value as text.\nfunc text(from value: Any) -> NSString {\n    value as! NSString\n}\n';
const SPACED = CLEAN.replace('func greeting', () => 'func   greeting');
const SNAKE = CLEAN.replace('func greeting', () => 'func make_greeting');

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
        files: { 'Sources/App/Cast.swift': CAST },
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
            await createFileTree(sandbox.path, { [path]: header + CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
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
            expect(readFileSync(join(sandbox.path, path), 'utf8')).toBe(header + CLEAN);
        },
        PLANTED_TIMEOUT_MS * 3,
    );

    test.each([...CASES, ...STRUCTURAL])(
        '$check reports $expected.rule in $expected.file and accepts corrected Swift source',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'Sources/App/Greeting.swift': CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            if (process.platform === 'win32' && planted.check === 'swift/swiftlint') {
                expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                expect(failed.checks).toMatchObject([{ check: planted.check, status: 'skipped' }]);
                return;
            }
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining(planted.expected));
            const files = Object.fromEntries(
                Object.keys(planted.files).map((path, index) => [
                    path,
                    CLEAN.replaceAll('greeting', index === 0 ? 'greetPerson' : 'greetVisitor').replaceAll(
                        'hello',
                        `welcome ${index}`,
                    ),
                ]),
            );
            const corrected = await runPlanted(sandbox.path, { ...planted, files }, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
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

describe('the swift configuration inside a scope', () => {
    test(
        'SwiftLint and SwiftFormat read the configuration of their scope, and the findings carry the scope path',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'ios/Sources/App/Greeting.swift': CLEAN,
                'README.md': '# planted\n',
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            const argv = [
                'init',
                '--yes',
                '--scope',
                'ios=swift',
                '--without',
                'spelling',
                'naming',
                'markdown',
                'docs',
                '--no-runner',
                '--no-ci',
                '--no-hooks',
                '--no-rules',
                '--no-install',
            ];
            await install(sandbox.path, argv, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            for (const id of ['swift/swiftlint', 'swift/swiftformat']) {
                const clean = await run(sandbox.path, ['check', '--only', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            const outcome = await runPlanted(
                sandbox.path,
                { check: 'swift/swiftlint', files: { 'ios/Sources/App/Cast.swift': CAST } },
                environment,
            );
            if (process.platform === 'win32') {
                expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                expect(outcome.stdout).toContain('swiftlint has no Windows build');
            } else {
                expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
                const failed = reportSchema.parse(
                    await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
                );
                expect(failed.checks).toMatchObject([{ check: 'swift/swiftlint', scope: 'ios', status: 'fail' }]);
                expect(failed.checks[0]!.findings).toContainEqual(
                    expect.objectContaining({ file: 'ios/Sources/App/Cast.swift', rule: 'force_cast', line: 5 }),
                );
                await Bun.write(
                    join(sandbox.path, 'ios/Sources/App/Cast.swift'),
                    CLEAN.replace('greeting', 'correctedGreeting'),
                );
                const corrected = await run(
                    sandbox.path,
                    ['check', '--only', 'swift/swiftlint', '--no-cache', '--json'],
                    environment,
                );
                expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
                expect(reportSchema.parse(JSON.parse(corrected.stdout)).checks).toMatchObject([
                    { check: 'swift/swiftlint', scope: 'ios', status: 'ok', findings: [] },
                ]);
            }
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});

const PACKAGE =
    '// swift-tools-version:5.9\nimport PackageDescription\n\nlet package = Package(\n    name: "App",\n    products: [.library(name: "App", targets: ["App"])],\n    targets: [.target(name: "App")]\n)\n';
const LIBRARY =
    '/// Builds the greeting for a person.\npublic func greeting(for name: String) -> String {\n    "hello \\(name)"\n}\n';
const BUILD_CASES: FindingCase[] = [
    {
        check: 'swift/build',
        files: { 'Sources/App/Count.swift': '/// A number that holds text.\npublic let count: Int = "three"\n' },
        expected: { file: 'Sources/App/Count.swift', rule: 'compiler', line: 2 },
    },
    {
        check: 'swift/swiftlint-analyze',
        files: {
            'Sources/App/Pair.swift':
                'import Foundation\n\n/// The size of a pair.\npublic func pairSize(of count: Int) -> Int {\n    count * 2\n}\n',
        },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused_import', line: 1 },
    },
    {
        check: 'swift/periphery',
        files: {
            'Sources/App/Pair.swift':
                '/// The size of a pair.\npublic func pairSize(of count: Int) -> Int {\n    count * 2\n}\n\nprivate func neverCalled() -> Int {\n    count(of: 3)\n}\n\nprivate func count(of size: Int) -> Int {\n    size\n}\n',
        },
        expected: { file: 'Sources/App/Pair.swift', rule: 'unused', line: 6 },
    },
];

describe('the swift configuration over a package', () => {
    test.each(BUILD_CASES)(
        '$check reports $expected.rule in the Swift package and accepts corrected source',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                '.gitignore': '.build\n',
                'Package.swift': PACKAGE,
                'Sources/App/Greeting.swift': LIBRARY,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'periphery', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            if (process.platform !== 'darwin') {
                expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                expect(failed.checks).toMatchObject([{ check: planted.check, status: 'skipped' }]);
                return;
            }
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(expect.objectContaining(planted.expected));
            const path = planted.expected.file;
            const text = planted.files[path]!;
            const correctedText =
                planted.check === 'swift/build'
                    ? text.replace('"three"', '3')
                    : planted.check === 'swift/swiftlint-analyze'
                      ? text.replace('import Foundation\n\n', '')
                      : text.slice(0, text.indexOf('private func'));
            const corrected = await runPlanted(
                sandbox.path,
                { ...planted, files: { [path]: correctedText } },
                environment,
            );
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
        },
        PLANTED_TIMEOUT_MS * 10,
    );
});
