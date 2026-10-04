// Lazily initialized values share the lifetime of their execution read cache.
import type { MemoKey, ReadCache } from '#cli/types/platform/reads.ts';

/**
 * Reuse one value produced by a stable key during this run.
 * @param reads the run-owned source and derived-value cache
 * @param key the producer whose identity and return type own the entry
 * @returns the existing value or the producer's first result
 */
export function memo<Value extends object>(reads: ReadCache, key: MemoKey<Value>): Value {
    const held = reads.memo.get(key);
    // Only this key's producer writes its entry; its return type owns the stored value.
    if (held !== undefined) return held as Value;
    const value = key.create();
    reads.memo.set(key, value);
    return value;
}
