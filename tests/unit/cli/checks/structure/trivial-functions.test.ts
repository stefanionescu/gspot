import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { matchSubstring, captureRejection } from '#tests/setup/matchers.ts';
import { EXPORTED_FUNCTION_FILES } from '#tests/data/checks/structure/exported-functions.ts';

import {
    TRIVIAL_FILES,
    PYTHON_INTERFACES,
    ACCESSOR_DECLARATIONS,
    STATEMENT_COUNT_CASES,
    TRIVIAL_FUNCTION_CASES,
} from '#tests/data/checks/structure/trivial-functions.ts';

/** Check one source at the configured statement limit and dispose its compiler resources. */
async function checkTrivialFile(
    language: 'python' | 'bash' | 'swift',
    file: string,
    source: string,
    options: { statements?: number } = {},
): Promise<readonly Finding[]> {
    await using sandbox = await testdir({
        [file]: source,
        'gspot.toml': buildSandboxSettings([language], {
            level: 'all',
            tables: `[limits.${language}]\ntrivial_function_statements = ${String(options.statements ?? 2)}\n`,
        }),
    });
    using resources = new DisposableStack();
    return await checkFindings(sandbox.path, 'structure/trivial-functions', { resources });
}

test('Swift reports constructors, accessors, decorated methods, and nested functions, and counts the statements of closures toward their function', async () => {
    const initial = await checkTrivialFile('swift', 'example.swift', ACCESSOR_DECLARATIONS);
    expect(initial.map((finding) => ({ rule: finding.rule, line: finding.line }))).toStrictEqual([
        ...[2, 4, 5, 7].map((line) => ({ rule: 'trivial-function', line })),
    ]);
    const increased = await checkTrivialFile('swift', 'example.swift', ACCESSOR_DECLARATIONS, { statements: 3 });
    expect(increased.map((finding) => ({ rule: finding.rule, line: finding.line }))).toStrictEqual([
        ...[2, 4, 5, 7, 9].map((line) => ({ rule: 'trivial-function', line })),
    ]);
});

test.each([...TRIVIAL_FUNCTION_CASES])(
    'Swift $name reports the trivial functions at lines $lines',
    async ({ source, lines, trivialFile }) => {
        const result = await checkTrivialFile('swift', 'Source.swift', source);
        expect(result.map((finding) => ({ line: finding.line, rule: finding.rule }))).toStrictEqual([
            ...lines.map((line) => ({ line, rule: 'trivial-function' })),
            ...(trivialFile ? [{ line: 1, rule: 'trivial-file' }] : []),
        ]);
    },
);

test('Python counts the statements of nested functions, lambdas, and control flow, and reports decorated methods', async () => {
    const text =
        'class A:\n    @decorator\n    def method(self):\n        return 1\ndef outer():\n    def inner():\n        one()\n        two()\n        three()\n    return lambda x: x\ndef flow(x):\n    if x:\n        one()\n        two()\n';
    const initial = await checkTrivialFile('python', 'example.py', text);
    expect(initial.map((entry) => ({ rule: entry.rule, line: entry.line }))).toStrictEqual(
        [3].map((line) => ({ rule: 'trivial-function', line })),
    );
    const increased = await checkTrivialFile('python', 'example.py', text, { statements: 3 });
    expect(increased.map((entry) => ({ rule: entry.rule, line: entry.line }))).toStrictEqual([
        ...[3, 6, 11].map((line) => ({ rule: 'trivial-function', line })),
    ]);
});

test('Python overloads, abstract and protocol methods, accessors, and method stubs are not trivial functions', async () => {
    const findings = await checkTrivialFile('python', 'interfaces.py', PYTHON_INTERFACES);
    expect(findings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([{ rule: 'trivial-function', line: 25 }]);
});

test('an ignore with names keeps those functions out of the findings, and only that check takes names', async () => {
    const ignore =
        '[[ignore]]\ncheck = "structure/trivial-functions"\nnames = ["parse"]\npaths = ["interfaces.py"]\nreason = "The framework calls parse by name."\n';
    await using sandbox = await testdir({
        'interfaces.py': PYTHON_INTERFACES,
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: `[limits.python]\ntrivial_function_statements = 2\n${ignore}`,
        }),
    });
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['structure/trivial-functions'] }),
    );
    expect(report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    await writeFile(
        `${sandbox.path}/gspot.toml`,
        buildSandboxSettings(['python'], {
            level: 'all',
            tables: ignore.replace('structure/trivial-functions', 'python/ruff'),
        }),
    );
    expect(await captureRejection(checkFindings(sandbox.path, 'structure/trivial-functions'))).toContain(
        'names applies only to structure/trivial-functions and python/vulture, whose findings name a definition.',
    );
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
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
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
