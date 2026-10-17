// Reads contained files, text, and bounded prefixes.
import { isUtf8 } from 'node:buffer';
import { join, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { openSync, readSync, closeSync, readFileSync, realpathSync } from 'node:fs';

// Close the descriptor even when a bounded read fails.
function readFilePrefix(source: string, limit: number): Buffer {
    const buffer = Buffer.alloc(limit);
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

// Decode both direct and cached reads through the same missing-file and encoding boundary.
function readUtf8(path: string, read: () => Buffer): string | undefined {
    try {
        const text = decodeUtf8(read());
        if (text === undefined) throw new Error(`${path} is not UTF-8 text.`);
        return text;
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
    }
}

/**
 * Read the first bytes of a file, with the resolved root of the run and any cached bytes.
 * @param reads the run cache.
 * @param path the root-relative file.
 * @param limit the maximum byte count.
 * @returns the bytes read.
 */
function readCachedPrefix(reads: ReadCache, path: string, limit: number): Buffer {
    const held = reads.sources.get(path);
    return held === undefined ? readFilePrefix(readContainedPath(reads.root, path), limit) : held.subarray(0, limit);
}

/**
 * Read file bytes from disk inside the folder.
 * @param sourceFolder the boundary for resolving the relative file path.
 * @param path the root-relative file.
 * @returns the file bytes.
 */
function readBytes(sourceFolder: string, path: string): Buffer {
    return readFileSync(readContainedPath(realpathSync(sourceFolder), path));
}

/**
 * Read file bytes once per run.
 * @param reads the run cache.
 * @param path the root-relative file.
 * @returns the first bytes read during this run.
 */
function readCachedBytes(reads: ReadCache, path: string): Buffer {
    const held = reads.sources.get(path);
    if (held !== undefined) return held;
    const bytes = readFileSync(readContainedPath(reads.root, path));
    reads.sources.set(path, bytes);
    return bytes;
}

/**
 * Read UTF-8 text from disk, or return undefined for a missing file.
 * @param sourceFolder the boundary for resolving the relative file path.
 * @param path the root-relative file.
 * @returns the file text.
 */
function readText(sourceFolder: string, path: string): string | undefined {
    return readUtf8(path, () => readBytes(sourceFolder, path));
}

/**
 * Read UTF-8 text through the run cache, or return undefined for a missing file.
 * @param reads the run cache.
 * @param path the root-relative file.
 * @returns the cached file text.
 */
function readCachedText(reads: ReadCache, path: string): string | undefined {
    return readUtf8(path, () => readCachedBytes(reads, path));
}

/**
 * Resolve a source path, and refuse links outside the root.
 * @param sourceFolder the canonical folder for checking symbolic link destinations.
 * @param path the root-relative file.
 * @returns the resolved file location after the boundary check.
 */
function readContainedPath(sourceFolder: string, path: string): string {
    const target = realpathSync(join(sourceFolder, ...splitSystemPath(path)));
    if (!isInside(relative(sourceFolder, target))) throw new Error(`Source link leaves the repository: ${path}`);
    return target;
}

/**
 * Decode UTF-8 bytes as text.
 * @param bytes the source buffer to validate before decoding.
 * @returns the text, or undefined for invalid UTF-8.
 */
function decodeUtf8(bytes: Uint8Array): string | undefined {
    return isUtf8(bytes) ? Buffer.from(bytes).toString('utf8') : undefined;
}

export { readText, readBytes, decodeUtf8, readCachedText, readCachedBytes, readCachedPrefix, readContainedPath };
