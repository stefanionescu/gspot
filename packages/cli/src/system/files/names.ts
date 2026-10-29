import { GspotError } from '#cli/system/errors.ts';

import {
    DEVICE_NAME,
    UNSAFE_PATH_END,
    UNSAFE_CHARACTERS,
    RESERVED_SEGMENTS,
    UNSAFE_PATH_MESSAGE,
} from '#cli/config/system/files/names.ts';

/**
Split a path into segments, and refuse an empty, dot, parent, or null segment.

@param path a repository-relative file with forward slashes.
*/
export function splitSystemPath(path: string): string[] {
    const segments = path.split('/');
    const isUnsafe =
        process.platform === 'win32'
            ? !path
                  .split('/')
                  .every(
                      (segment) =>
                          !RESERVED_SEGMENTS.has(segment) &&
                          !UNSAFE_CHARACTERS.test(segment) &&
                          !UNSAFE_PATH_END.test(segment) &&
                          !DEVICE_NAME.test(segment),
                  )
            : segments.some((segment) => RESERVED_SEGMENTS.has(segment) || segment.includes('\0'));
    if (isUnsafe)
        throw new GspotError(
            'filesystem',
            UNSAFE_PATH_MESSAGE.replace('{path}', () => JSON.stringify(path)),
        );
    return segments;
}
