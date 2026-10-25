import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareBashSandbox } from '#tests/setup/sandboxes/create.ts';
import { runCheckSample, buildExpectedSummary } from '#tests/setup/cli/samples.ts';

import {
    TRIVIAL_FILES,
    PYTHON_INTERFACES,
    ACCESSOR_DECLARATIONS,
    STATEMENT_COUNT_CASES,
    TRIVIAL_FUNCTION_CASES,
    NESTED_PYTHON_FUNCTIONS,
    BASH_TRIVIAL_FUNCTION_CASES,
} from '#tests/config/checks/general/structure/trivial-functions.ts';

const bashSandbox = shareBashSandbox();

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 8 calls in 1 file share it.
async function runTrivialFunctionsCheck(
    language: 'python' | 'bash' | 'swift',
    file: string,
    source: string,
    statements = 2,
): Promise<readonly Finding[]> {
    await using sandbox = await testdir({
        [file]: source,
        'gspot.toml': buildSandboxSettings([language], {
            level: 'all',
            tables: `[limits.${language}]\ntrivial_function_statements = ${String(statements)}\n`,
        }),
    });
    return await runSandboxCheck(sandbox.path, 'structure/trivial-functions');
}

test('Swift reports constructors, accessors, decorated methods, and nested functions, and counts the statements of closures toward their function', async () => {
    const initial = await runTrivialFunctionsCheck('swift', 'example.swift', ACCESSOR_DECLARATIONS);
    expect(initial.map(({ rule, line }) => ({ rule, line }))).toStrictEqual(
        [2, 4, 5, 7].map((line) => ({ rule: 'trivial-function', line })),
    );
    const increased = await runTrivialFunctionsCheck('swift', 'example.swift', ACCESSOR_DECLARATIONS, 3);
    expect(increased.map(({ rule, line }) => ({ rule, line }))).toStrictEqual(
        [2, 4, 5, 7, 9].map((line) => ({ rule: 'trivial-function', line })),
    );
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
    const initial = await runTrivialFunctionsCheck('python', 'example.py', NESTED_PYTHON_FUNCTIONS);
    expect(initial.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([{ rule: 'trivial-function', line: 3 }]);
    const increased = await runTrivialFunctionsCheck('python', 'example.py', NESTED_PYTHON_FUNCTIONS, 3);
    expect(increased.map(({ rule, line }) => ({ rule, line }))).toStrictEqual(
        [3, 6, 11].map((line) => ({ rule: 'trivial-function', line })),
    );
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
            {
                line: 1,
                rule: 'trivial-function',
                message:
                    'example has 2 statements. Functions with 2 or fewer are reported. Inline it into its callers, or record the API it serves with gspot ignore.',
            },
        ]);
    },
);

test.each([...TRIVIAL_FILES])('$name gets the findings $expected', async ({ language, file, source, expected }) => {
    const findings = await runTrivialFunctionsCheck(language, file, source);
    expect(findings.map(({ rule }) => rule)).toStrictEqual([...expected]);
});

test.each([...BASH_TRIVIAL_FUNCTION_CASES])(
    'structure/trivial-functions reports $expected.rule in $expected.file and passes after the fix',
    async (row) => {
        const sample = { check: 'structure/trivial-functions', ...row };
        expect(await runCheckSample(bashSandbox(), sample, BASH_SANDBOX.cleanSource)).toStrictEqual(
            buildExpectedSummary(sample),
        );
    },
);
