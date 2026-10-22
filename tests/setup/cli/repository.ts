// Builds tracked files and reads the files of a sandbox repository.
import { readRepository } from '#cli/repository/read.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { SOURCE_KIND } from '#cli/config/repository/inventory.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { Repository, TrackedFile } from '#cli/types/repository/inventory.ts';

/**
 * One tracked source file of one byte, without the executable bit.
 *
 * @param path location from the repository root.
 * @param tags labels that the file extension gives.
 * @returns a one-byte source file for the inventory.
 */
export function buildTrackedFile(path: string, tags: string[] = ['text']): TrackedFile {
    return { path, kind: 'source', kindOrigin: SOURCE_KIND.origin, tags, executable: false, size: 1 };
}

/** Read the files of a sandbox with the shipped configurations, no scopes, and no generated or vendored paths. */
export function readTestRepository(root: string): Promise<Repository> {
    return readRepository(createReadCache(root), {
        generatedPaths: [],
        scopes: [],
        configurations: readConfigurations(),
    });
}
