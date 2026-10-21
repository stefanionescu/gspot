// Checks system paths and portable generated file names.
import { GspotError } from '#cli/system/errors.ts';
import { STATE_FOLDER_PATTERN } from '#cli/config/system/locations.ts';
import { DEVICE_NAME, UNSAFE_PATH_END, RESERVED_SEGMENTS, UNSAFE_CHARACTERS } from '#cli/config/system/files.ts';

// Check whether one segment of a portable path means something different on a supported system.
function isUnsafeSegment(part: string): boolean {
    if (RESERVED_SEGMENTS.has(part)) return true;
    if (UNSAFE_CHARACTERS.test(part) || UNSAFE_PATH_END.test(part)) return true;
    return DEVICE_NAME.test(part);
}

/**
 * Reject path spellings that have different meanings on supported systems.
 *
 * @param path a repository-relative file with forward slashes.
 * @returns the segments of the path.
 */
function splitPortablePath(path: string): string[] {
    const parts = path.split('/');
    if (parts.some((part) => isUnsafeSegment(part)))
        throw new GspotError(
            'filesystem',
            `${JSON.stringify(path)} is not a safe repository-relative path. Choose a path inside the repository.`,
        );
    return parts;
}

/**
 * Split a path into segments, and refuse an empty, dot, parent, or null segment.
 *
 * @param path a repository-relative file with forward slashes.
 * @returns the segments of the path.
 */
export function splitSystemPath(path: string): string[] {
    if (process.platform === 'win32') return splitPortablePath(path);
    const parts = path.split('/');
    if (parts.some((part) => RESERVED_SEGMENTS.has(part) || part.includes('\0')))
        throw new GspotError(
            'filesystem',
            `${JSON.stringify(path)} is not a safe repository-relative path. Choose a path inside the repository.`,
        );
    return parts;
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
