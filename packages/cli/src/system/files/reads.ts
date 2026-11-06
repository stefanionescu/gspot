import { isUtf8 } from 'node:buffer';
import { closeSync, lstatSync, openSync, readdirSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
    MISSING_TRACKED_FILE_MESSAGE,
    PATH_SEPARATORS,
    RESERVED_SEGMENTS,
    UNSAFE_PATH_MESSAGE,
} from '#cli/config/system.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { isInside } from '#cli/system/paths.ts';
import type { RunCache } from '#cli/types/system.ts';

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

function decodeCachedText(source: string | RunCache, path: string): string {
    const bytes = readBytes(source, path);
    if (typeof source === 'string') return decodeUtf8File(path, bytes);
    const held = source.texts.get(bytes);
    if (held !== undefined) return held;
    const text = decodeUtf8File(path, bytes);
    source.texts.set(bytes, text);
    return text;
}

/**
Read file bytes inside a folder, and refuse a link outside it. A run cache keeps the bytes of the first read.
*/
export function readBytes(source: string | RunCache, path: string, options?: { limit: number }): Buffer {
    if (typeof source === 'string') return readFileSync(readContainedPath(realpathSync(source), path));
    const held = source.sources.get(path);
    if (options !== undefined)
        return held?.subarray(0, options.limit) ?? readFilePrefix(readContainedPath(source.root, path), options.limit);
    if (held !== undefined) return held;
    const bytes = readFileSync(readContainedPath(source.root, path));
    source.sources.set(path, bytes);
    return bytes;
}

export function findText(source: string | RunCache, path: string): string | undefined {
    try {
        return decodeCachedText(source, path);
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
Read tracked UTF-8 text and refuse a missing file. A tracked link whose target is missing is present, and reads as
empty text, because Git tracks the link and not its target.
*/
export function readText(source: string | RunCache, path: string): string {
    const text = findText(source, path);
    if (text !== undefined) return text;
    const root = typeof source === 'string' ? source : source.root;
    if (lstatSync(join(root, path), { throwIfNoEntry: false })?.isSymbolicLink() === true) return '';
    throw new GspotError(
        'filesystem',
        MISSING_TRACKED_FILE_MESSAGE.replace('{path}', () => path),
    );
}

export function findContainedPath(root: string, path: string): string | undefined {
    const target = realpathSync.native(join(root, path));
    return isInside(relative(realpathSync.native(root), target)) ? target : undefined;
}

export function readContainedPath(root: string, path: string): string {
    const target = findContainedPath(root, join(...splitSystemPath(path)));
    if (target === undefined)
        throw new GspotError(
            'filesystem',
            `${path} links to a file outside the repository. Replace the link with the file.`,
        );
    return target;
}

export function decodeUtf8(bytes: Buffer): string | undefined {
    return isUtf8(bytes) ? bytes.toString('utf8') : undefined;
}

export function decodeUtf8File(path: string, bytes: Buffer): string {
    const text = decodeUtf8(bytes);
    if (text === undefined)
        throw new GspotError('filesystem', `${path} is not UTF-8 text. Save it as UTF-8, then run the command again.`);
    return text;
}

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

export function measureFolder(path: string): number {
    const listed = readdirSync(path, { recursive: true, withFileTypes: true });
    const files = listed.filter((file) => file.isFile());
    return files.reduce((total, file) => total + statSync(join(file.parentPath, file.name)).size, 0);
}
