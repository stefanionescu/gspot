// Checks system paths and portable generated file names.
import { STATE_FOLDER_PATTERN } from '#cli/config/system/locations.ts';
import { DEVICE_NAME, UNSAFE_PATH_END, RESERVED_SEGMENTS, UNSAFE_CHARACTERS } from '#cli/config/system/files.ts';

// Whether one segment of a portable path means something different on a supported operating system.
function isUnsafeSegment(part: string): boolean {
    if (RESERVED_SEGMENTS.has(part)) return true;
    if (UNSAFE_CHARACTERS.test(part) || UNSAFE_PATH_END.test(part)) return true;
    return DEVICE_NAME.test(part);
}

/**
 * Reject path spellings that have different meanings on supported operating systems.
 * @param path a repository-relative path with forward slashes.
 * @returns the path's segments.
 */
function splitPortablePath(path: string): string[] {
    const parts = path.split('/');
    if (parts.some((part) => isUnsafeSegment(part)))
        throw new Error(
            `${JSON.stringify(path)} is not a safe repository-relative path. Choose a path inside the repository.`,
        );
    return parts;
}

/**
 * Refuses a path inside gspot state.
 * @param path the proposed path.
 */
function assertOutsideStateFolder(path: string): void {
    if (STATE_FOLDER_PATTERN.test(path.normalize('NFC')))
        throw new Error(`${path} is inside .gspot/state. Choose a path outside it.`);
}

/**
 * Splits a path into segments and refuses an empty, dot, parent, or null segment.
 * @param path a repository-relative path with forward slashes.
 * @returns the path's segments.
 */
export function splitSystemPath(path: string): string[] {
    if (process.platform === 'win32') return splitPortablePath(path);
    const parts = path.split('/');
    if (parts.some((part) => RESERVED_SEGMENTS.has(part) || part.includes('\0')))
        throw new Error(
            `${JSON.stringify(path)} is not a safe repository-relative path. Choose a path inside the repository.`,
        );
    return parts;
}

/**
 * Public mutation plans cannot target the ownership log, lock, or recovery files.
 * @param path the proposed path.
 */
export function assertWritablePath(path: string): void {
    splitPortablePath(path);
    assertOutsideStateFolder(path);
}
