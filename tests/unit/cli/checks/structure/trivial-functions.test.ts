import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/data/checks/bash/sandbox.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCheckSample, expectedSummary, shareBashSandbox, buildSampleSummary } from '#tests/setup/cli/samples.ts';

import {
    TRIVIAL_FILES,
    PYTHON_INTERFACES,
    ACCESSOR_DECLARATIONS,
    STATEMENT_COUNT_CASES,
    TRIVIAL_FUNCTION_CASES,
    TRIVIAL_EXAMPLE_MESSAGE,
    BASH_TRIVIAL_FUNCTION_CASES,
} from '#tests/data/checks/structure/trivial-functions.ts';

const bashSandbox = shareBashSandbox();

/** Check one source at the configured statement limit and dispose its compiler resources. */
async function runTrivialFunctionsCheck(
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
    return await runSandboxCheck(sandbox.path, 'structure/trivial-functions', { resources });
}

test('Swift reports constructors, accessors, decorated methods, and nested functions, and counts the statements of closures toward their function', async () => {
    const initial = await runTrivialFunctionsCheck('swift', 'example.swift', ACCESSOR_DECLARATIONS);
    expect(initial.map((finding) => ({ rule: finding.rule, line: finding.line }))).toStrictEqual([
        ...[2, 4, 5, 7].map((line) => ({ rule: 'trivial-function', line })),
    ]);
    const increased = await runTrivialFunctionsCheck('swift', 'example.swift', ACCESSOR_DECLARATIONS, {
        statements: 3,
    });
    expect(increased.map((finding) => ({ rule: finding.rule, line: finding.line }))).toStrictEqual([
        ...[2, 4, 5, 7, 9].map((line) => ({ rule: 'trivial-function', line })),
    ]);
});

test.each([...TRIVIAL_FUNCTION_CASES])(
    'Swift $name reports the trivial functions at lines $lines',
    async ({ source, lines }) => {
        const result = await runTrivialFunctionsCheck('swift', 'Source.swift', source);
        expect(result.map((finding) => ({ line: finding.line, rule: finding.rule }))).toStrictEqual(
            lines.map((line) => ({ line, rule: 'trivial-function' })),
        );
    },
);

test('Python counts the statements of nested functions, lambdas, and control flow, and reports decorated methods', async () => {
    const text =
        'class A:\n    @decorator\n    def method(self):\n        return 1\ndef outer():\n    def inner():\n        one()\n        two()\n        three()\n    return lambda x: x\ndef flow(x):\n    if x:\n        one()\n        two()\n';
    const initial = await runTrivialFunctionsCheck('python', 'example.py', text);
    expect(initial.map((entry) => ({ rule: entry.rule, line: entry.line }))).toStrictEqual(
        [3].map((line) => ({ rule: 'trivial-function', line })),
    );
    const increased = await runTrivialFunctionsCheck('python', 'example.py', text, { statements: 3 });
    expect(increased.map((entry) => ({ rule: entry.rule, line: entry.line }))).toStrictEqual([
        ...[3, 6, 11].map((line) => ({ rule: 'trivial-function', line })),
    ]);
});

test('Python reports overloads, abstract and protocol methods, properties, setters, and stubs', async () => {
    const findings = await runTrivialFunctionsCheck('python', 'interfaces.py', PYTHON_INTERFACES);
    expect(findings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual(
        [5, 9, 14, 17, 19, 22, 24, 25].map((line) => ({ rule: 'trivial-function', line })),
    );
});

test('an ignore with names keeps those functions out of the findings', async () => {
    const ignore =
        '[[ignore]]\ncheck = "structure/trivial-functions"\nnames = ["read", "save", "size", "hook", "parse"]\npaths = ["interfaces.py"]\nreason = "The framework calls these by name."\n';
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
});

test.each([...STATEMENT_COUNT_CASES])(
    '%s reports a function of two statements, not counting comments and docstrings',
    async (language, source) => {
        const extension = ({ python: 'py', bash: 'sh', swift: 'swift' } as const)[language];
        const findings = await runTrivialFunctionsCheck(language, `example.${extension}`, source);
        expect(findings.map(({ line, rule, message }) => ({ line, rule, message }))).toStrictEqual([
            { line: 1, rule: 'trivial-function', message: TRIVIAL_EXAMPLE_MESSAGE },
        ]);
    },
);

test.each([...TRIVIAL_FILES])('$name gets the findings $expected', async ({ language, file, source, expected }) => {
    const findings = await runTrivialFunctionsCheck(language, file, source);
    expect(findings.map(({ rule }) => rule)).toStrictEqual([...expected]);
});

test.each([...BASH_TRIVIAL_FUNCTION_CASES])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runCheckSample(bashSandbox(), entry, BASH_SANDBOX);
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(entry));
});
