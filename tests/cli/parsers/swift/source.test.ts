import { test, expect } from 'bun:test';
import { parseTestSource } from '#tests/harness/syntax.ts';
import { getSwiftFunctions } from '#cli/parsers/swift/public.ts';
import { ACCESSOR_DECLARATIONS } from '#tests/config/samples/swift/source.ts';

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
});
