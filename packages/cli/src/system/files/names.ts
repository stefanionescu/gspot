import { GspotError } from '#cli/system/errors.ts';
import { STATE_FOLDER_PATTERN } from '#cli/config/gspot-folder.ts';

import {
    DEVICE_NAME,
    UNSAFE_PATH_END,
    UNSAFE_CHARACTERS,
    RESERVED_SEGMENTS,
    UNSAFE_PATH_MESSAGE,
} from '#cli/config/system/files/names.ts';

function splitPortablePath(path: string): string[] {
    const segments = path.split('/');
    if (
        segments.some(
            (segment) =>
                RESERVED_SEGMENTS.has(segment) ||
                UNSAFE_CHARACTERS.test(segment) ||
                UNSAFE_PATH_END.test(segment) ||
                DEVICE_NAME.test(segment),
        )
    )
        throw new GspotError(
            'filesystem',
            UNSAFE_PATH_MESSAGE.replace('{path}', () => JSON.stringify(path)),
        );
    return segments;
}

/**
Split a path into segments, and refuse an empty, dot, parent, or null segment.

@param path a repository-relative file with forward slashes.
@returns the segments of the path.
*/
export function splitSystemPath(path: string): string[] {
    if (process.platform === 'win32') return splitPortablePath(path);
    const segments = path.split('/');
    if (segments.some((segment) => RESERVED_SEGMENTS.has(segment) || segment.includes('\0')))
        throw new GspotError(
            'filesystem',
            UNSAFE_PATH_MESSAGE.replace('{path}', () => JSON.stringify(path)),
        );
    return segments;
}

/**
Keep write plans outside the gspot state folder.

@param path the proposed file.
*/
export function assertWritablePath(path: string): void {
    splitPortablePath(path);
    if (STATE_FOLDER_PATTERN.test(path.normalize('NFC')))
        throw new GspotError('filesystem', `${path} is inside .gspot/state. Choose a path outside it.`);
}
