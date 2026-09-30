// Planted repository for the swift configuration: a force cast, doubled spaces, a snake case function, and the structural defects.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { run } from '#tests/support/cli/command.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { plantedCases } from '#tests/support/cli/planted.ts';
import { CAST_SWIFT, CLEAN_SWIFT, PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { TINY, BELOW, COPIES, FORWARD, STRUCTURAL } from '#tests/inputs/acceptance/source/kits/swift.ts';

const SPACED = CLEAN_SWIFT.replace('func greeting', () => 'func   greeting');
const SNAKE = CLEAN_SWIFT.replace('func greeting', () => 'func make_greeting');
const HOME = `import Foundation\n\n/// Reads one variable.\nfunc homeFolder() -> String? {\n    ProcessInfo.processInfo.environment["HOME"]\n}\n`;
const CASES: FindingCase[] = [
    // SwiftLint has no Windows build.
    {
        check: 'swift/swiftlint',
        files: { 'Sources/App/Cast.swift': CAST_SWIFT },
        expected: { file: 'Sources/App/Cast.swift', rule: 'force_cast', line: 5 },
        platforms: ['darwin', 'linux'],
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
        check: 'swift/import-comments',
        files: {
            'Sources/App/Noted.swift':
                'import Foundation\n// the interface kit\nimport UIKit\n\n/// The size of a label.\nfunc labelSize() -> Int {\n    let label = UILabel()\n    return Int(label.frame.width)\n}\n',
        },
        expected: { file: 'Sources/App/Noted.swift', rule: 'import-comment', line: 2 },
    },
    {
        check: 'swift/env-access-owner',
        files: { 'Sources/App/Home.swift': HOME, 'Sources/App/User.swift': HOME.replace('homeFolder', 'userFolder') },
        expected: { file: 'Sources/App/Home.swift', rule: 'read-outside-owner', line: 5 },
    },
    {
        check: 'swift/env-access-owner',
        files: { 'Sources/App/Home.swift': HOME },
        policy: '[architecture]\nroles = { env = "Sources/App/Environment.swift" }\n',
        expected: { file: 'Sources/App/Home.swift', rule: 'read-outside-owner', line: 5 },
    },
    ...STRUCTURAL,
];

plantedCases(
    'the swift configuration',
    {
        kits: ['swift', 'naming'],
        modules: false,
        without: ['spelling'],
        tools: ['swiftlint', 'swiftformat'],
        files: { 'Sources/App/Greeting.swift': CLEAN_SWIFT },
        // Every planted file becomes a distinct clean function, so no two corrected files share a body.
        corrected: (planted) => ({
            files: Object.fromEntries(
                Object.keys(planted.files).map((path, index) => [
                    path,
                    CLEAN_SWIFT.replaceAll('greeting', index === 0 ? 'greetPerson' : 'greetVisitor').replaceAll(
                        'hello',
                        `welcome ${String(index)}`,
                    ),
                ]),
            ),
        }),
    },
    CASES,
    (planted) => {
        test(
            'the commit stage leaves the build, the analyzer, and the dead code scan to their own stages',
            async () => {
                const { root, environment } = planted();
                const checked = await run(root, ['check', '--stage', 'commit', '--json'], environment);
                const ids = reportSchema.parse(JSON.parse(checked.stdout)).checks.map((check) => check.check);
                expect(ids).not.toContain('swift/build');
                expect(ids).not.toContain('swift/swiftlint-analyze');
                expect(ids).not.toContain('swift/periphery');
            },
            PLANTED_TIMEOUT_MS * 2,
        );

        test(
            'Swift checks preserve source headers during linting and formatting',
            async () => {
                const { root, environment } = planted();
                const header =
                    '// Greeting.swift\n// Created by Alex Garcia.\n// Copyright 2026 Example Contributors.\n\n';
                const path = join(root, 'Sources/App/Greeting.swift');
                await Bun.write(path, header + SPACED);
                const fixed = await run(
                    root,
                    ['check', '--only', 'swift/swiftformat', '--fix', '--no-cache'],
                    environment,
                );
                expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
                expect(readFileSync(path, 'utf8')).toBe(header + CLEAN_SWIFT);
                await Bun.write(path, CLEAN_SWIFT);
            },
            PLANTED_TIMEOUT_MS * 3,
        );
    },
);
