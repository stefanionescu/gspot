import { GspotError } from '#cli/system/errors.ts';
import { PATH_SEPARATORS } from '#cli/config/system/processes.ts';
import { RESERVED_SEGMENTS, UNSAFE_PATH_MESSAGE } from '#cli/config/system/files/names.ts';

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
