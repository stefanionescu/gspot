// Reading the bytes of a repository file: a bounded prefix, its text, or the whole file a run may hold once.
import { decodeUtf8 } from '#cli/platform/text.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { ReadCache } from '#cli/types/platform/reads.ts';
import { openSync, readSync, closeSync, readFileSync } from 'node:fs';

/**
 * Reads a bounded prefix, closing the descriptor even when reading fails.
 * @param root the repository root.
 * @param path the root-relative file.
 * @param limit the maximum byte count.
 * @returns the bytes read.
 */
export function readPrefix(root: string, path: string, limit: number): Buffer {
    const buffer = Buffer.alloc(limit);
    using files = openRoot(root, 'native');
    const source: string = files.realPath(path);
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
 * Reads a file under root. Uses the run's cache only when the cache belongs to this root, so a scratch copy is always read from disk.
 * @param root the directory being read.
 * @param path the source path relative to that directory.
 * @param reads optional bytes cached for this repository and run.
 * @returns the file bytes.
 */
export function readSource(root: string, path: string, reads?: ReadCache): Buffer {
    const read = reads?.root === root ? reads.sources : undefined;
    const held = read?.get(path);
    if (held !== undefined) return held;
    using files = openRoot(root, 'native');
    const bytes = readFileSync(files.realPath(path));
    read?.set(path, bytes);
    return bytes;
}

/**
 * Read optional authored text, following links only within the repository.
 * @param root the repository root.
 * @param path the repository-relative file.
 * @param reads optional bytes cached for this repository and run.
 * @returns the text, or undefined when the file is absent.
 * @throws when the bytes are not UTF-8 text.
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
