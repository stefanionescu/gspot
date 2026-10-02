// Reading the bytes of a repository file: a bounded prefix, its text, or the whole file a run may hold once.
import { openRoot } from '#cli/platform/filesystem.ts';
import type { SourceReads } from '#cli/types/platform/platform.ts';
import { openSync, readSync, closeSync, readFileSync } from 'node:fs';

/**
 * Reads a bounded prefix, closing the descriptor even when reading fails.
 * @param root the repository root
 * @param path the root-relative file
 * @param bytes the maximum byte count
 * @returns the bytes read
 */
export function readPrefix(root: string, path: string, bytes: number): Buffer {
    const buffer = Buffer.alloc(bytes);
    using files = openRoot(root, 'native');
    const source: string = files.source(path);
    const descriptor = openSync(source, 'r');
    let offset = 0;
    try {
        while (offset < bytes) {
            const count = readSync(descriptor, buffer, { offset, length: bytes - offset, position: offset });
            if (count === 0) break;
            offset += count;
        }
        return buffer.subarray(0, offset);
    } finally {
        closeSync(descriptor);
    }
}

/**
 * Read required content, reusing source bytes only within the read repository.
 * @param root the directory being read
 * @param path the source path relative to that directory
 * @param reads optional run-owned bytes; isolated generated output remains fresh
 * @returns the file bytes
 */
export function readSource(root: string, path: string, reads?: SourceReads): Buffer {
    const read = reads?.root === root ? reads.sources : undefined;
    const held = read?.get(path);
    if (held !== undefined) return held;
    using files = openRoot(root, 'native');
    const bytes = readFileSync(files.source(path));
    read?.set(path, bytes);
    return bytes;
}
