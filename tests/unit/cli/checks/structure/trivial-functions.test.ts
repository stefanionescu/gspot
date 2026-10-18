import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { Finding } from '#cli/types/checks/run/check.ts';
import { EXPORTED_FUNCTION_FILES } from '#tests/data/checks/structure/exported-functions.ts';

import {
    TRIVIAL_FILES,
    ACCESSOR_DECLARATIONS,
    STATEMENT_COUNT_CASES,
    SWIFT_FUNCTION_LIMITS,
    TRIVIAL_FUNCTION_CASES,
} from '#tests/data/checks/structure/trivial-functions.ts';

test('Swift reports constructors, accessors, decorated methods and nested functions, and leaves closures alone', async () => {
    const text = ACCESSOR_DECLARATIONS;
    await using sandbox = await testdir({
        'example.swift': text,
        'gspot.toml': buildSettingsText(['swift'], { level: 'all', tables: SWIFT_FUNCTION_LIMITS }),
    });
    const initial = await checkFindings(sandbox.path, 'structure/trivial-functions');
    expect(initial.map((finding) => ({ rule: finding.rule, line: finding.line }))).toStrictEqual([
        ...[2, 4, 5, 7, 8].map((line) => ({ rule: 'trivial-function', line })),
        { rule: 'trivial-file', line: 1 },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildSettingsText(['swift'], { level: 'all', tables: '[limits.swift]\ntrivial_function_statements = 3\n' }),
    );
    const increased = await checkFindings(sandbox.path, 'structure/trivial-functions');
    expect(increased.map((finding) => ({ rule: finding.rule, line: finding.line }))).toStrictEqual([
        ...[2, 4, 5, 7, 8, 9].map((line) => ({ rule: 'trivial-function', line })),
        { rule: 'trivial-file', line: 1 },
    ]);
});

test.each([...TRIVIAL_FUNCTION_CASES])(
    'Swift $name reports the trivial functions at lines $lines',
    async ({ source, lines, trivialFile }) => {
        await using sandbox = await testdir({
            'Source.swift': source,
            'gspot.toml': buildSettingsText(['swift'], {
                level: 'all',
                tables: SWIFT_FUNCTION_LIMITS,
            }),
        });
        const result = await checkFindings(sandbox.path, 'structure/trivial-functions');
        expect(result.map((finding) => ({ line: finding.line, rule: finding.rule }))).toStrictEqual([
            ...lines.map((line) => ({ line, rule: 'trivial-function' })),
            ...(trivialFile ? [{ line: 1, rule: 'trivial-file' }] : []),
        ]);
    },
);

test('Python counts nested control flow, reports decorated methods and leaves lambdas alone', async () => {
    const text =
        'class A:\n    @decorator\n    def method(self):\n        return 1\ndef outer():\n    def inner():\n        one()\n        two()\n        three()\n    return lambda x: x\ndef flow(x):\n    if x:\n        one()\n        two()\n';
    await using sandbox = await testdir({ 'example.py': text });
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildSettingsText(['python'], { level: 'all', tables: '[limits.python]\ntrivial_function_statements = 2\n' }),
    );
    const initial = await checkFindings(sandbox.path, 'structure/trivial-functions');
    expect(initial.map((entry) => ({ rule: entry.rule, line: entry.line }))).toStrictEqual(
        [3, 5].map((line) => ({ rule: 'trivial-function', line })),
    );
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildSettingsText(['python'], { level: 'all', tables: '[limits.python]\ntrivial_function_statements = 3\n' }),
    );
    const increased = await checkFindings(sandbox.path, 'structure/trivial-functions');
    expect(increased.map((entry) => ({ rule: entry.rule, line: entry.line }))).toStrictEqual([
        ...[3, 5, 6, 11].map((line) => ({ rule: 'trivial-function', line })),
        { rule: 'trivial-file', line: 1 },
    ]);
});

test.each([...STATEMENT_COUNT_CASES])(
    '%s counts two statements past comments and docstrings',
    async (language, source) => {
        const extension = ({ python: 'py', bash: 'sh', swift: 'swift' } as const)[language];
        const findings = await checkTrivialFile(language, `example.${extension}`, source);
        expect(findings).toMatchObject([
            { rule: 'trivial-function', message: matchSubstring('has 2 statements.') },
            { rule: 'trivial-file' },
        ]);
    },
);

test.each([...TRIVIAL_FILES])('$name is trivial: $expected', async ({ language, file, source, expected }) => {
    const findings = await checkTrivialFile(language, file, source);
    expect(findings.some(({ rule }) => rule === 'trivial-file')).toBe(expected);
});

test('exported JavaScript and TypeScript expressions with one importing file are reported, while shared functions and command definitions stay', async () => {
    await using sandbox = await testdir({
        ...EXPORTED_FUNCTION_FILES,
        'gspot.toml': buildSettingsText(['typescript'], { level: 'all' }),
    });
    const findings = await checkFindings(sandbox.path, 'structure/trivial-functions');
    expect(
        findings
            .map(({ file, line, rule }) => ({ file, line, rule }))
            .toSorted((left, right) => left.file.localeCompare(right.file) || (left.line ?? 0) - (right.line ?? 0)),
    ).toStrictEqual([
        { file: 'default.cjs', line: 1, rule: 'trivial-function' },
        { file: 'forward.ts', line: 1, rule: 'trivial-function' },
        { file: 'forward.ts', line: 2, rule: 'trivial-function' },
        { file: 'namespace.mjs', line: 1, rule: 'trivial-function' },
    ]);
});

/** Check one source with the same two-statement limit and dispose its compiler resources. */
async function checkTrivialFile(
    language: 'python' | 'bash' | 'swift',
    file: string,
    source: string,
): Promise<readonly Finding[]> {
    await using sandbox = await testdir({
        [file]: source,
        'gspot.toml': buildSettingsText([language], {
            level: 'all',
            tables: `[limits.${language}]\ntrivial_function_statements = 2\n`,
        }),
    });
    using resources = new DisposableStack();
    return await checkFindings(sandbox.path, 'structure/trivial-functions', { resources });
}
