// Planted repository for the swift configuration: a force cast, doubled spaces, a snake case function, and the structural defects.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { run } from '#tests/harness/cli/command.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { plantedCases } from '#tests/harness/planted/cases.ts';
import { CAST_SWIFT, CLEAN_SWIFT } from '#tests/samples/swift.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';

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

const SPACED = CLEAN_SWIFT.replace('func greeting', () => 'func   greeting');
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
        check: 'swift/import-comments',
        files: {
            'Sources/App/Noted.swift':
                'import Foundation\n// the interface kit\nimport UIKit\n\n/// The size of a label.\nfunc labelSize() -> Int {\n    let label = UILabel()\n    return Int(label.frame.width)\n}\n',
        },
        expected: { file: 'Sources/App/Noted.swift', rule: 'import-comment', line: 2 },
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
                const ids = (JSON.parse(checked.stdout) as RunReport).checks.map((check) => check.check);
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
                const fixed = await run(root, ['check', '--only', 'swift/swiftformat', '--fix'], environment);
                expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
                expect(readFileSync(path, 'utf8')).toBe(header + CLEAN_SWIFT);
                await Bun.write(path, CLEAN_SWIFT);
            },
            PLANTED_TIMEOUT_MS * 3,
        );
    },
);
