import { realpathSync } from 'node:fs';
import type { RunCache } from '#cli/types/system.ts';

/**
Calculate a value once for each key and id in a run cache. A rejected promise stays, so later calls share its failure.
*/
export function remember<Value>(cache: RunCache, key: symbol, id: unknown, compute: () => Value): Value {
    let values = cache.values.get(key);
    if (values === undefined) {
        values = new Map();
        cache.values.set(key, values);
    }
    if (!values.has(id)) values.set(id, compute());
    return values.get(id) as Value;
}

export function createRunCache(root: string): RunCache {
    return { root: realpathSync(root), sources: new Map(), texts: new WeakMap(), values: new Map() };
}
