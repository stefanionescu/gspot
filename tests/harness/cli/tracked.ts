// A tracked file as the repository read gives it, for tests of what reads the file list.
import type { TrackedFile } from '#cli/types/repository/repository.ts';

/**
 * One tracked source file of one byte with no captured prefix.
 * @param path the root-relative path
 * @param tags the tags its extension gives it
 * @returns the tracked file
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The owner and prose route tests build about forty tracked files this way.
export function trackedFile(path: string, tags: string[] = ['text']): TrackedFile {
    return { path, prefix: Buffer.alloc(0), kind: 'source', tags, executable: false, size: 1 };
}
