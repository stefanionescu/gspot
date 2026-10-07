import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { getSwiftFunctions } from '#cli/parsers/swift.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { parseTestSource } from '#tests/harness/syntax.ts';
import { CLEAN_SWIFT } from '#tests/config/samples/swift.ts';
import { trivialFunctions as swiftTrivial } from '#cli/checks/language/swift/functions.ts';

import {
    PROPERTY_READERS,
    ACCESSOR_DECLARATIONS,
    TRIVIAL_FUNCTION_CASES,
} from '#tests/config/cli/checks/language/swift/bodies.ts';

test('Swift reports constructors, accessors, decorated methods, nested functions, and leaves closures in place', async () => {
    const text = ACCESSOR_DECLARATIONS;
    using tree = await parseTestSource('swift', text);

    const functions = getSwiftFunctions({ path: 'example.swift', text, lines: text.split('\n'), tree });
    expect(functions.map(({ name }) => name)).toStrictEqual([
        'init',
        'getter of value',
        'setter of value',
        'method',
        'outer',
        'inner',
        'closure',
    ]);
    await using sandbox = await testdir({
        'example.swift': text,
        'gspot.toml': buildPolicy(['swift'], { level: 'all', tables: '[limits.swift]\nmin_function_statements = 2\n' }),
    });
    const initial = await swiftTrivial(buildEngineInput(await openSession(sandbox.path), 'swift/trivial-functions'));
    expect(
        initial.filter((problem) => problem.rule === 'trivial-function').map((problem) => problem.line),
    ).toStrictEqual([2, 4, 5, 7, 8]);
    await Bun.write(
        `${sandbox.path}/gspot.toml`,
        buildPolicy(['swift'], { level: 'all', tables: '[limits.swift]\nmin_function_statements = 3\n' }),
    );
    const increased = await swiftTrivial(buildEngineInput(await openSession(sandbox.path), 'swift/trivial-functions'));
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
    const result = await swiftTrivial(buildEngineInput(await openSession(sandbox.path), 'swift/trivial-functions'));
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
        const result = await swiftTrivial(buildEngineInput(await openSession(sandbox.path), 'swift/trivial-functions'));
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
        await swiftTrivial(buildEngineInput(await openSession(sandbox.path), 'swift/trivial-functions')),
    ).toStrictEqual([]);
});
