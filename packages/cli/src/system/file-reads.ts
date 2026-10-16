// Reads repository files and caches calculations for one run.
// Lazily initialized values share the lifetime of their execution read cache.
import { decodeUtf8 } from '#cli/text.ts';
import { sourcePath } from '#cli/system/safe-folder/reads.ts';
import type { MemoKey, ReadCache } from '#cli/types/system/files.ts';
import { openSync, readSync, closeSync, readFileSync, realpathSync } from 'node:fs';

// Use this run's resolved root when it belongs to the requested repository.
function realRoot(root: string, reads?: ReadCache): string {
    return reads?.root === root ? root : realpathSync(root);
}
/**
 * Reuse one value produced by a stable key during this run.
 * @param reads the run-owned source and derived-value cache.
 * @param key the producer whose identity and return type own the entry.
 * @returns the existing value or the producer's first result.
 */
export function memo<Value extends object>(reads: ReadCache, key: MemoKey<Value>): Value {
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
export function memoized<Key, Value>(
    reads: ReadCache,
    key: MemoKey<Map<Key, Value>>,
    entry: Key,
    create: () => Value,
): Value {
    const values = memo(reads, key);
    if (values.has(entry)) return values.get(entry) as Value;
    const value = create();
    values.set(entry, value);
    return value;
}

/**
 * Reads a bounded prefix, closing the descriptor even when reading fails.
 * @param root the repository root.
 * @param path the root-relative file.
 * @param limit the maximum byte count.
 * @param reads the resolved root for this session.
 * @returns the bytes read.
 */
export function readPrefix(root: string, path: string, limit: number, reads?: ReadCache): Buffer {
    const buffer = Buffer.alloc(limit);
    const source = sourcePath(realRoot(root, reads), path);
    const descriptor = openSync(source, 'r');
    let offset = 0;
    try {
        while (offset < limit) {
            const count = readSync(descriptor, buffer, { offset, length: limit - offset, position: offset });
            if (count === 0) break;
            offset += count;
        }
        return buffer.subarray(0, offset);
    } finally {
        closeSync(descriptor);
    }
}

/**
 * Reads a file under root. Uses the run's cache only when the cache belongs to this root, so scratch copies always come from disk.
 * @param root the directory to read.
 * @param path the source path relative to that directory.
 * @param reads optional bytes cached for this repository and run.
 * @returns the file bytes.
 */
export function readSource(root: string, path: string, reads?: ReadCache): Buffer {
    const read = reads?.root === root ? reads.sources : undefined;
    const held = read?.get(path);
    if (held !== undefined) return held;
    const bytes = readFileSync(sourcePath(realRoot(root, reads), path));
    read?.set(path, bytes);
    return bytes;
}

/**
 * Read text when the file exists, following links only within the repository.
 * @param root the repository root.
 * @param path the repository-relative file.
 * @param reads optional bytes cached for this repository and run.
 * @returns the text, or undefined when the file does not exist.
 * @throws for bytes outside Unicode UTF-8 text.
 */
export function readText(root: string, path: string, reads?: ReadCache): string | undefined {
    try {
        const text = decodeUtf8(readSource(root, path, reads));
        if (text === undefined) throw new Error(`${path} is not UTF-8 text.`);
        return text;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Give source bytes and derived values to one repository root.
 * @param root the repository directory.
 * @returns the session-owned read cache.
 */
export function createReadCache(root: string): ReadCache {
    return { root: realpathSync(root), sources: new Map(), memo: new Map(), parsed: new Map() };
}
