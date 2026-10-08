import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { CLEAN_SWIFT, ACCESSOR_DECLARATIONS } from '#tests/config/samples/swift/source.ts';
import { trivialFunctions as swiftTrivial } from '#cli/checks/language/swift/functions.ts';
import { PROPERTY_READERS, TRIVIAL_FUNCTION_CASES } from '#tests/config/cli/checks/language/swift/functions.ts';

test('Swift reports constructors, accessors, decorated methods, nested functions, and leaves closures in place', async () => {
    const text = ACCESSOR_DECLARATIONS;
    await using sandbox = await testdir({
        'example.swift': text,
        'gspot.toml': buildPolicy(['swift'], { level: 'all', tables: '[limits.swift]\nmin_function_statements = 2\n' }),
    });
    const initial = await swiftTrivial(buildCheckInput(await openSession(sandbox.path), 'swift/trivial-functions'));
    expect(
        initial.filter((problem) => problem.rule === 'trivial-function').map((problem) => problem.line),
    ).toStrictEqual([2, 4, 5, 7, 8]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['swift'], { level: 'all', tables: '[limits.swift]\nmin_function_statements = 3\n' }),
    );
    const increased = await swiftTrivial(buildCheckInput(await openSession(sandbox.path), 'swift/trivial-functions'));
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
    const result = await swiftTrivial(buildCheckInput(await openSession(sandbox.path), 'swift/trivial-functions'));
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
        const result = await swiftTrivial(buildCheckInput(await openSession(sandbox.path), 'swift/trivial-functions'));
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
        await swiftTrivial(buildCheckInput(await openSession(sandbox.path), 'swift/trivial-functions')),
    ).toStrictEqual([]);
});
