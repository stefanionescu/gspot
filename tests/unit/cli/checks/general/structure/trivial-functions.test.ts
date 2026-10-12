import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runBashSamples } from '#tests/setup/fixes.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CLEAN_SWIFT } from '#tests/config/swift/lint.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { PROPERTY_READERS } from '#tests/config/structure/env-reads.ts';
import { BASH_TRIVIAL_FUNCTION_CASES } from '#tests/config/bash/trivial-functions.ts';

import {
    TRIVIAL_FILES,
    STATEMENT_COUNT_CASES,
    ACCESSOR_DECLARATIONS,
    SWIFT_FUNCTION_LIMITS,
    TRIVIAL_FUNCTION_CASES,
    PACKAGE_DOCSTRING_CASES,
} from '#tests/config/structure/trivial-functions.ts';

test('Swift reports constructors, accessors, decorated methods and nested functions, and leaves closures alone', async () => {
    const text = ACCESSOR_DECLARATIONS;
    await using sandbox = await testdir({
        'example.swift': text,
        'gspot.toml': settingsText(['swift'], { level: 'all', tables: SWIFT_FUNCTION_LIMITS }),
    });
    const initial = await checkFindings(sandbox.path, 'structure/trivial-functions');
    expect(initial.map((problem) => ({ rule: problem.rule, line: problem.line }))).toStrictEqual([
        ...[2, 4, 5, 7, 8].map((line) => ({ rule: 'trivial-function', line })),
        { rule: 'trivial-file', line: 1 },
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        settingsText(['swift'], { level: 'all', tables: '[limits.swift]\nmin_function_statements = 3\n' }),
    );
    const increased = await checkFindings(sandbox.path, 'structure/trivial-functions');
    expect(increased.map((problem) => ({ rule: problem.rule, line: problem.line }))).toStrictEqual([
        ...[2, 4, 5, 7, 8, 9].map((line) => ({ rule: 'trivial-function', line })),
        { rule: 'trivial-file', line: 1 },
    ]);
});

test('Swift includes implicit getters, property readers and subscript accessors', async () => {
    const text = PROPERTY_READERS;
    await using sandbox = await testdir({
        'example.swift': text,
        'gspot.toml': settingsText(['swift'], { level: 'all', tables: SWIFT_FUNCTION_LIMITS }),
    });
    const result = await checkFindings(sandbox.path, 'structure/trivial-functions');
    expect(result.map((problem) => ({ rule: problem.rule, line: problem.line }))).toStrictEqual(
        [2, 4, 5, 8, 9].map((line) => ({ rule: 'trivial-function', line })),
    );
});

test.each([...TRIVIAL_FUNCTION_CASES])(
    'Swift $name reports the trivial function at line $line',
    async ({ source, line, trivialFile }) => {
        await using sandbox = await testdir({
            'Source.swift': source,
            'gspot.toml': settingsText(['swift'], {
                level: 'all',
                tables: SWIFT_FUNCTION_LIMITS,
            }),
        });
        const result = await checkFindings(sandbox.path, 'structure/trivial-functions');
        expect(result.map((problem) => ({ line: problem.line, rule: problem.rule }))).toStrictEqual([
            { line, rule: 'trivial-function' },
            ...(trivialFile ? [{ line: 1, rule: 'trivial-file' }] : []),
        ]);
    },
);

test('Swift source with substantial function bodies passes', async () => {
    await using sandbox = await testdir({
        'Source.swift': CLEAN_SWIFT,
        'gspot.toml': settingsText(['swift'], { level: 'all', tables: SWIFT_FUNCTION_LIMITS }),
    });
    expect(await checkFindings(sandbox.path, 'structure/trivial-functions')).toStrictEqual([]);
});

test('Python counts nested control flow, reports decorated methods and leaves lambdas alone', async () => {
    const text =
        'class A:\n    @decorator\n    def method(self):\n        return 1\ndef outer():\n    def inner():\n        one()\n        two()\n        three()\n    return lambda x: x\ndef flow(x):\n    if x:\n        one()\n        two()\n';
    await using sandbox = await testdir({ 'example.py': text });
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        settingsText(['python'], { level: 'all', tables: '[limits.python]\nmin_function_statements = 2\n' }),
    );
    const initial = await checkFindings(sandbox.path, 'structure/trivial-functions');
    expect(initial.map((entry) => ({ rule: entry.rule, line: entry.line }))).toStrictEqual(
        [3, 5].map((line) => ({ rule: 'trivial-function', line })),
    );
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        settingsText(['python'], { level: 'all', tables: '[limits.python]\nmin_function_statements = 3\n' }),
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
        await using sandbox = await testdir({
            [`example.${extension}`]: source,
            'gspot.toml': settingsText([language], {
                level: 'all',
                tables: `[limits.${language}]\nmin_function_statements = 2\n`,
            }),
        });
        using resources = new DisposableStack();

        const findings = await checkFindings(sandbox.path, 'structure/trivial-functions', { resources });
        expect(findings).toMatchObject([
            { rule: 'trivial-function', message: textContaining('has 2 statements.') },
            { rule: 'trivial-file' },
        ]);
    },
);

test.each([...PACKAGE_DOCSTRING_CASES])(
    'a Python package docstring does not hide code: %s',
    async (source, expected) => {
        await using sandbox = await testdir({
            '__init__.py': source,
            'gspot.toml': settingsText(['python'], {
                level: 'all',
                tables: '[limits.python]\nmin_function_statements = 2\n',
            }),
        });
        using resources = new DisposableStack();

        const findings = await checkFindings(sandbox.path, 'structure/trivial-functions', { resources });
        expect(findings.some(({ rule }) => rule === 'trivial-file')).toBe(expected);
    },
);

test.each([...TRIVIAL_FILES])('$name is trivial: $expected', async ({ language, source, expected }) => {
    const extension = ({ python: 'py', bash: 'sh', swift: 'swift' } as const)[language];
    await using sandbox = await testdir({
        [`example.${extension}`]: source,
        'gspot.toml': settingsText([language], {
            level: 'all',
            tables: `[limits.${language}]\nmin_function_statements = 2\n`,
        }),
    });
    using resources = new DisposableStack();

    const findings = await checkFindings(sandbox.path, 'structure/trivial-functions', { resources });
    expect(findings.some(({ rule }) => rule === 'trivial-file')).toBe(expected);
});

runBashSamples(BASH_TRIVIAL_FUNCTION_CASES);
