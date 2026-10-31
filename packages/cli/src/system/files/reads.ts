import { isUtf8 } from 'node:buffer';
import { join, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import type { RunCache } from '#cli/types/system/system.ts';
import { PATH_SEPARATORS } from '#cli/config/system/system.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { openSync, readSync, closeSync, readFileSync, realpathSync } from 'node:fs';
import { RESERVED_SEGMENTS, UNSAFE_PATH_MESSAGE, MISSING_TRACKED_FILE_MESSAGE } from '#cli/config/system/files.ts';

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

/**
Read the first bytes of a file, with the resolved root of the run and any cached bytes.

@param cache the run cache.
@param path the root-relative file.
@param limit the maximum byte count.
@returns the bytes read.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Doctor and the repository read take a file prefix through the run cache and the link check of this module.
export function readCachedPrefix(cache: RunCache, path: string, limit: number): Buffer {
    const held = cache.sources.get(path);
    return held === undefined ? readFilePrefix(readContainedPath(cache.root, path), limit) : held.subarray(0, limit);
}

/**
Read file bytes inside a folder, and refuse a link outside it. A run cache keeps the bytes of the first read.

@param source the folder of the relative path, or the run cache of that folder.
@param path the root-relative file.
@returns the file bytes.
*/
export function readBytes(source: string | RunCache, path: string): Buffer {
    if (typeof source === 'string') return readFileSync(readContainedPath(realpathSync(source), path));
    const held = source.sources.get(path);
    if (held !== undefined) return held;
    const bytes = readFileSync(readContainedPath(source.root, path));
    source.sources.set(path, bytes);
    return bytes;
}

/**
Read UTF-8 text, or return undefined for a missing file.

@param source the folder of the relative path, or the run cache of that folder.
@param path the root-relative file.
@returns the file text.
*/
export function find(source: string | RunCache, path: string): string | undefined {
    try {
        return decodeUtf8Text(path, readBytes(source, path));
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
Read tracked UTF-8 text and refuse a missing file.

@param source the folder of the relative path, or the run cache of that folder.
@param path the tracked file path.
*/
export function read(source: string | RunCache, path: string): string {
    const text = find(source, path);
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers decode UTF-8 bytes, or get undefined, through this one test.
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

/**
Split a path into segments, and refuse an empty, dot, parent, or null segment. Windows also splits at a backslash.

@param path a repository-relative file with forward slashes.
*/
export function splitSystemPath(path: string): string[] {
    const segments = path.split('/');
    const systemSegments = process.platform === 'win32' ? path.split(PATH_SEPARATORS) : segments;
    if (systemSegments.some((segment) => RESERVED_SEGMENTS.has(segment) || segment.includes('\0')))
        throw new GspotError(
            'filesystem',
            UNSAFE_PATH_MESSAGE.replace('{path}', () => JSON.stringify(path)),
        );
    return segments;
}
