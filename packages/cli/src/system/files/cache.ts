// Caches source bytes and computed values for one run.

import { realpathSync } from 'node:fs';
import type { SourceInput } from '#cli/types/parsers/tree-sitter.ts';
import type { MemoKey, ReadCache } from '#cli/types/system/files.ts';

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
    return { root: realpathSync(root), sources: new Map(), memo: new Map(), parsed: new Map() };
}

/**
 * Parse selected files once per run and release them with the run.
 * @param input the selected paths and source reads.
 * @param read the source parser.
 * @param dispose the operation that releases the parsed values.
 * @param resources the resources released at the end of the run.
 * @returns the parsed value, valid until disposing of the cleanup stack.
 */
export async function visitParsed<Value, Input extends SourceInput>(
    input: Input,
    read: (input: Input) => Promise<Value>,
    dispose: (value: Value) => void,
    resources: DisposableStack,
): Promise<Value> {
    const key = JSON.stringify([read.name, input.root, input.files.map((file) => file.path)]);
    let pending = input.reads.parsed.get(key);
    if (pending === undefined) {
        pending = read(input);
        input.reads.parsed.set(key, pending);
        try {
            // Each reader's name identifies its cached return type.
            const value = (await pending) as Value;
            resources.defer(() => {
                input.reads.parsed.delete(key);
                dispose(value);
            });
        } catch (error) {
            input.reads.parsed.delete(key);
            throw error;
        }
    }
    return (await pending) as Value;
}
