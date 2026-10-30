import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { remember, createRunCache } from '#cli/system/cache.ts';

test('a remembered value is calculated once for each key and id', async () => {
    await using sandbox = await testdir({});
    const cache = createRunCache(sandbox.path);
    const key = Symbol('values');
    const calculated: string[] = [];
    const calculate = (id: string) => () => {
        calculated.push(id);
        return { id };
    };
    const first = remember(cache, key, 'first', calculate('first'));
    expect(remember(cache, key, 'first', calculate('first'))).toBe(first);
    expect(remember(cache, key, 'second', calculate('second'))).toStrictEqual({ id: 'second' });
    expect(remember(cache, Symbol('values'), 'first', calculate('first'))).not.toBe(first);
    expect(calculated).toStrictEqual(['first', 'second', 'first']);
});

test('a remembered undefined result is not calculated again', async () => {
    await using sandbox = await testdir({});
    const cache = createRunCache(sandbox.path);
    const key = Symbol('missing');
    const calculated: string[] = [];
    for (const id of ['path', 'path'])
        remember(cache, key, id, () => {
            calculated.push(id);
            return undefined;
        });
    expect(calculated).toStrictEqual(['path']);
});
