// Planted repository for the swift preset: a force cast, doubled spaces, and a snake case function.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/types/acceptance.ts';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'swift',
    'naming',
    '--without',
    'structure',
    'spelling',
    '--no-runner',
    '--no-ci',
    '--no-hooks',
    '--no-rules',
    '--no-install',
];
const CLEAN =
    'import Foundation\n\n/// Builds the greeting for a person.\npublic func greeting(for name: String) -> String {\n    "hello \\(name)"\n}\n';
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

const CASES: PlantedCase[] = [
    { check: 'swift/swiftlint', files: { 'Sources/App/Cast.swift': CAST }, expected: 'force_cast' },
    { check: 'swift/swiftformat', files: { 'Sources/App/Greeting.swift': SPACED }, expected: 'consecutiveSpaces' },
    {
        check: 'naming/identifiers',
        files: { 'Sources/App/Greeting.swift': SNAKE },
        expected: 'swift function "make_greeting"',
    },
    { check: 'swift/call-through', files: { 'Sources/App/Welcome.swift': FORWARD }, expected: 'straight to greeting' },
    {
        check: 'swift/trivial-function',
        files: { 'Sources/App/Pair.swift': TINY },
        expected: 'doubled holds 1 statement',
    },
    { check: 'swift/duplicate-functions', files: { 'Sources/App/Mix.swift': COPIES }, expected: 'have the same body' },
    {
        check: 'swift/private-before-public',
        files: { 'Sources/App/Limits.swift': BELOW },
        expected: 'localLimit is private',
    },
    {
        check: 'swift/env-access-owner',
        files: { 'Sources/App/Home.swift': reader('homeFolder'), 'Sources/App/User.swift': reader('userFolder') },
        expected: '2 files read the process environment',
    },
    {
        check: 'swift/env-access-owner',
        files: { 'Sources/App/Home.swift': reader('homeFolder') },
        policy: '[architecture]\nroles = { env = "Sources/App/Environment.swift" }\n',
        expected: 'outside the environment owner',
    },
];

const SWITCHED =
    'import Foundation\n\nprivate func label(_ count: Int) -> String {\n    switch count {\n    case 0:\n        "none"\n    case 1:\n        "one"\n    default:\n        "many"\n    }\n}\n\n/// The label of a pair.\nfunc pairLabel() -> String {\n    let text = label(2)\n    return text + "!"\n}\n';
const NEGATED =
    'import Foundation\n\n/// Whether a name is new.\nfunc isNew(_ name: String) -> Bool {\n    !["a", "b"].contains(name)\n}\n';

describe('the swift preset', () => {
    test(
        'Swift checks preserve source headers during linting and formatting',
        async () => {
            const header = '// Greeting.swift\n// Created by Alex Garcia.\n// Copyright 2026 Example Contributors.\n\n';
            const path = 'Sources/App/Greeting.swift';
            await using sandbox = await createSandbox({ [path]: header + CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
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

    test(
        'SwiftLint, SwiftFormat and the naming engine fire on their planted defects, and the build waits for push',
        async () => {
            await using sandbox = await createSandbox({ 'Sources/App/Greeting.swift': CLEAN });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            for (const planted of CASES) {
                const clean = await run(sandbox.path, ['check', '--only', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                if (process.platform === 'win32' && planted.check === 'swift/swiftlint') {
                    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                    expect(outcome.stdout).toContain('swiftlint has no Windows build');
                    continue;
                }
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
                expect(outcome.stdout, planted.check).toContain('Sources/App/');
            }
            // A switch is one statement and eleven lines, and a negated call says more than the call: neither is a finding.
            const quiet: PlantedCase[] = [
                { check: 'swift/trivial-function', files: { 'Sources/App/Label.swift': SWITCHED }, expected: '' },
                { check: 'swift/call-through', files: { 'Sources/App/Fresh.swift': NEGATED }, expected: '' },
            ];
            for (const planted of quiet) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(0);
                expect(outcome.stdout, planted.check).toContain('ok');
            }
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

describe('the swift preset inside a scope', () => {
    test(
        'SwiftLint and SwiftFormat read the configuration of their scope, and the findings carry the scope path',
        async () => {
            await using sandbox = await createSandbox({
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
                'structure',
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
                expect(outcome.stdout).toContain('ios/Sources/App/Cast.swift');
            }
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});

const PACKAGE =
    '// swift-tools-version:5.9\nimport PackageDescription\n\nlet package = Package(\n    name: "App",\n    products: [.library(name: "App", targets: ["App"])],\n    targets: [.target(name: "App")]\n)\n';
const LIBRARY =
    '/// Builds the greeting for a person.\npublic func greeting(for name: String) -> String {\n    "hello \\(name)"\n}\n';
const BUILD_CASES: PlantedCase[] = [
    {
        check: 'swift/build',
        files: { 'Sources/App/Count.swift': '/// A number that holds text.\npublic let count: Int = "three"\n' },
        expected: "cannot convert value of type 'String'",
    },
    {
        check: 'swift/swiftlint-analyze',
        files: {
            'Sources/App/Pair.swift':
                'import Foundation\n\n/// The size of a pair.\npublic func pairSize(of count: Int) -> Int {\n    count * 2\n}\n',
        },
        expected: 'unused_import',
    },
    {
        check: 'swift/periphery',
        files: {
            'Sources/App/Pair.swift':
                '/// The size of a pair.\npublic func pairSize(of count: Int) -> Int {\n    count * 2\n}\n\nprivate func neverCalled() -> Int {\n    count(of: 3)\n}\n\nprivate func count(of size: Int) -> Int {\n    size\n}\n',
        },
        expected: "Unused function 'neverCalled()'",
    },
];

describe('the swift preset over a package', () => {
    test(
        'the build, the analyzer and Periphery run on a Swift package and fire on their planted defects',
        async () => {
            await using sandbox = await createSandbox({
                '.gitignore': '.build\n',
                'Package.swift': PACKAGE,
                'Sources/App/Greeting.swift': LIBRARY,
            });
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'periphery', 'typos', 'ec']) };
            await install(sandbox.path, INIT, environment);
            for (const planted of BUILD_CASES) {
                const clean = await run(sandbox.path, ['check', '--only', planted.check, '--no-cache'], environment);
                expect(clean.code, `${planted.check}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(sandbox.path, planted, environment);
                if (process.platform !== 'darwin') {
                    expect(outcome.code, outcome.stdout + outcome.stderr).toBe(0);
                    expect(outcome.stdout).toContain('runs on macos only');
                    continue;
                }
                expect(outcome.code, `${planted.check}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
                expect(outcome.stdout, planted.check).toContain('Sources/App/');
            }
        },
        PLANTED_TIMEOUT_MS * 10,
    );
});
