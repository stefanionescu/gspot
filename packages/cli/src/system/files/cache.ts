import { realpathSync } from 'node:fs';
import { type CacheKey, type ParseKey, type ReadCache, type CachedSourceFiles } from '#cli/types/system/files.ts';

/**
 * Return the value of a key for this run, and create it on the first call.
 *
 * @param reads the run cache.
 * @param key the key, whose function creates the value.
 * @returns the value from the cache, or the value that the producer builds on the first read.
 */
export function getCachedValue<Value extends object>(reads: ReadCache, key: CacheKey<Value>): Value {
    const held = reads.values.get(key);
    if (held !== undefined) return held as Value;
    const value = key.create();
    reads.values.set(key, value);
    return value;
}

/**
 * Reuse one calculated value in a map that the run owns.
 *
 * @param reads the run cache.
 * @param key the map producer.
 * @param id the key of the calculation.
 * @param create the calculation.
 * @returns the cached value, or its first calculated value.
 */
export function getCachedMapValue<Key, Value>(
    reads: ReadCache,
    key: CacheKey<Map<Key, Value>>,
    id: Key,
    create: () => Value,
): Value {
    const values = getCachedValue(reads, key);
    if (values.has(id)) return values.get(id) as Value;
    const value = create();
    values.set(id, value);
    return value;
}

/**
 * Create the cache of source bytes and derived values for one repository root.
 *
 * @param root the repository folder; the cache keeps its real path.
 * @returns the run cache.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 77 calls in 28 files share it.
export function createReadCache(root: string): ReadCache {
    return { root: realpathSync(root), sources: new Map(), values: new Map() };
}

/**
 * Parse the files once per reader key and ordered path list.
 *
 * @param sources the paths to parse and the run resources.
 * @param key the reader and its disposer.
 * @returns the parsed value for the lifetime of those resources.
 */
export async function parseCached<Sources extends CachedSourceFiles, Value extends object>(
    sources: Sources,
    key: ParseKey<Sources, Value>,
): Promise<Value> {
    const promises =
        (sources.reads.values.get(key) as Map<string, Promise<Value>> | undefined) ?? new Map<string, Promise<Value>>();
    sources.reads.values.set(key, promises);
    const paths = JSON.stringify(sources.files.map((file) => file.path));
    let pending = promises.get(paths);
    if (pending === undefined) {
        pending = key.read(sources);
        promises.set(paths, pending);
        try {
            const value = await pending;
            sources.resources.defer(() => {
                promises.delete(paths);
                key.dispose(value);
            });
        } catch (error) {
            promises.delete(paths);
            throw error;
        }
    }
    return pending;
}
