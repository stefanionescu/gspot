import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { captureRejection } from '#tests/setup/matchers.ts';
import { parseCached, getCachedValue, createReadCache, getCachedMapValue } from '#cli/system/files/cache.ts';

test('cache keys retain their objects and maps calculate each cached once', async () => {
    await using sandbox = await testdir({});
    const reads = createReadCache(sandbox.path);
    let creations = 0;
    const key = {
        create: () => {
            creations += 1;
            return {};
        },
    };
    const first = getCachedValue(reads, key);
    expect(getCachedValue(reads, key)).toBe(first);
    expect(creations).toBe(1);
    let calculations = 0;
    const map = { create: () => new Map<string, object>() };
    const cached = getCachedMapValue(reads, map, 'same', () => {
        calculations += 1;
        return {};
    });
    expect(
        getCachedMapValue(reads, map, 'same', () => {
            calculations += 1;
            return {};
        }),
    ).toBe(cached);
    expect(calculations).toBe(1);
});

test('a rejected parse is retried and a successful parse is shared until disposal', async () => {
    await using sandbox = await testdir({});
    using resources = new DisposableStack();
    const sources = { reads: createReadCache(sandbox.path), resources, files: [{ path: 'source.ts' }] };
    const failure = new Error('Parsing failed.');
    const value = {};
    let readsCount = 0;
    const disposed: object[] = [];
    const key = {
        read: (): Promise<object> => {
            readsCount += 1;
            return readsCount === 1 ? Promise.reject(failure) : Promise.resolve(value);
        },
        dispose: (parsed: object): void => {
            disposed.push(parsed);
        },
    };
    expect(await captureRejection(parseCached(sources, key))).toBe(failure);
    expect(await parseCached(sources, key)).toBe(value);
    expect(await parseCached(sources, key)).toBe(value);
    expect(readsCount).toBe(2);
    expect(disposed).toStrictEqual([]);
    resources.dispose();
    expect(disposed).toStrictEqual([value]);
});
