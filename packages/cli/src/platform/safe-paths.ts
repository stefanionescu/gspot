// The path spellings and file snapshots the lifecycle accepts, and the metadata paths it keeps to itself.
import { isDeepStrictEqual } from 'node:util';
import type { FileSnapshot } from '#cli/types/platform.ts';
import { OWNER_WRITE_BIT, READ_ONLY_FILE, WRITABLE_FILE } from '#cli/platform/file-modes.ts';

const DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu;
const UNSAFE_CHARACTERS = /[\\:<>"|?*\p{Cc}]/u;
const TRAILING_DOT_OR_SPACE = /[. ]$/u;

// Whether one segment of a portable path means something different on a supported operating system.
function isUnsafeSegment(part: string): boolean {
    if (['', '.', '..'].includes(part)) return true;
    if (UNSAFE_CHARACTERS.test(part) || TRAILING_DOT_OR_SPACE.test(part)) return true;
    return DEVICE_NAME.test(part);
}

/** Recovery and ownership metadata never enter repository checks or generated proposals. */
export const LIFECYCLE_PRIVATE_PATH =
    /(?:^|\/)\.gspot\/(?:state(?:\/|$)|ownership\.json$|writer\.lock$|recovery(?:\/|$))/iu;

/**
 * Compare only permissions represented by the host filesystem API. Windows exposes a read-only flag.
 * @param file the snapshot's mode and whether it is a link
 * @param platform the platform whose permission model applies
 * @returns the mode the platform can represent
 */
export function fileMode(file: Pick<FileSnapshot, 'mode' | 'isLink'>, platform = process.platform): number {
    if (platform !== 'win32') return file.mode;
    if (file.isLink || (file.mode & OWNER_WRITE_BIT) !== 0) return WRITABLE_FILE;
    return READ_ONLY_FILE;
}

/**
 * Whether two snapshots hold the same bytes and the same mode as the host can represent it.
 * @param found the snapshot read from disk
 * @param expected the snapshot the caller expects there
 * @returns true when both are absent or both match
 */
export function sameSnapshot(found: FileSnapshot | undefined, expected: FileSnapshot | undefined): boolean {
    if (found === undefined || expected === undefined) return found === expected;
    const observed = { ...found, mode: fileMode(found) };
    const requested = { ...expected, mode: fileMode(expected) };
    return isDeepStrictEqual(observed, requested);
}

/**
 * Reject path spellings that have different meanings on supported operating systems.
 * @param path a repository-relative path with forward slashes
 * @returns the path's segments
 */
export function mutationPath(path: string): string[] {
    const parts = path.split('/');
    if (parts.some((part) => isUnsafeSegment(part))) throw new Error(`Unsafe lifecycle path: ${JSON.stringify(path)}`);
    return parts;
}

/**
 * Snapshot names reject path traversal and null bytes.
 * @param path a repository-relative path in the platform's own spelling
 * @returns the path's segments
 */
export function nativePath(path: string): string[] {
    if (process.platform === 'win32') return mutationPath(path);
    const parts = path.split('/');
    if (parts.some((part) => part === '' || part === '.' || part === '..' || part.includes('\0')))
        throw new Error(`Unsafe lifecycle path: ${JSON.stringify(path)}`);
    return parts;
}

/**
 * Refuses a path inside the lifecycle's own metadata.
 * @param path the proposed path
 */
export function privateTarget(path: string): void {
    if (LIFECYCLE_PRIVATE_PATH.test(path.normalize('NFC')))
        throw new Error(`Lifecycle metadata is not a generated target: ${path}`);
}

/**
 * Public mutation proposals cannot target the owner's journal, lock, or recovery files.
 * @param path the proposed path
 */
export function mutationTarget(path: string): void {
    mutationPath(path);
    privateTarget(path);
}
