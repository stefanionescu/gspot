import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { trivialFunctions } from '#cli/checks/general/structure/trivial-functions.ts';
import { CLEAN_SWIFT, ACCESSOR_DECLARATIONS } from '#tests/config/samples/swift/source.ts';

import {
    PROPERTY_READERS,
    TRIVIAL_FUNCTION_CASES,
} from '#tests/config/cli/checks/general/structure/trivial-functions.ts';

test('Swift reports constructors, accessors, decorated methods, nested functions, and leaves closures in place', async () => {
    const text = ACCESSOR_DECLARATIONS;
    await using sandbox = await testdir({
        'example.swift': text,
        'gspot.toml': buildPolicy(['swift'], { level: 'all', tables: '[limits.swift]\nmin_function_statements = 2\n' }),
    });
    const initial = await trivialFunctions(
        buildCheckInput(await openSession(sandbox.path), 'structure/trivial-functions'),
    );
    expect(
        initial.filter((problem) => problem.rule === 'trivial-function').map((problem) => problem.line),
    ).toStrictEqual([2, 4, 5, 7, 8]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['swift'], { level: 'all', tables: '[limits.swift]\nmin_function_statements = 3\n' }),
    );
    const increased = await trivialFunctions(
        buildCheckInput(await openSession(sandbox.path), 'structure/trivial-functions'),
    );
    expect(
        increased.filter((problem) => problem.rule === 'trivial-function').map((problem) => problem.line),
    ).toStrictEqual([2, 4, 5, 7, 8, 9]);
});

test('Swift includes implicit getters, property readers, and subscript accessors', async () => {
    const text = PROPERTY_READERS;
    await using sandbox = await testdir({
        'example.swift': text,
        'gspot.toml': buildPolicy(['swift'], { level: 'all', tables: '[limits.swift]\nmin_function_statements = 2\n' }),
    });
    const result = await trivialFunctions(
        buildCheckInput(await openSession(sandbox.path), 'structure/trivial-functions'),
    );
    expect(
        result.filter((problem) => problem.rule === 'trivial-function').map((problem) => problem.line),
    ).toStrictEqual([2, 4, 5, 8, 9]);
});

test.each([...TRIVIAL_FUNCTION_CASES])(
    'Swift $name reports the trivial function at line $line',
    async ({ source, line }) => {
        await using sandbox = await testdir({
            'Source.swift': source,
            'gspot.toml': buildPolicy(['swift'], {
                level: 'all',
                tables: '[limits.swift]\nmin_function_statements = 2\n',
            }),
        });
        const result = await trivialFunctions(
            buildCheckInput(await openSession(sandbox.path), 'structure/trivial-functions'),
        );
        expect(
            result
                .filter((problem) => problem.rule === 'trivial-function')
                .map((problem) => ({ line: problem.line, rule: problem.rule })),
        ).toStrictEqual([{ line, rule: 'trivial-function' }]);
    },
);

test('Swift source with substantial function bodies passes the trivial-function check', async () => {
    await using sandbox = await testdir({
        'Source.swift': CLEAN_SWIFT,
        'gspot.toml': buildPolicy(['swift'], { level: 'all', tables: '[limits.swift]\nmin_function_statements = 2\n' }),
    });
    expect(
        await trivialFunctions(buildCheckInput(await openSession(sandbox.path), 'structure/trivial-functions')),
    ).toStrictEqual([]);
});

test('Python counts nested control flow and reports decorated methods and leaves lambda expressions in place', async () => {
    const text =
        'class A:\n    @decorator\n    def method(self):\n        return 1\ndef outer():\n    def inner():\n        one()\n        two()\n        three()\n    return lambda x: x\ndef flow(x):\n    if x:\n        one()\n        two()\n';
    await using sandbox = await testdir({ 'example.py': text });
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['python'], { level: 'all', tables: '[limits.python]\nmin_function_statements = 2\n' }),
    );
    const initial = await trivialFunctions(
        buildCheckInput(await openSession(sandbox.path), 'structure/trivial-functions'),
    );
    expect(initial.filter((entry) => entry.rule === 'trivial-function').map((entry) => entry.line)).toStrictEqual([
        3, 5,
    ]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['python'], { level: 'all', tables: '[limits.python]\nmin_function_statements = 3\n' }),
    );
    const increased = await trivialFunctions(
        buildCheckInput(await openSession(sandbox.path), 'structure/trivial-functions'),
    );
    expect(increased.filter((entry) => entry.rule === 'trivial-function').map((entry) => entry.line)).toStrictEqual([
        3, 5, 6, 11,
    ]);
});
