// Planted repository for the swift preset: a force cast, doubled spaces, and a snake case function.
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'swift,naming',
    '--without',
    'structure,spelling',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const CLEAN =
    'import Foundation\n\n/// Builds the greeting for a person.\nfunc greeting(for name: String) -> String {\n    "hello \\(name)"\n}\n';
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
    { id: 'swift/swiftlint', files: { 'Sources/App/Cast.swift': CAST }, expected: 'force_cast' },
    { id: 'swift/swiftformat', files: { 'Sources/App/Greeting.swift': SPACED }, expected: 'consecutiveSpaces' },
    {
        id: 'naming/identifiers',
        files: { 'Sources/App/Greeting.swift': SNAKE },
        expected: 'swift function "make_greeting"',
    },
    { id: 'swift/call-through', files: { 'Sources/App/Welcome.swift': FORWARD }, expected: 'straight to greeting' },
    { id: 'swift/trivial-function', files: { 'Sources/App/Pair.swift': TINY }, expected: 'doubled holds 1 statement' },
    { id: 'swift/duplicate-functions', files: { 'Sources/App/Mix.swift': COPIES }, expected: 'have the same body' },
    {
        id: 'swift/private-before-public',
        files: { 'Sources/App/Limits.swift': BELOW },
        expected: 'localLimit is private',
    },
    {
        id: 'swift/env-access-owner',
        files: { 'Sources/App/Home.swift': reader('homeFolder'), 'Sources/App/Shell.swift': reader('shellFolder') },
        expected: '2 files read the process environment',
    },
    {
        id: 'swift/env-access-owner',
        files: { 'Sources/App/Home.swift': reader('homeFolder') },
        policy: '[architecture]\nroles = { env = "Sources/App/Environment.swift" }\n',
        expected: 'outside the environment owner',
    },
];

describe('the swift preset', () => {
    test(
        'SwiftLint, SwiftFormat and the naming engine fire on their planted defects, and the build waits for push',
        async () => {
            await using fixture = await createFixture({ 'Sources/App/Greeting.swift': CLEAN });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            for (const planted of CASES) {
                const clean = run(fixture.path, ['check', planted.id, '--no-cache'], environment);
                expect(clean.code, `${planted.id}: ${clean.stdout}${clean.stderr}`).toBe(0);
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}${outcome.stderr}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
                expect(outcome.stdout, planted.id).toContain('Sources/App/');
            }
            const atCommit = JSON.parse(
                run(fixture.path, ['check', '--at', 'commit', '--json'], environment).stdout,
            ) as {
                checks: { id: string }[];
            };
            const ids = atCommit.checks.map((check) => check.id);
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
            await using fixture = await createFixture({
                'ios/Sources/App/Greeting.swift': CLEAN,
                'README.md': '# planted\n',
            });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['swiftlint', 'swiftformat', 'typos', 'ec']) };
            const argv = [
                'init',
                '--yes',
                '--scope',
                'ios=swift',
                '--without',
                'structure,spelling,naming,markdown,docs',
                '--runner',
                'none',
                '--ci',
                'none',
                '--hooks',
                'none',
                '--no-rules',
                '--no-install',
            ];
            await install(fixture.path, argv, environment);
            for (const id of ['swift/swiftlint', 'swift/swiftformat']) {
                const clean = run(fixture.path, ['check', id, '--no-cache'], environment);
                expect(clean.code, `${id}: ${clean.stdout}${clean.stderr}`).toBe(0);
            }
            const outcome = await runPlanted(
                fixture.path,
                { id: 'swift/swiftlint', files: { 'ios/Sources/App/Cast.swift': CAST }, expected: 'force_cast' },
                environment,
            );
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            expect(outcome.stdout).toContain('ios/Sources/App/Cast.swift');
        },
        PLANTED_TIMEOUT_MS * 4,
    );
});
