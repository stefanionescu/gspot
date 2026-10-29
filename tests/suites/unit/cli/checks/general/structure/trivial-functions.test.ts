import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { BASH_SANDBOX } from '#tests/config/setup/sandboxes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    TRIVIAL_FILES,
    PYTHON_INTERFACES,
    ACCESSOR_DECLARATIONS,
    STATEMENT_COUNT_CASES,
    TRIVIAL_FUNCTION_CASES,
    NESTED_PYTHON_FUNCTIONS,
    BASH_TRIVIAL_FUNCTION_CASES,
} from '#tests/config/checks/general/structure/trivial-functions.ts';

test('Swift reports constructors, accessors, decorated methods, and nested functions, and counts the statements of closures toward their function', async () => {
    await using initialSandbox = await testdir({
        ['example.swift']: ACCESSOR_DECLARATIONS,
        'gspot.toml': buildSandboxSettings(['swift'], {
            level: 'all',
            tables: `[limits.swift]\ntrivial_function_statements = ${String(2)}\n`,
        }),
    });
    const initial = await runSandboxCheck(initialSandbox.path, 'structure/trivial-functions');
    expect(initial.map(({ rule, line }) => ({ rule, line }))).toStrictEqual(
        [2, 4, 5, 7].map((line) => ({ rule: 'trivial-function', line })),
    );
    await using increasedSandbox = await testdir({
        ['example.swift']: ACCESSOR_DECLARATIONS,
        'gspot.toml': buildSandboxSettings(['swift'], {
            level: 'all',
            tables: `[limits.swift]\ntrivial_function_statements = ${String(3)}\n`,
        }),
    });
    const increased = await runSandboxCheck(increasedSandbox.path, 'structure/trivial-functions');
    expect(increased.map(({ rule, line }) => ({ rule, line }))).toStrictEqual(
        [2, 4, 5, 7, 9].map((line) => ({ rule: 'trivial-function', line })),
    );
});

test.each([...TRIVIAL_FUNCTION_CASES])(
    'Swift $name reports the trivial functions at lines $lines',
    async ({ source, lines }) => {
        await using sandbox = await testdir({
            ['Source.swift']: source,
            'gspot.toml': buildSandboxSettings(['swift'], {
                level: 'all',
                tables: `[limits.swift]\ntrivial_function_statements = ${String(2)}\n`,
            }),
        });
        const result = await runSandboxCheck(sandbox.path, 'structure/trivial-functions');
        expect(result.map((finding) => ({ line: finding.line, rule: finding.rule }))).toStrictEqual(
            lines.map((line) => ({ line, rule: 'trivial-function' })),
        );
    },
);

test('Python counts the statements of nested functions, lambdas, and control flow, and reports decorated methods', async () => {
    await using initialSandbox = await testdir({
        ['example.py']: NESTED_PYTHON_FUNCTIONS,
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: `[limits.python]\ntrivial_function_statements = ${String(2)}\n`,
        }),
    });
    const initial = await runSandboxCheck(initialSandbox.path, 'structure/trivial-functions');
    expect(initial.map(({ rule, line }) => ({ rule, line }))).toStrictEqual([{ rule: 'trivial-function', line: 3 }]);
    await using increasedSandbox = await testdir({
        ['example.py']: NESTED_PYTHON_FUNCTIONS,
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: `[limits.python]\ntrivial_function_statements = ${String(3)}\n`,
        }),
    });
    const increased = await runSandboxCheck(increasedSandbox.path, 'structure/trivial-functions');
    expect(increased.map(({ rule, line }) => ({ rule, line }))).toStrictEqual(
        [3, 6, 11].map((line) => ({ rule: 'trivial-function', line })),
    );
});

test('Python reports overloads, abstract and protocol methods, properties, setters, and stubs', async () => {
    await using sandbox = await testdir({
        ['interfaces.py']: PYTHON_INTERFACES,
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: `[limits.python]\ntrivial_function_statements = ${String(2)}\n`,
        }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/trivial-functions');
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
        await using sandbox = await testdir({
            [`example.${extension}`]: source,
            'gspot.toml': buildSandboxSettings([language], {
                level: 'all',
                tables: `[limits.${language}]\ntrivial_function_statements = ${String(2)}\n`,
            }),
        });
        const findings = await runSandboxCheck(sandbox.path, 'structure/trivial-functions');
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
    await using sandbox = await testdir({
        [file]: source,
        'gspot.toml': buildSandboxSettings([language], {
            level: 'all',
            tables: `[limits.${language}]\ntrivial_function_statements = ${String(2)}\n`,
        }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/trivial-functions');
    expect(findings.map(({ rule }) => rule)).toStrictEqual([...expected]);
});

test.each([...BASH_TRIVIAL_FUNCTION_CASES])(
    'structure/trivial-functions reports $expected.rule in $expected.file and passes after the fix',
    async (row) => {
        const sample = { check: 'structure/trivial-functions', ...row };
        await using sandbox = await createSandbox(BASH_SANDBOX);
        await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
    },
);
