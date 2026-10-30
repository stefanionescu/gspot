import { realpathSync } from 'node:fs';
import { type RunCache } from '#cli/types/system/system.ts';

/**
Calculate a value once for each key and id in a run cache. A rejected promise stays, so later calls share its failure.

@param cache the run cache.
@param key the symbol of the calculation.
@param id what the value depends on, compared as a Map key.
@param compute the calculation, called on the first request.
@returns the value of the first call.
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

/**
Create the cache of source bytes and derived values for one repository root.

@param root the repository folder; the cache keeps its real path.
@returns empty source and value maps, keyed to the real root.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers and the tests open the run cache through it, with the real root that contained reads compare against.
export function createRunCache(root: string): RunCache {
    return { root: realpathSync(root), sources: new Map(), values: new Map() };
}
