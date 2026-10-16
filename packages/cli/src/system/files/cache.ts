// Caches source bytes and computed values for one run.
import { realpathSync } from 'node:fs';
import { type MemoKey, type ParseKey, type ReadCache, type CachedParseInput } from '#cli/types/system/files.ts';

/**
 * Reuse one value produced by a stable key during this run.
 * @param reads the run-owned source and derived-value cache.
 * @param key the producer whose identity and return type own the entry.
 * @returns the existing value or the producer's first result.
 */
export function getCachedValue<Value extends object>(reads: ReadCache, key: MemoKey<Value>): Value {
    const held = reads.memo.get(key);
    // Only this key's producer writes its entry; its return type owns the stored value.
    if (held !== undefined) return held as Value;
    const value = key.create();
    reads.memo.set(key, value);
    return value;
}

/**
 * Reuse one calculated entry within a run-owned map.
 * @param reads the current run's read cache.
 * @param key the map producer.
 * @param entry the calculation's key.
 * @param create the calculation.
 * @returns the existing entry or its first calculated value.
 */
export function getCachedMapValue<Key, Value>(
    reads: ReadCache,
    key: MemoKey<Map<Key, Value>>,
    entry: Key,
    create: () => Value,
): Value {
    const values = getCachedValue(reads, key);
    if (values.has(entry)) return values.get(entry) as Value;
    const value = create();
    values.set(entry, value);
    return value;
}

/**
 * Give source bytes and derived values to one repository root.
 * @param root the repository directory.
 * @returns the session-owned read cache.
 */
export function createReadCache(root: string): ReadCache {
    return { root: realpathSync(root), sources: new Map(), memo: new Map() };
}

/**
 * Parse selected files once per stable reader key and ordered path list.
 * @param input the selected paths, run cache, and cleanup stack.
 * @param key the reader and its disposer.
 * @returns the parsed value for the lifetime of the input resources.
 */
export async function parseCached<Input extends CachedParseInput, Value extends object>(
    input: Input,
    key: ParseKey<Input, Value>,
): Promise<Value> {
    // This stable key owns both the reader's result type and its per-path-list entries.
    let entries = input.reads.memo.get(key) as Map<string, Promise<Value>> | undefined;
    if (entries === undefined) {
        entries = new Map();
        input.reads.memo.set(key, entries);
    }
    const paths = JSON.stringify(input.files.map((file) => file.path));
    let pending = entries.get(paths);
    if (pending === undefined) {
        pending = key.read(input);
        entries.set(paths, pending);
        try {
            const value = await pending;
            const values = entries;
            input.resources.defer(() => {
                values.delete(paths);
                key.dispose(value);
            });
        } catch (error) {
            entries.delete(paths);
            throw error;
        }
    }
    return pending;
}
