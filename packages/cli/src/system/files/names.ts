// Checks system paths and portable generated file names.
import { GspotError } from '#cli/system/errors.ts';
import { STATE_FOLDER_PATTERN } from '#cli/config/gspot-folder.ts';
import { DEVICE_NAME, UNSAFE_PATH_END, UNSAFE_CHARACTERS, RESERVED_SEGMENTS } from '#cli/config/system/files/names.ts';

// Check whether one segment of a portable path means something different on a supported system.
function isUnsafeSegment(segment: string): boolean {
    if (RESERVED_SEGMENTS.has(segment)) return true;
    if (UNSAFE_CHARACTERS.test(segment) || UNSAFE_PATH_END.test(segment)) return true;
    return DEVICE_NAME.test(segment);
}

/**
 * Reject path spellings that have different meanings on supported systems.
 *
 * @param path a repository-relative file with forward slashes.
 * @returns the segments of the path.
 */
function splitPortablePath(path: string): string[] {
    const segments = path.split('/');
    if (segments.some((segment) => isUnsafeSegment(segment)))
        throw new GspotError(
            'filesystem',
            `${JSON.stringify(path)} is not a safe repository-relative path. Choose a path inside the repository.`,
        );
    return segments;
}

/**
 * Split a path into segments, and refuse an empty, dot, parent, or null segment.
 *
 * @param path a repository-relative file with forward slashes.
 * @returns the segments of the path.
 */
export function splitSystemPath(path: string): string[] {
    if (process.platform === 'win32') return splitPortablePath(path);
    const segments = path.split('/');
    if (segments.some((segment) => RESERVED_SEGMENTS.has(segment) || segment.includes('\0')))
        throw new GspotError(
            'filesystem',
            `${JSON.stringify(path)} is not a safe repository-relative path. Choose a path inside the repository.`,
        );
    return segments;
}

/**
 * Keep write plans outside the gspot state folder.
 *
 * @param path the proposed file.
 */
export function assertWritablePath(path: string): void {
    splitPortablePath(path);
    if (STATE_FOLDER_PATTERN.test(path.normalize('NFC')))
        throw new GspotError('filesystem', `${path} is inside .gspot/state. Choose a path outside it.`);
}
