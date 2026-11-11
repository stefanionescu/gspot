import { expect, test } from 'bun:test';

import { BASH_SANDBOX } from '#tests/config/configurations/general.ts';
import {
    ACCESSOR_DECLARATIONS,
    BASH_TRIVIAL_FUNCTION_SAMPLE,
    CALLER_CASES,
    NESTED_PYTHON_FUNCTIONS,
    PYTHON_INTERFACES,
    STATEMENT_COUNT_CASES,
    TRIVIAL_FILES,
    TRIVIAL_FUNCTION_CASES,
} from '#tests/config/configurations/structure/code.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('Swift reports constructors, accessors, decorated methods, and nested functions, and counts the statements of closures toward their function', async () => {
    await using initialSandbox = await createGitSandbox({
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
    await using increasedSandbox = await createGitSandbox({
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
        await using sandbox = await createGitSandbox({
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

test('Python counts the statements of nested functions, lambdas, and control flow, and skips decorated methods and lambdas in a dict', async () => {
    await using initialSandbox = await createGitSandbox({
        ['example.py']: NESTED_PYTHON_FUNCTIONS,
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: `[limits.python]\ntrivial_function_statements = ${String(2)}\n`,
        }),
    });
    const initial = await runSandboxCheck(initialSandbox.path, 'structure/trivial-functions');
    expect(initial).toStrictEqual([]);
    await using increasedSandbox = await createGitSandbox({
        ['example.py']: NESTED_PYTHON_FUNCTIONS,
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: `[limits.python]\ntrivial_function_statements = ${String(3)}\n`,
        }),
    });
    const increased = await runSandboxCheck(increasedSandbox.path, 'structure/trivial-functions');
    expect(increased.map(({ rule, line }) => ({ rule, line }))).toStrictEqual(
        [6, 11].map((line) => ({ rule: 'trivial-function', line })),
    );
});

test('Python reports protocol methods and stubs, and skips what carries a decorator', async () => {
    await using sandbox = await createGitSandbox({
        ['interfaces.py']: PYTHON_INTERFACES,
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            tables: `[limits.python]\ntrivial_function_statements = ${String(2)}\n`,
        }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/trivial-functions');
    expect(findings.map(({ rule, line }) => ({ rule, line }))).toStrictEqual(
        [5, 19, 25].map((line) => ({ rule: 'trivial-function', line })),
    );
});

test('a Python test file reports nothing, and a re-export __init__.py reports only without index-only', async () => {
    const settings = buildSandboxSettings(['python'], { level: 'all' });
    const files = {
        'tests/test_cart.py': 'def test_total():\n    assert total() == 1\n',
        'shop/__init__.py': 'from .cart import Cart\n',
    };
    await using reported = await createGitSandbox({ ...files, 'gspot.toml': settings });
    const findings = await runSandboxCheck(reported.path, 'structure/trivial-functions');
    expect(findings.map(({ file }) => file)).toStrictEqual(['shop/__init__.py']);
    await using kept = await createGitSandbox({
        ...files,
        'gspot.toml': `${settings}[structure]\nreexports = { value = "index-only", reason = "The library publishes its API here." }\n`,
    });
    expect(await runSandboxCheck(kept.path, 'structure/trivial-functions')).toStrictEqual([]);
});

test.each([...STATEMENT_COUNT_CASES])(
    '%s reports a function of two statements, not counting comments and docstrings',
    async (language, source) => {
        const extension = ({ python: 'py', bash: 'sh', swift: 'swift' } as const)[language];
        await using sandbox = await createGitSandbox({
            [`example.${extension}`]: source,
            'gspot.toml': buildSandboxSettings([language], {
                level: 'all',
                tables: `[limits.${language}]\ntrivial_function_statements = ${String(2)}\n`,
            }),
        });
        const findings = await runSandboxCheck(sandbox.path, 'structure/trivial-functions');
        expect(findings.map(({ line, rule }) => ({ line, rule }))).toStrictEqual([
            {
                line: 1,
                rule: 'trivial-function',
            },
        ]);
    },
);

test.each([...CALLER_CASES])(
    '$language reports a trivial function that one place calls, and keeps one that two places call',
    async ({ language, definition, source, single, shared }) => {
        const settings = buildSandboxSettings([language], { level: 'all' });
        await using reported = await createGitSandbox({ [definition]: source, ...single, 'gspot.toml': settings });
        const findings = await runSandboxCheck(reported.path, 'structure/trivial-functions');
        expect(findings.map(({ file, line }) => ({ file, line }))).toStrictEqual([{ file: definition, line: 1 }]);
        await using kept = await createGitSandbox({ [definition]: source, ...shared, 'gspot.toml': settings });
        expect(await runSandboxCheck(kept.path, 'structure/trivial-functions')).toStrictEqual([]);
    },
);

test.each([...TRIVIAL_FILES])('$name gets the findings $expected', async ({ language, file, source, expected }) => {
    await using sandbox = await createGitSandbox({
        [file]: source,
        'gspot.toml': buildSandboxSettings([language], {
            level: 'all',
            tables: `[limits.${language}]\ntrivial_function_statements = ${String(2)}\n`,
        }),
    });
    const findings = await runSandboxCheck(sandbox.path, 'structure/trivial-functions');
    expect(findings.map(({ rule }) => rule)).toStrictEqual([...expected]);
});

test('structure/trivial-functions reports trivial-function in scripts/tiny.sh and passes after the fix', async () => {
    const sample = { check: 'structure/trivial-functions', ...BASH_TRIVIAL_FUNCTION_SAMPLE };
    await using sandbox = await createSandbox(BASH_SANDBOX);
    await assertCheckSample(sandbox, sample, BASH_SANDBOX.cleanSource);
});
