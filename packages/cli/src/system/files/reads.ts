// Reads contained files, text, and bounded prefixes.
import { isUtf8 } from 'node:buffer';
import { join, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { openSync, readSync, closeSync, readFileSync, realpathSync } from 'node:fs';

// Use this run's resolved root when it belongs to the requested repository.
function realRoot(root: string, reads?: ReadCache): string {
    return reads?.root === root ? root : realpathSync(root);
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
    const source = readContainedPath(realRoot(root, reads), path);
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
    const bytes = readFileSync(readContainedPath(realRoot(root, reads), path));
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
 * Read a written source path while refusing links outside the root's real path.
 * @param root the resolved directory.
 * @param path the root-relative source.
 * @param partsOf the owner's path validation.
 * @returns the contained path.
 */
export function readContainedPath(root: string, path: string, partsOf = splitSystemPath): string {
    const target = realpathSync(join(root, ...partsOf(path)));
    if (!isInside(relative(root, target))) throw new Error(`Source link leaves the repository: ${path}`);
    return target;
}

/**
 * Decode UTF-8 bytes as text.
 *
 * @param bytes the bytes.
 *
 * @returns the text, or undefined when the bytes lack UTF-8 encoding.
 */
export function decodeUtf8(bytes: Uint8Array): string | undefined {
    return isUtf8(bytes) ? Buffer.from(bytes).toString('utf8') : undefined;
}
