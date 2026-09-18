// Plants a directory tree for the rules that read the file system, and drops the caches they keep.
import { createFixture } from 'fs-fixture';
import { resetDirectoryCache } from '#plugin/files.ts';
import { resetExportCache } from '#plugin/rules/no-duplicate-barrel-exports.ts';

/**
 * Plants the files under a fresh temporary root and clears every directory and export cache.
 * @param files path to content
 * @returns the root the files sit under
 */
export async function plantedRoot(files: Record<string, string>): Promise<string> {
    const fixture = await createFixture(files);
    resetDirectoryCache();
    resetExportCache();
    return fixture.path;
}
