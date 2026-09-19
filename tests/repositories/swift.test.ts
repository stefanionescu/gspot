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

const CASES: PlantedCase[] = [
    { id: 'swift/swiftlint', files: { 'Sources/App/Cast.swift': CAST }, expected: 'force_cast' },
    { id: 'swift/swiftformat', files: { 'Sources/App/Greeting.swift': SPACED }, expected: 'consecutiveSpaces' },
    {
        id: 'naming/identifiers',
        files: { 'Sources/App/Greeting.swift': SNAKE },
        expected: 'swift function "make_greeting"',
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
