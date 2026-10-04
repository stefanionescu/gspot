// A tracked file as the repository read gives it, for tests of what reads the file list.

import type { TrackedFile } from '#cli/types/repository/inventory.ts';

/**
 * One tracked source file of one byte with no captured prefix.
 * @param path the root-relative path
 * @param tags the tags its extension gives it
 * @returns the tracked file
 */

export function buildTrackedFile(path: string, tags: string[] = ['text']): TrackedFile {
    return { path, prefix: Buffer.alloc(0), kind: 'source', tags, executable: false, size: 1 };
}
