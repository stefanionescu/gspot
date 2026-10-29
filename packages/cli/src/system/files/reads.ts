import { isUtf8 } from 'node:buffer';
import { join, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { MISSING_TRACKED_FILE_MESSAGE } from '#cli/config/system/files/reads.ts';
import { openSync, readSync, closeSync, readFileSync, realpathSync } from 'node:fs';

function readFilePrefix(path: string, limit: number): Buffer {
    const buffer = Buffer.alloc(limit);
    const descriptor = openSync(path, 'r');
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

function readUtf8(path: string, read: () => Buffer): string | undefined {
    try {
        return decodeUtf8Text(path, read());
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
        if (hasErrorCode(error, 'EACCES') || hasErrorCode(error, 'EPERM') || hasErrorCode(error, 'EISDIR'))
            throw new GspotError('filesystem', `${path} could not be read. Check the file and its permissions.`, {
                cause: error,
            });
        throw error;
    }
}

/**
Read the first bytes of a file, with the resolved root of the run and any cached bytes.

@param reads the run cache.
@param path the root-relative file.
@param limit the maximum byte count.
@returns the bytes read.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 3 files share it.
export function readCachedPrefix(reads: ReadCache, path: string, limit: number): Buffer {
    const held = reads.sources.get(path);
    return held === undefined ? readFilePrefix(readContainedPath(reads.root, path), limit) : held.subarray(0, limit);
}

/**
Read file bytes from disk inside the folder.

@param root the boundary for resolving the relative file path.
@param path the root-relative file.
@returns the file bytes.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 15 calls in 8 files share it.
export function readBytes(root: string, path: string): Buffer {
    return readFileSync(readContainedPath(realpathSync(root), path));
}

/**
Read file bytes once per run.

@param reads the run cache.
@param path the root-relative file.
*/
export function readCachedBytes(reads: ReadCache, path: string): Buffer {
    const held = reads.sources.get(path);
    if (held !== undefined) return held;
    const bytes = readFileSync(readContainedPath(reads.root, path));
    reads.sources.set(path, bytes);
    return bytes;
}

/**
Read UTF-8 text from disk, or return undefined for a missing file.

@param root the boundary for resolving the relative file path.
@param path the root-relative file.
@returns the file text.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 18 calls in 12 files share it.
export function findText(root: string, path: string): string | undefined {
    return readUtf8(path, () => readBytes(root, path));
}

/**
Read UTF-8 text through the run cache, or return undefined for a missing file.

@param reads the run cache.
@param path the root-relative file.
@returns the cached file text.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 22 calls in 19 files share it.
export function findCachedText(reads: ReadCache, path: string): string | undefined {
    return readUtf8(path, () => readCachedBytes(reads, path));
}

/**
Read tracked UTF-8 text and refuse a missing file.

@param root the repository folder.
@param path the tracked file path.
*/
export function readText(root: string, path: string): string {
    const text = findText(root, path);
    if (text === undefined)
        throw new GspotError(
            'filesystem',
            MISSING_TRACKED_FILE_MESSAGE.replace('{path}', () => path),
        );
    return text;
}

/**
Read tracked UTF-8 text through the run cache and refuse a missing file.

@param reads the run cache.
@param path the tracked file path.
*/
export function readCachedText(reads: ReadCache, path: string): string {
    const text = findCachedText(reads, path);
    if (text === undefined)
        throw new GspotError(
            'filesystem',
            MISSING_TRACKED_FILE_MESSAGE.replace('{path}', () => path),
        );
    return text;
}

/**
Resolve a source path, and refuse links outside the root.

@param root the real path of the repository folder.
@param path the root-relative file.
@returns the real path of the file.
*/
export function readContainedPath(root: string, path: string): string {
    const target = realpathSync(join(root, ...splitSystemPath(path)));
    if (!isInside(relative(root, target)))
        throw new GspotError(
            'filesystem',
            `${path} links to a file outside the repository. Replace the link with the file.`,
        );
    return target;
}

/**
Decode UTF-8 bytes as text.

@param bytes the source buffer to validate before decoding.
@returns the text, or undefined for invalid UTF-8.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 5 calls in 5 files share it.
export function decodeUtf8(bytes: Uint8Array): string | undefined {
    return isUtf8(bytes) ? Buffer.from(bytes).toString('utf8') : undefined;
}

/**
Decode a user file, or tell the user how to fix its encoding.

@param path the file to name in an encoding error.
@param bytes the file contents to decode.
*/
export function decodeUtf8Text(path: string, bytes: Buffer): string {
    const text = decodeUtf8(bytes);
    if (text === undefined)
        throw new GspotError('filesystem', `${path} is not UTF-8 text. Save it as UTF-8, then run the command again.`);
    return text;
}
